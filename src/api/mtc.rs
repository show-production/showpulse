use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;

use crate::timecode::mtc::MidiPort;
use crate::AppState;

/// GET /api/mtc/devices — list available MIDI input ports
pub async fn list_devices() -> Json<Vec<MidiPort>> {
    Json(crate::timecode::mtc::MtcDecoder::list_ports())
}

#[derive(Deserialize)]
pub struct PortSelect {
    pub port_index: usize,
}

/// PUT /api/mtc/device — select and start listening on a MIDI input port
pub async fn set_device(
    State(state): State<AppState>,
    Json(body): Json<PortSelect>,
) -> Result<StatusCode, (StatusCode, String)> {
    state
        .tc_manager
        .mtc_decoder
        .start_port(body.port_index)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

/// POST /api/mtc/stop — stop the MIDI input
pub async fn stop(State(state): State<AppState>) -> StatusCode {
    state.tc_manager.mtc_decoder.stop();
    StatusCode::NO_CONTENT
}
