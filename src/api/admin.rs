use axum::http::{Extensions, StatusCode};
use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::auth::{require_role, Role, TimerLock};
use crate::AppState;

#[derive(Serialize)]
pub struct DashboardClient {
    pub user_name: Option<String>,
    pub role: Option<Role>,
    pub connected_seconds: u64,
    pub is_authenticated: bool,
}

#[derive(Serialize)]
pub struct DashboardTimerLock {
    pub locked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub holder: Option<TimerLock>,
}

#[derive(Serialize)]
pub struct DashboardResponse {
    pub total_connections: usize,
    pub authenticated_connections: usize,
    pub clients: Vec<DashboardClient>,
    pub timer_lock: DashboardTimerLock,
}

pub async fn dashboard(
    State(state): State<AppState>,
    extensions: Extensions,
) -> Result<Json<DashboardResponse>, StatusCode> {
    require_role(&extensions, Role::Admin)?;

    let connected = state.ws_hub.list_clients().await;
    let lock = state.timer_lock.read().await;

    let total_connections = connected.len();
    let mut authenticated_connections = 0;

    let clients: Vec<DashboardClient> = connected
        .into_iter()
        .map(|c| {
            let is_auth = c.user_id.is_some();
            if is_auth {
                authenticated_connections += 1;
            }
            DashboardClient {
                user_name: c.user_name,
                role: c.role,
                connected_seconds: c.connected_at.elapsed().as_secs(),
                is_authenticated: is_auth,
            }
        })
        .collect();

    Ok(Json(DashboardResponse {
        total_connections,
        authenticated_connections,
        clients,
        timer_lock: DashboardTimerLock {
            locked: lock.is_some(),
            holder: lock.clone(),
        },
    }))
}
