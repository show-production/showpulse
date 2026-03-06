use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use tower_http::services::ServeDir;
use tracing::info;

use showpulse::cue::store::CueStore;
use showpulse::timecode::TimecodeManager;
use showpulse::ws::hub::WsHub;
use showpulse::{api_router, AppState};

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        state.ws_hub.handle_connection(socket).await;
    })
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = showpulse::config::Config::default();

    let store = Arc::new(CueStore::new(PathBuf::from(&config.data_file)));
    store.seed_if_empty().await;
    let tc_manager = Arc::new(TimecodeManager::new());
    let ws_hub = Arc::new(WsHub::new());

    // Start countdown engine
    let engine_tc = tc_manager.clone();
    let engine_store = store.clone();
    let engine_hub = ws_hub.clone();
    tokio::spawn(async move {
        showpulse::engine::countdown::run(engine_tc, engine_store, engine_hub).await;
    });

    let state = AppState {
        tc_manager,
        store,
        ws_hub,
    };

    let app = api_router()
        // WebSocket
        .route("/ws", get(ws_handler))
        .with_state(state)
        // Static files (UI)
        .fallback_service(ServeDir::new("static"));

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("ShowPulse starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
