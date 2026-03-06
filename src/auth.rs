use std::collections::HashSet;
use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;

/// In-memory session store — holds valid session tokens.
#[derive(Clone)]
pub struct SessionStore {
    tokens: Arc<RwLock<HashSet<String>>>,
    pin: Option<String>,
}

impl SessionStore {
    pub fn new(pin: Option<String>) -> Self {
        Self {
            tokens: Arc::new(RwLock::new(HashSet::new())),
            pin,
        }
    }

    pub fn auth_enabled(&self) -> bool {
        self.pin.is_some()
    }

    pub async fn login(&self, candidate: &str) -> Option<String> {
        let pin = self.pin.as_ref()?;
        if candidate == pin {
            let token = Uuid::new_v4().to_string();
            self.tokens.write().await.insert(token.clone());
            Some(token)
        } else {
            None
        }
    }

    pub async fn validate(&self, token: &str) -> bool {
        self.tokens.read().await.contains(token)
    }

    pub async fn logout(&self, token: &str) {
        self.tokens.write().await.remove(token);
    }
}

// --- Login/logout endpoints ---

#[derive(Deserialize)]
pub struct LoginRequest {
    pub pin: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
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
    State(sessions): State<SessionStore>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    match sessions.login(&body.pin).await {
        Some(token) => Ok(Json(LoginResponse { token })),
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

// --- Auth middleware ---

/// Middleware that protects mutation endpoints (POST/PUT/DELETE).
/// GET requests pass through freely (read-only crew access).
/// If no PIN is configured, all requests pass through.
pub async fn require_auth(
    State(sessions): State<SessionStore>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Response {
    // No PIN configured — open access
    if !sessions.auth_enabled() {
        return next.run(req).await;
    }

    // Allow read-only methods without auth
    if req.method() == Method::GET {
        return next.run(req).await;
    }

    // Allow auth endpoints without a token
    let path = req.uri().path();
    if path == "/api/auth/login" || path == "/api/auth/status" {
        return next.run(req).await;
    }

    // Check for valid token
    let token = extract_token(&req);
    let valid = match &token {
        Some(t) => sessions.validate(t).await,
        None => false,
    };

    if valid {
        next.run(req).await
    } else {
        StatusCode::UNAUTHORIZED.into_response()
    }
}

fn extract_token<B>(req: &Request<B>) -> Option<String> {
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
