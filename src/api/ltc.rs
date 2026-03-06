use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;

use crate::timecode::ltc::AudioDevice;
use crate::AppState;

/// GET /api/ltc/devices — list available audio input devices
pub async fn list_devices() -> Json<Vec<AudioDevice>> {
    Json(crate::timecode::ltc::LtcDecoder::list_devices())
}

#[derive(Deserialize)]
pub struct DeviceSelect {
    pub device_index: usize,
}

/// PUT /api/ltc/device — select and start listening on an audio input device
pub async fn set_device(
    State(state): State<AppState>,
    Json(body): Json<DeviceSelect>,
) -> Result<StatusCode, (StatusCode, String)> {
    state
        .tc_manager
        .ltc_decoder
        .start_device(body.device_index)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

/// POST /api/ltc/stop — stop the LTC audio stream
pub async fn stop(State(state): State<AppState>) -> StatusCode {
    state.tc_manager.ltc_decoder.stop();
    StatusCode::NO_CONTENT
}
