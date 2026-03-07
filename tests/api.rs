use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tempfile::NamedTempFile;
use tower::ServiceExt;

use showpulse::cue::store::CueStore;
use showpulse::cue::types::{Cue, CueImportResult, Department};
use showpulse::timecode::types::Timecode;
use showpulse::timecode::TimecodeManager;
use showpulse::ws::hub::WsHub;
use showpulse::auth::SessionStore;
use showpulse::{api_router, AppState};

fn test_state() -> (AppState, NamedTempFile) {
    let tmp = NamedTempFile::new().unwrap();
    let store = Arc::new(CueStore::new(tmp.path().to_path_buf()));
    let tc_manager = Arc::new(TimecodeManager::new());
    let timer_lock = showpulse::auth::new_timer_lock();
    let ws_hub = Arc::new(WsHub::new(timer_lock.clone()));
    let sessions = SessionStore::new(true);
    let state = AppState {
        tc_manager,
        store,
        ws_hub,
        sessions,
        timer_lock,
    };
    (state, tmp)
}

fn app(state: AppState) -> axum::Router {
    api_router().with_state(state)
}

// ── Department endpoints ──

#[tokio::test]
async fn list_departments_empty() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .uri("/api/departments")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let depts: Vec<Department> = serde_json::from_slice(&body).unwrap();
    assert!(depts.is_empty());
}

#[tokio::test]
async fn create_department_returns_201() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/departments")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&Department {
                        id: uuid::Uuid::nil(),
                        name: "Lighting".to_string(),
                        color: "#ffcc00".to_string(),
                    })
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let dept: Department = serde_json::from_slice(&body).unwrap();
    assert_eq!(dept.name, "Lighting");
    assert_ne!(dept.id, uuid::Uuid::nil());
}

#[tokio::test]
async fn update_department_returns_200() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Old".to_string(),
            color: "#000000".to_string(),
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(&format!("/api/departments/{}", dept.id))
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&Department {
                        id: dept.id,
                        name: "New".to_string(),
                        color: "#ffffff".to_string(),
                    })
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let updated: Department = serde_json::from_slice(&body).unwrap();
    assert_eq!(updated.name, "New");
}

#[tokio::test]
async fn update_nonexistent_department_returns_404() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(&format!("/api/departments/{}", uuid::Uuid::new_v4()))
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&Department {
                        id: uuid::Uuid::nil(),
                        name: "Ghost".to_string(),
                        color: "#000000".to_string(),
                    })
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_department_returns_204() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Delete Me".to_string(),
            color: "#000000".to_string(),
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(&format!("/api/departments/{}", dept.id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn delete_nonexistent_department_returns_404() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(&format!("/api/departments/{}", uuid::Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

// ── Cue endpoints ──

#[tokio::test]
async fn create_cue_returns_201() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Sound".to_string(),
            color: "#00aaff".to_string(),
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cues")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "department_id": dept.id,
                        "label": "Play music",
                        "trigger_tc": Timecode::new(0, 0, 30, 0),
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let cue: Cue = serde_json::from_slice(&body).unwrap();
    assert_eq!(cue.label, "Play music");
    assert_eq!(cue.cue_number, "Q1");
}

#[tokio::test]
async fn get_cue_returns_200() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Sound".to_string(),
            color: "#00aaff".to_string(),
        })
        .await;
    let cue = state
        .store
        .create_cue(Cue {
            id: uuid::Uuid::nil(),
            department_id: dept.id,
            cue_number: String::new(),
            label: "Test".to_string(),
            trigger_tc: Timecode::ZERO,
            warn_seconds: 10,
            notes: String::new(),
            duration: None,
            armed: true,
            color: None,
            continue_mode: showpulse::cue::types::ContinueMode::Stop,
            post_wait: None,
            act_id: None,
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .uri(&format!("/api/cues/{}", cue.id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let fetched: Cue = serde_json::from_slice(&body).unwrap();
    assert_eq!(fetched.id, cue.id);
}

#[tokio::test]
async fn get_nonexistent_cue_returns_404() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .uri(&format!("/api/cues/{}", uuid::Uuid::new_v4()))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn list_cues_with_department_filter() {
    let (state, _tmp) = test_state();
    let d1 = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Lighting".to_string(),
            color: "#ffcc00".to_string(),
        })
        .await;
    let d2 = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Sound".to_string(),
            color: "#00aaff".to_string(),
        })
        .await;

    state
        .store
        .create_cue(Cue {
            id: uuid::Uuid::nil(),
            department_id: d1.id,
            cue_number: String::new(),
            label: "L1".to_string(),
            trigger_tc: Timecode::ZERO,
            warn_seconds: 10,
            notes: String::new(),
            duration: None,
            armed: true,
            color: None,
            continue_mode: showpulse::cue::types::ContinueMode::Stop,
            post_wait: None,
            act_id: None,
        })
        .await;
    state
        .store
        .create_cue(Cue {
            id: uuid::Uuid::nil(),
            department_id: d2.id,
            cue_number: String::new(),
            label: "S1".to_string(),
            trigger_tc: Timecode::ZERO,
            warn_seconds: 10,
            notes: String::new(),
            duration: None,
            armed: true,
            color: None,
            continue_mode: showpulse::cue::types::ContinueMode::Stop,
            post_wait: None,
            act_id: None,
        })
        .await;

    // Filter by d1
    let resp = app(state)
        .oneshot(
            Request::builder()
                .uri(&format!("/api/cues?department_id={}", d1.id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let cues: Vec<Cue> = serde_json::from_slice(&body).unwrap();
    assert_eq!(cues.len(), 1);
    assert_eq!(cues[0].label, "L1");
}

#[tokio::test]
async fn delete_cue_returns_204() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Sound".to_string(),
            color: "#00aaff".to_string(),
        })
        .await;
    let cue = state
        .store
        .create_cue(Cue {
            id: uuid::Uuid::nil(),
            department_id: dept.id,
            cue_number: String::new(),
            label: "Delete me".to_string(),
            trigger_tc: Timecode::ZERO,
            warn_seconds: 10,
            notes: String::new(),
            duration: None,
            armed: true,
            color: None,
            continue_mode: showpulse::cue::types::ContinueMode::Stop,
            post_wait: None,
            act_id: None,
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(&format!("/api/cues/{}", cue.id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NO_CONTENT);
}

// ── Bulk import endpoint ──

#[tokio::test]
async fn import_cues_endpoint() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Sound".to_string(),
            color: "#00aaff".to_string(),
        })
        .await;

    let import_cues = vec![
        serde_json::json!({
            "department_id": dept.id,
            "label": "Cue A",
            "trigger_tc": Timecode::new(0, 0, 10, 0),
        }),
        serde_json::json!({
            "department_id": dept.id,
            "label": "Cue B",
            "trigger_tc": Timecode::new(0, 0, 20, 0),
        }),
    ];

    let resp = app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cues/import")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&import_cues).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let result: CueImportResult = serde_json::from_slice(&body).unwrap();
    assert_eq!(result.imported, 2);
    assert!(result.errors.is_empty());

    // Verify in store
    assert_eq!(state.store.list_cues(None).await.len(), 2);
}

