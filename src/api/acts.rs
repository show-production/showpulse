use axum::extract::{Path, State};
use axum::http::{Extensions, StatusCode};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::{require_role, Role};
use crate::cue::types::Act;
use crate::timecode::types::Timecode;
use crate::AppState;

pub async fn list(State(state): State<AppState>) -> Json<Vec<Act>> {
    Json(state.store.list_acts().await)
}

pub async fn create(
    State(state): State<AppState>,
    extensions: Extensions,
    Json(body): Json<Act>,
) -> Result<Json<Act>, StatusCode> {
    require_role(&extensions, Role::Operator)?;
    Ok(Json(state.store.create_act(body).await))
}

pub async fn update(
    State(state): State<AppState>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
    Json(body): Json<Act>,
) -> Result<Json<Act>, StatusCode> {
    require_role(&extensions, Role::Operator)?;
    state.store.update_act(id, body).await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete(
    State(state): State<AppState>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    require_role(&extensions, Role::Operator)?;
    if state.store.delete_act(id).await {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize)]
pub struct ShiftRequest {
    pub timecode: Timecode,
}

pub async fn shift(
    State(state): State<AppState>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
    Json(body): Json<ShiftRequest>,
) -> Result<StatusCode, StatusCode> {
    require_role(&extensions, Role::Operator)?;
    if state.store.shift_act(id, body.timecode).await {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
