use std::collections::HashSet;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    extract::{DefaultBodyLimit, Query, State, WebSocketUpgrade},
    http::{HeaderValue, StatusCode},
    middleware,
    response::IntoResponse,
    routing::get,
};
use serde::Deserialize;
use tower::limit::ConcurrencyLimitLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::{info, warn};

use showpulse::auth::{LoginLimiter, Role, SessionStore};
use showpulse::cue::store::CueStore;
use showpulse::timecode::TimecodeManager;
use showpulse::ws::hub::{WsHub, WsSessionInfo};
use showpulse::{api_router, AppState};

#[derive(Deserialize)]
struct WsQuery {
    #[serde(default)]
    token: Option<String>,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, StatusCode> {
    if state.ws_hub.client_count().await >= showpulse::config::MAX_WS_CLIENTS {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Resolve session from token query param
    let session_info = if let Some(ref token) = query.token {
        if let Some(session) = state.sessions.get_session(token).await {
            let dept_filter = if session.role <= Role::CrewLead && !session.departments.is_empty() {
                Some(session.departments.iter().cloned().collect::<HashSet<_>>())
            } else {
                None
            };
            Some(WsSessionInfo {
                user_id: session.user_id,
                user_name: session.user_name.clone(),
                role: session.role,
                dept_filter,
            })
        } else {
            None
        }
    } else {
        None
    };

    Ok(ws.on_upgrade(move |socket| async move {
        state.ws_hub.handle_connection(socket, session_info).await;
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = showpulse::config::Config::from_env();

    let store = Arc::new(CueStore::new(PathBuf::from(&config.data_file)));
    store.seed_if_empty().await;

    // Migrate any plaintext PINs to argon2 hashes
    store.migrate_plaintext_pins().await;

    // Seed admin user from SHOWPULSE_PIN env var if no users exist
    if let Some(ref pin) = config.pin {
        store.seed_admin_user(pin).await;
    }

    let has_users = store.has_users().await;
    let tc_manager = Arc::new(TimecodeManager::new());
    let timer_lock = showpulse::auth::new_timer_lock();
    let ws_hub = Arc::new(WsHub::new(timer_lock.clone()));
    let sessions = SessionStore::new(!has_users);
    let login_limiter = LoginLimiter::new();

    if has_users {
        info!("Authentication enabled — {} user(s) configured", store.user_count().await);
    } else {
        warn!("No users configured — all endpoints are open (no authentication)");
    }

    // Start countdown engine
    let engine_tc = tc_manager.clone();
    let engine_store = store.clone();
    let engine_hub = ws_hub.clone();
    tokio::spawn(async move {
        showpulse::engine::countdown::run(engine_tc, engine_store, engine_hub).await;
    });

    // Background task: purge expired sessions and stale login attempts every 10 minutes
    let cleanup_sessions = sessions.clone();
    let cleanup_limiter = login_limiter.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(600));
        loop {
            interval.tick().await;
            cleanup_sessions.purge_expired().await;
            cleanup_limiter.cleanup().await;
        }
    });

    let state = AppState {
        tc_manager,
        store,
        ws_hub,
        sessions: sessions.clone(),
        timer_lock,
        login_limiter,
    };

    // CORS: only allow same-origin requests
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            HeaderValue::from_str(&format!("http://localhost:{}", config.port))
                .expect("valid origin"),
        ));

    let app = api_router()
        // WebSocket
        .route("/ws", get(ws_handler))
        // Auth middleware — protects POST/PUT/DELETE when users exist
        .route_layer(middleware::from_fn_with_state(
            sessions,
            showpulse::auth::require_auth,
        ))
        .with_state(state)
        // Concurrency limit: max 50 in-flight requests
        .layer(ConcurrencyLimitLayer::new(50))
        // Request body size limit (1MB — generous for JSON cue imports)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        // CORS
        .layer(cors)
        // Security headers
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        // Static files (UI)
        .fallback_service(ServeDir::new("static"));

    let addr = SocketAddr::from((config.bind_address, config.port));

    if config.bind_address.is_unspecified() {
        warn!("Listening on all interfaces ({}) — accessible from the network", addr);
    }

    info!("ShowPulse starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
