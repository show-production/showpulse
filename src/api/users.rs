use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use axum::http::Extensions;
use uuid::Uuid;

use crate::auth::{require_role, Role, User};
use crate::AppState;

pub async fn list(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<Json<Vec<User>>, StatusCode> {
    require_role(&extensions, Role::Admin)?;
    let mut users = state.store.list_users().await;
    for u in &mut users {
        u.pin = String::new();
    }
    Ok(Json(users))
}

pub async fn create(
    State(state): State<AppState>,
    extensions: Extensions,
    Json(user): Json<User>,
) -> Result<(StatusCode, Json<User>), StatusCode> {
    require_role(&extensions, Role::Admin)?;
    let created = state.store.create_user(user).await;
    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn update(
    State(state): State<AppState>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
    Json(user): Json<User>,
) -> Result<Json<User>, StatusCode> {
    require_role(&extensions, Role::Admin)?;
    state
        .store
        .update_user(id, user)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete(
    State(state): State<AppState>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let session = require_role(&extensions, Role::Admin)?;
    if session.user_id == id {
        return Err(StatusCode::FORBIDDEN);
    }
    if state.store.delete_user(id).await {
        // Remove all sessions for the deleted user
        state.sessions.remove_user_sessions(id).await;
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
