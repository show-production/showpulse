mod api;
mod config;
mod cue;
mod engine;
mod timecode;
mod ws;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::{get, post, put, delete},
};
use tower_http::services::ServeDir;
use tracing::info;

use cue::store::CueStore;
use timecode::TimecodeManager;
use ws::hub::WsHub;

#[derive(Clone)]
pub struct AppState {
    pub tc_manager: Arc<TimecodeManager>,
    pub store: Arc<CueStore>,
    pub ws_hub: Arc<WsHub>,
}

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

    let config = config::Config::default();

    let store = Arc::new(CueStore::new(PathBuf::from(&config.data_file)));
    store.seed_if_empty().await;
    let tc_manager = Arc::new(TimecodeManager::new());
    let ws_hub = Arc::new(WsHub::new());

    // Start countdown engine
    let engine_tc = tc_manager.clone();
    let engine_store = store.clone();
    let engine_hub = ws_hub.clone();
    tokio::spawn(async move {
        engine::countdown::run(engine_tc, engine_store, engine_hub).await;
    });

    let state = AppState {
        tc_manager,
        store,
        ws_hub,
    };

    let app = Router::new()
        // Timecode
        .route("/api/timecode", get(api::timecode::status))
        .route("/api/timecode/source", put(api::timecode::set_source))
        // Generator
        .route("/api/generator", get(api::generator::status))
        .route("/api/generator", put(api::generator::update_config))
        .route("/api/generator/play", post(api::generator::play))
        .route("/api/generator/pause", post(api::generator::pause))
        .route("/api/generator/stop", post(api::generator::stop))
        .route("/api/generator/goto", post(api::generator::goto))
        // Departments
        .route("/api/departments", get(api::departments::list))
        .route("/api/departments", post(api::departments::create))
        .route("/api/departments/{id}", put(api::departments::update))
        .route("/api/departments/{id}", delete(api::departments::delete))
        // Cues
        .route("/api/cues", get(api::cues::list))
        .route("/api/cues", post(api::cues::create))
        .route("/api/cues/{id}", get(api::cues::get))
        .route("/api/cues/{id}", put(api::cues::update))
        .route("/api/cues/{id}", delete(api::cues::delete))
        // LTC
        .route("/api/ltc/devices", get(api::ltc::list_devices))
        .route("/api/ltc/device", put(api::ltc::set_device))
        .route("/api/ltc/stop", post(api::ltc::stop))
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
