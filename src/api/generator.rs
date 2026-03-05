use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;

use crate::timecode::generator::{GeneratorCommand, GeneratorConfig, GeneratorStatus};
use crate::timecode::types::Timecode;
use crate::AppState;

pub async fn status(State(state): State<AppState>) -> Json<GeneratorStatus> {
    Json(state.tc_manager.generator.status())
}

pub async fn update_config(
    State(state): State<AppState>,
    Json(config): Json<GeneratorConfig>,
) -> StatusCode {
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::UpdateConfig(config))
        .await;
    StatusCode::OK
}

pub async fn play(State(state): State<AppState>) -> StatusCode {
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Play)
        .await;
    StatusCode::OK
}

pub async fn pause(State(state): State<AppState>) -> StatusCode {
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Pause)
        .await;
    StatusCode::OK
}

pub async fn stop(State(state): State<AppState>) -> StatusCode {
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Stop)
        .await;
    StatusCode::OK
}

#[derive(Deserialize)]
pub struct GotoRequest {
    pub timecode: Timecode,
}

pub async fn goto(
    State(state): State<AppState>,
    Json(body): Json<GotoRequest>,
) -> StatusCode {
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Goto(body.timecode))
        .await;
    StatusCode::OK
}
