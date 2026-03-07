use axum::{extract::State, http::StatusCode, Json};
use axum::http::Extensions;
use serde::Deserialize;

use crate::auth::{require_role, require_timer_access, Role};
use crate::timecode::generator::{GeneratorCommand, GeneratorConfig, GeneratorStatus};
use crate::timecode::types::Timecode;
use crate::AppState;

pub async fn status(State(state): State<AppState>) -> Json<GeneratorStatus> {
    Json(state.tc_manager.generator.status())
}

/// Guard: require Manager+ role and timer lock (or Admin).
async fn check_timer_control(
    state: &AppState,
    extensions: &Extensions,
) -> Result<(), StatusCode> {
    let session = require_role(extensions, Role::Manager)?;
    let lock = state.timer_lock.read().await;
    require_timer_access(&session, &lock)
}

pub async fn update_config(
    State(state): State<AppState>,
    extensions: Extensions,
    Json(config): Json<GeneratorConfig>,
) -> Result<StatusCode, StatusCode> {
    check_timer_control(&state, &extensions).await?;
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::UpdateConfig(config))
        .await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn play(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<StatusCode, StatusCode> {
    check_timer_control(&state, &extensions).await?;
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Play)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn pause(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<StatusCode, StatusCode> {
    check_timer_control(&state, &extensions).await?;
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Pause)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn stop(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<StatusCode, StatusCode> {
    check_timer_control(&state, &extensions).await?;
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Stop)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct GotoRequest {
    pub timecode: Timecode,
}

pub async fn goto(
    State(state): State<AppState>,
    extensions: Extensions,
    Json(body): Json<GotoRequest>,
) -> Result<StatusCode, StatusCode> {
    check_timer_control(&state, &extensions).await?;
    state
        .tc_manager
        .generator
        .send_command(GeneratorCommand::Goto(body.timecode))
        .await;
    Ok(StatusCode::NO_CONTENT)
}