// ── Cue with all fields populated ──

#[tokio::test]
async fn create_cue_with_all_fields() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Pyro".to_string(),
            color: "#ff4400".to_string(),
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cues")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "department_id": dept.id,
                        "cue_number": "PY1",
                        "label": "CO2 jets — stage edge",
                        "trigger_tc": Timecode::new(0, 3, 0, 0),
                        "warn_seconds": 12,
                        "notes": "3-second burst",
                        "duration": 3,
                        "armed": true,
                        "color": "#ffdd00",
                        "continue_mode": "auto_continue",
                        "post_wait": 2.5
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let cue: Cue = serde_json::from_slice(&body).unwrap();
    assert_eq!(cue.cue_number, "PY1");
    assert_eq!(cue.label, "CO2 jets — stage edge");
    assert_eq!(cue.warn_seconds, 12);
    assert_eq!(cue.duration, Some(3));
    assert!(cue.armed);
    assert_eq!(cue.color, Some("#ffdd00".to_string()));
    assert_eq!(cue.continue_mode, showpulse::cue::types::ContinueMode::AutoContinue);
    assert_eq!(cue.post_wait, Some(2.5));
}

#[tokio::test]
async fn create_disarmed_cue() {
    let (state, _tmp) = test_state();
    let dept = state
        .store
        .create_department(Department {
            id: uuid::Uuid::nil(),
            name: "Automation".to_string(),
            color: "#88ff44".to_string(),
        })
        .await;

    let resp = app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cues")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "department_id": dept.id,
                        "label": "Lower main curtain",
                        "trigger_tc": Timecode::new(0, 12, 0, 0),
                        "armed": false,
                        "duration": 8
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::CREATED);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let cue: Cue = serde_json::from_slice(&body).unwrap();
    assert!(!cue.armed);
    assert_eq!(cue.duration, Some(8));
    assert_eq!(cue.continue_mode, showpulse::cue::types::ContinueMode::Stop);
    assert_eq!(cue.color, None);
    assert_eq!(cue.post_wait, None);
}

// ── Timecode status endpoint ──

#[tokio::test]
async fn timecode_status_returns_200() {
    let (state, _tmp) = test_state();
    let resp = app(state)
        .oneshot(
            Request::builder()
                .uri("/api/timecode")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}
