pub mod api;
pub mod auth;
pub mod config;
pub mod cue;
pub mod engine;
pub mod timecode;
pub mod ws;

use std::sync::Arc;

use axum::extract::FromRef;
use axum::routing::{delete, get, post, put};
use axum::Router;

use auth::SessionStore;
use cue::store::CueStore;
use timecode::TimecodeManager;
use ws::hub::WsHub;

#[derive(Clone)]
pub struct AppState {
    pub tc_manager: Arc<TimecodeManager>,
    pub store: Arc<CueStore>,
    pub ws_hub: Arc<WsHub>,
    pub sessions: SessionStore,
}

impl FromRef<AppState> for SessionStore {
    fn from_ref(state: &AppState) -> Self {
        state.sessions.clone()
    }
}

/// Build the API routes (without WebSocket or static file serving).
/// Used by both main() and integration tests.
pub fn api_router() -> Router<AppState> {
    Router::new()
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
        .route("/api/departments/:id", put(api::departments::update))
        .route(
            "/api/departments/:id",
            delete(api::departments::delete),
        )
        // Cues
        .route("/api/cues", get(api::cues::list))
        .route("/api/cues", post(api::cues::create))
        .route("/api/cues/import", post(api::cues::import))
        .route("/api/show/import", post(api::cues::import_show))
        .route("/api/cues/:id", get(api::cues::get))
        .route("/api/cues/:id", put(api::cues::update))
        .route("/api/cues/:id", delete(api::cues::delete))
        // LTC
        .route("/api/ltc/devices", get(api::ltc::list_devices))
        .route("/api/ltc/device", put(api::ltc::set_device))
        .route("/api/ltc/stop", post(api::ltc::stop))
        // MTC
        .route("/api/mtc/devices", get(api::mtc::list_devices))
        .route("/api/mtc/device", put(api::mtc::set_device))
        .route("/api/mtc/stop", post(api::mtc::stop))
        // QR
        .route("/api/qr", get(api::qr::qr_svg))
        // Auth
        .route("/api/auth/status", get(auth::auth_status))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
}
