use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio::time::Instant;
use uuid::Uuid;

// ── Constants ────────────────────────────────

/// Session lifetime: 8 hours.
const SESSION_TTL_SECS: u64 = 8 * 3600;

/// Max failed login attempts per IP before lockout.
const MAX_LOGIN_ATTEMPTS: usize = 5;

/// Window for counting failed login attempts (seconds).
const LOGIN_WINDOW_SECS: u64 = 60;

// ── PIN hashing ──────────────────────────────

/// Hash a plaintext PIN using argon2 with a random salt.
pub fn hash_pin(pin: &str) -> String {
    use argon2::password_hash::{rand_core::OsRng, SaltString};
    use argon2::{Argon2, PasswordHasher};
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .expect("argon2 hash failed")
        .to_string()
}

/// Verify a plaintext PIN against an argon2 hash.
pub fn verify_pin(pin: &str, hash: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok()
}

/// Check if a stored PIN is already hashed (argon2 hashes start with `$argon2`).
pub fn is_hashed(pin: &str) -> bool {
    pin.starts_with("$argon2")
}

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

// ── Login rate limiter ──────────────────────

/// Tracks failed login attempts per IP to prevent brute-force attacks.
#[derive(Clone)]
pub struct LoginLimiter {
    /// Maps IP -> list of failed attempt timestamps.
    attempts: Arc<RwLock<HashMap<IpAddr, Vec<Instant>>>>,
}

impl LoginLimiter {
    pub fn new() -> Self {
        Self {
            attempts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if an IP is currently rate-limited.
    pub async fn is_limited(&self, ip: IpAddr) -> bool {
        let attempts = self.attempts.read().await;
        if let Some(times) = attempts.get(&ip) {
            let cutoff = Instant::now() - std::time::Duration::from_secs(LOGIN_WINDOW_SECS);
            let recent = times.iter().filter(|t| **t > cutoff).count();
            recent >= MAX_LOGIN_ATTEMPTS
        } else {
            false
        }
    }

    /// Record a failed login attempt for an IP.
    pub async fn record_failure(&self, ip: IpAddr) {
        let mut attempts = self.attempts.write().await;
        let entry = attempts.entry(ip).or_default();
        entry.push(Instant::now());
        // Prune old entries
        let cutoff = Instant::now() - std::time::Duration::from_secs(LOGIN_WINDOW_SECS);
        entry.retain(|t| *t > cutoff);
    }

    /// Clear failures for an IP on successful login.
    pub async fn clear(&self, ip: IpAddr) {
        self.attempts.write().await.remove(&ip);
    }

    /// Periodic cleanup of stale entries (call from a background task).
    pub async fn cleanup(&self) {
        let cutoff = Instant::now() - std::time::Duration::from_secs(LOGIN_WINDOW_SECS);
        let mut attempts = self.attempts.write().await;
        attempts.retain(|_, times| {
            times.retain(|t| *t > cutoff);
            !times.is_empty()
        });
    }
}

// ── Session store ───────────────────────────

/// Session info stored per token — carries identity, role, and expiry.
#[derive(Debug, Clone)]
pub struct Session {
    pub user_id: Uuid,
    pub user_name: String,
    pub role: Role,
    pub departments: Vec<Uuid>,
    pub created_at: Instant,
}

impl Session {
    /// Check if this session has expired.
    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed().as_secs() > SESSION_TTL_SECS
    }
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
            created_at: Instant::now(),
        };
        self.sessions.write().await.insert(token.clone(), session);
        token
    }

    /// Get the session for a token. Returns None if expired or not found.
    pub async fn get_session(&self, token: &str) -> Option<Session> {
        let sessions = self.sessions.read().await;
        match sessions.get(token) {
            Some(session) if !session.is_expired() => Some(session.clone()),
            Some(_) => {
                // Expired — will be cleaned up by purge task
                drop(sessions);
                self.sessions.write().await.remove(token);
                None
            }
            None => None,
        }
    }

    pub async fn logout(&self, token: &str) {
        self.sessions.write().await.remove(token);
    }

    /// Remove all sessions for a specific user (e.g. when user is deleted).
    pub async fn remove_user_sessions(&self, user_id: Uuid) {
        self.sessions.write().await.retain(|_, s| s.user_id != user_id);
    }

    /// Purge all expired sessions. Called periodically from a background task.
    pub async fn purge_expired(&self) {
        self.sessions.write().await.retain(|_, s| !s.is_expired());
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
    req: Request<axum::body::Body>,
) -> Result<Json<LoginResponse>, StatusCode> {
    if !state.sessions.auth_enabled() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Extract client IP for rate limiting
    let ip = extract_client_ip(&req);

    // Check rate limit
    if let Some(ip) = ip {
        if state.login_limiter.is_limited(ip).await {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    // Parse body
    let body_bytes = axum::body::to_bytes(req.into_body(), 1024)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let body: LoginRequest =
        serde_json::from_slice(&body_bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Find user by name, then verify PIN hash
    let user = state.store.find_user_by_name(&body.name).await;
    match user {
        Some(u) if verify_pin(&body.pin, &u.pin) => {
            // Success — clear rate limit
            if let Some(ip) = ip {
                state.login_limiter.clear(ip).await;
            }
            let token = state.sessions.create_session(&u).await;
            Ok(Json(LoginResponse {
                token,
                role: u.role,
                name: u.name,
                departments: u.departments,
            }))
        }
        _ => {
            // Failure — record attempt
            if let Some(ip) = ip {
                state.login_limiter.record_failure(ip).await;
            }
            Err(StatusCode::UNAUTHORIZED)
        }
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

/// Extract client IP from connection info (trusted) with proxy header fallback.
/// Prefers ConnectInfo (actual TCP peer) to prevent X-Forwarded-For spoofing.
fn extract_client_ip<B>(req: &Request<B>) -> Option<IpAddr> {
    // Prefer ConnectInfo — the actual TCP connection peer (unspoofable)
    req.extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip())
}

use std::net::SocketAddr;
