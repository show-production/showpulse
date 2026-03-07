use axum::{extract::State, http::StatusCode, Json};
use axum::http::Extensions;
use serde::Serialize;

use crate::auth::{require_role, Role, TimerLock};
use crate::AppState;

#[derive(Serialize)]
pub struct TimerLockStatus {
    pub locked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub holder: Option<TimerLock>,
}

pub async fn status(State(state): State<AppState>) -> Json<TimerLockStatus> {
    let lock = state.timer_lock.read().await;
    Json(TimerLockStatus {
        locked: lock.is_some(),
        holder: lock.clone(),
    })
}

pub async fn acquire(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<Json<TimerLockStatus>, StatusCode> {
    let session = require_role(&extensions, Role::Manager)?;
    let mut lock = state.timer_lock.write().await;

    // Admin can always take the lock; Manager only if free
    if let Some(ref current) = *lock {
        if current.user_id != session.user_id && session.role != Role::Admin {
            return Err(StatusCode::CONFLICT);
        }
    }

    *lock = Some(TimerLock {
        user_id: session.user_id,
        user_name: session.user_name.clone(),
    });

    Ok(Json(TimerLockStatus {
        locked: true,
        holder: lock.clone(),
    }))
}

pub async fn release(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<StatusCode, StatusCode> {
    let session = require_role(&extensions, Role::Manager)?;
    let mut lock = state.timer_lock.write().await;

    match &*lock {
        Some(current) if current.user_id == session.user_id || session.role == Role::Admin => {
            *lock = None;
            Ok(StatusCode::NO_CONTENT)
        }
        Some(_) => Err(StatusCode::FORBIDDEN),
        None => Ok(StatusCode::NO_CONTENT),
    }
}
