use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;

use crate::timecode::types::{TimecodeSource, TimecodeStatus};
use crate::AppState;

pub async fn status(State(state): State<AppState>) -> Json<TimecodeStatus> {
    Json(state.tc_manager.status().await)
}

#[derive(Deserialize)]
pub struct SourceUpdate {
    pub source: TimecodeSource,
}

pub async fn set_source(
    State(state): State<AppState>,
    Json(body): Json<SourceUpdate>,
) -> StatusCode {
    state.tc_manager.set_source(body.source).await;
    StatusCode::OK
}
