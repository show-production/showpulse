use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;

// ── Role & User types ───────────────────────

/// Permission levels (higher number = more access).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Viewer = 1,
    CrewLead = 2,
    Operator = 3,
    Manager = 4,
    Admin = 5,
}

impl Role {
    pub fn level(self) -> u8 {
        self as u8
    }
}

/// A user account stored in the show data file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub name: String,
    pub pin: String,
    pub role: Role,
    /// Department IDs this user can see (Viewer/CrewLead). Empty = all.
    #[serde(default)]
    pub departments: Vec<Uuid>,
}

// ── Timer lock ──────────────────────────────

/// Exclusive timer control lock — only one Manager at a time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerLock {
    pub user_id: Uuid,
    pub user_name: String,
}

/// Shared timer lock state.
pub type TimerLockState = Arc<RwLock<Option<TimerLock>>>;

pub fn new_timer_lock() -> TimerLockState {
    Arc::new(RwLock::new(None))
}

// ── Session store ───────────────────────────

/// Session info stored per token — carries identity and role.
#[derive(Debug, Clone)]
pub struct Session {
    pub user_id: Uuid,
    pub user_name: String,
    pub role: Role,
    pub departments: Vec<Uuid>,
}

/// In-memory session store — maps tokens to sessions.
#[derive(Clone)]
pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    open_access: bool,
}

impl SessionStore {
    /// Create a new session store.
    /// `open_access`: if true, all requests pass through without auth
    /// (used when no users are configured).
    pub fn new(open_access: bool) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            open_access,
        }
    }

    pub fn auth_enabled(&self) -> bool {
        !self.open_access
    }

    pub fn set_open_access(&mut self, open: bool) {
        self.open_access = open;
    }

    /// Create a session for a user. Returns the token.
    pub async fn create_session(&self, user: &User) -> String {
        let token = Uuid::new_v4().to_string();
        let session = Session {
            user_id: user.id,
            user_name: user.name.clone(),
            role: user.role,
            departments: user.departments.clone(),
        };
        self.sessions.write().await.insert(token.clone(), session);
        token
    }

    /// Get the session for a token.
    pub async fn get_session(&self, token: &str) -> Option<Session> {
        self.sessions.read().await.get(token).cloned()
    }

    pub async fn logout(&self, token: &str) {
        self.sessions.write().await.remove(token);
    }

    /// Remove all sessions for a specific user (e.g. when user is deleted).
    pub async fn remove_user_sessions(&self, user_id: Uuid) {
        self.sessions.write().await.retain(|_, s| s.user_id != user_id);
    }
}

// ── Login/logout endpoints ──────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub name: String,
    pub pin: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub role: Role,
    pub name: String,
    pub departments: Vec<Uuid>,
}

#[derive(Serialize)]
pub struct AuthStatusResponse {
    pub auth_enabled: bool,
}

pub async fn auth_status(State(sessions): State<SessionStore>) -> Json<AuthStatusResponse> {
    Json(AuthStatusResponse {
        auth_enabled: sessions.auth_enabled(),
    })
}

pub async fn login(
    State(state): State<crate::AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    if !state.sessions.auth_enabled() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Find user by name + pin
    let user = state.store.find_user_by_credentials(&body.name, &body.pin).await;
    match user {
        Some(u) => {
            let token = state.sessions.create_session(&u).await;
            Ok(Json(LoginResponse {
                token,
                role: u.role,
                name: u.name,
                departments: u.departments,
            }))
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

pub async fn logout(
    State(sessions): State<SessionStore>,
    req: Request<axum::body::Body>,
) -> StatusCode {
    if let Some(token) = extract_token(&req) {
        sessions.logout(&token).await;
    }
    StatusCode::NO_CONTENT
}

// ── Auth middleware ──────────────────────────

/// Middleware that enforces role-based access.
/// - Open access mode: all requests pass through.
/// - GET requests pass through freely (read-only crew access).
/// - Auth endpoints are always accessible.
/// - All other requests require a valid session token.
/// The session is injected into request extensions for downstream handlers.
pub async fn require_auth(
    State(sessions): State<SessionStore>,
    mut req: Request<axum::body::Body>,
    next: Next,
) -> Response {
    // Open access — no users configured
    if !sessions.auth_enabled() {
        return next.run(req).await;
    }

    // Allow read-only methods without auth
    if req.method() == Method::GET {
        // Still try to attach session if token is present (for role-gated GETs)
        if let Some(token) = extract_token(&req) {
            if let Some(session) = sessions.get_session(&token).await {
                req.extensions_mut().insert(session);
            }
        }
        return next.run(req).await;
    }

    // Allow auth endpoints without a token
    let path = req.uri().path().to_string();
    if path == "/api/auth/login" || path == "/api/auth/status" {
        return next.run(req).await;
    }

    // Require valid session
    let token = extract_token(&req);
    let session = match &token {
        Some(t) => sessions.get_session(t).await,
        None => None,
    };

    match session {
        Some(s) => {
            req.extensions_mut().insert(s);
            next.run(req).await
        }
        None => StatusCode::UNAUTHORIZED.into_response(),
    }
}

// ── Role guard helpers ───────────────────────

/// Extract session from request extensions and check minimum role.
/// Returns the session on success, or FORBIDDEN/UNAUTHORIZED on failure.
pub fn require_role(extensions: &axum::http::Extensions, min_role: Role) -> Result<Session, StatusCode> {
    let session = extensions
        .get::<Session>()
        .cloned()
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if session.role.level() < min_role.level() {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(session)
}

/// Check if a user holds the timer lock or is Admin.
pub fn require_timer_access(
    session: &Session,
    lock: &Option<TimerLock>,
) -> Result<(), StatusCode> {
    if session.role == Role::Admin {
        return Ok(());
    }
    match lock {
        Some(tl) if tl.user_id == session.user_id => Ok(()),
        _ => Err(StatusCode::FORBIDDEN),
    }
}

/// Extract a session token from the request (header or query param).
pub fn extract_token<B>(req: &Request<B>) -> Option<String> {
    // Check Authorization: Bearer <token>
    req.headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
        // Fallback: check ?token= query param (for WebSocket)
        .or_else(|| {
            req.uri()
                .query()
                .and_then(|q| {
                    q.split('&')
                        .find_map(|pair| pair.strip_prefix("token="))
                })
                .map(|s| s.to_string())
        })
}
