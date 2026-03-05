use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::cue::types::{Cue, CueImportResult};
use crate::AppState;

#[derive(Deserialize)]
pub struct CueFilter {
    pub department_id: Option<Uuid>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(filter): Query<CueFilter>,
) -> Json<Vec<Cue>> {
    Json(state.store.list_cues(filter.department_id).await)
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Cue>, StatusCode> {
    state
        .store
        .get_cue(id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create(
    State(state): State<AppState>,
    Json(cue): Json<Cue>,
) -> (StatusCode, Json<Cue>) {
    let created = state.store.create_cue(cue).await;
    (StatusCode::CREATED, Json(created))
}

pub async fn import(
    State(state): State<AppState>,
    Json(cues): Json<Vec<Cue>>,
) -> Json<CueImportResult> {
    Json(state.store.import_cues(cues).await)
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(cue): Json<Cue>,
) -> Result<Json<Cue>, StatusCode> {
    state
        .store
        .update_cue(id, cue)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    if state.store.delete_cue(id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}
