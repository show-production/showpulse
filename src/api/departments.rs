use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::cue::types::Department;
use crate::AppState;

pub async fn list(State(state): State<AppState>) -> Json<Vec<Department>> {
    Json(state.store.list_departments().await)
}

pub async fn create(
    State(state): State<AppState>,
    Json(dept): Json<Department>,
) -> (StatusCode, Json<Department>) {
    let created = state.store.create_department(dept).await;
    (StatusCode::CREATED, Json(created))
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dept): Json<Department>,
) -> Result<Json<Department>, StatusCode> {
    state
        .store
        .update_department(id, dept)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    if state.store.delete_department(id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}
