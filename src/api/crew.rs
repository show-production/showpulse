use std::collections::{HashMap, HashSet};

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::auth::Role;
use crate::AppState;

#[derive(Serialize)]
pub struct CrewMember {
    pub name: String,
    pub online: bool,
}

#[derive(Serialize)]
pub struct CrewDepartment {
    pub name: String,
    pub color: String,
    pub members: Vec<CrewMember>,
}

#[derive(Serialize)]
pub struct CrewStatusResponse {
    pub departments: Vec<CrewDepartment>,
}

/// Lightweight crew status endpoint — accessible to all roles (GET passes through auth).
/// Returns users grouped by department with online/offline status.
/// Excludes admin users. No sensitive data exposed.
pub async fn status(State(state): State<AppState>) -> Json<CrewStatusResponse> {
    let users = state.store.list_users().await;
    let departments = state.store.list_departments().await;
    let connected = state.ws_hub.list_clients().await;

    // Build set of online user names from authenticated WS clients
    let online_names: HashSet<String> = connected
        .iter()
        .filter_map(|c| c.user_name.clone())
        .collect();

    // Group non-admin users by department
    let mut dept_members: HashMap<uuid::Uuid, Vec<CrewMember>> = HashMap::new();
    for user in &users {
        if user.role == Role::Admin {
            continue;
        }
        let member = CrewMember {
            name: user.name.clone(),
            online: online_names.contains(&user.name),
        };
        for &dept_id in &user.departments {
            dept_members
                .entry(dept_id)
                .or_default()
                .push(CrewMember {
                    name: member.name.clone(),
                    online: member.online,
                });
        }
    }

    // Build response sorted by department name
    let mut result: Vec<CrewDepartment> = departments
        .iter()
        .filter_map(|d| {
            let members = dept_members.remove(&d.id)?;
            Some(CrewDepartment {
                name: d.name.clone(),
                color: d.color.clone(),
                members,
            })
        })
        .collect();

    // Sort online members first within each department
    for dept in &mut result {
        dept.members.sort_by(|a, b| b.online.cmp(&a.online).then(a.name.cmp(&b.name)));
    }

    Json(CrewStatusResponse {
        departments: result,
    })
}
