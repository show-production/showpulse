use axum::extract::State;
use axum::http::{Extensions, StatusCode};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::auth::{require_role, Role};
use crate::AppState;

#[derive(Serialize)]
pub struct ShowNameResponse {
    pub name: String,
}

#[derive(Deserialize)]
pub struct SetShowNameRequest {
    pub name: String,
}

pub async fn get_name(State(state): State<AppState>) -> Json<ShowNameResponse> {
    Json(ShowNameResponse {
        name: state.store.get_show_name().await,
    })
}

pub async fn set_name(
    State(state): State<AppState>,
    extensions: Extensions,
    Json(body): Json<SetShowNameRequest>,
) -> Result<StatusCode, StatusCode> {
    require_role(&extensions, Role::Manager)?;
    state.store.set_show_name(body.name).await;
    Ok(StatusCode::NO_CONTENT)
}
