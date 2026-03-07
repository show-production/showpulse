use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::info;
use uuid::Uuid;

use crate::auth::TimerLockState;
use crate::cue::types::CueStatus;

#[derive(Debug, Clone, Serialize)]
pub struct BroadcastMessage {
    pub timecode: String,
    pub frame_rate: f64,
    pub status: String,
    pub cues: Vec<CueStatus>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe { departments: DeptFilter },
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum DeptFilter {
    All(()),               // "all"
    Specific(Vec<Uuid>),   // ["uuid1", "uuid2"]
}

/// Optional session info attached to a WebSocket connection.
#[derive(Clone)]
pub struct WsSessionInfo {
    pub user_id: Uuid,
    pub user_name: String,
    /// Pre-set department filter for Viewer/CrewLead users.
    pub dept_filter: Option<HashSet<Uuid>>,
}

/// Tracks connected client count
pub struct WsHub {
    tx: broadcast::Sender<BroadcastMessage>,
    client_count: Arc<RwLock<usize>>,
    timer_lock: TimerLockState,
}

impl WsHub {
    pub fn new(timer_lock: TimerLockState) -> Self {
        let (tx, _) = broadcast::channel(128);
        Self {
            tx,
            client_count: Arc::new(RwLock::new(0)),
            timer_lock,
        }
    }

    pub fn broadcast(&self, msg: BroadcastMessage) {
        let _ = self.tx.send(msg);
    }

    pub async fn client_count(&self) -> usize {
        *self.client_count.read().await
    }

    pub async fn handle_connection(&self, socket: WebSocket, session: Option<WsSessionInfo>) {
        let mut rx = self.tx.subscribe();
        let (mut sender, mut receiver) = socket.split();
        let client_count = self.client_count.clone();
        let timer_lock = self.timer_lock.clone();

        *client_count.write().await += 1;

        // Pre-set department filter from session (Viewer/CrewLead)
        let initial_filter = session.as_ref().and_then(|s| s.dept_filter.clone());
        let sub_task_depts: Arc<RwLock<Option<HashSet<Uuid>>>> =
            Arc::new(RwLock::new(initial_filter));
        let sub_depts_writer = sub_task_depts.clone();

        // Spawn reader task to handle incoming client messages
        let read_task = tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        match client_msg {
                            ClientMessage::Subscribe { departments } => {
                                let filter = match departments {
                                    DeptFilter::All(_) => None,
                                    DeptFilter::Specific(ids) => {
                                        Some(ids.into_iter().collect())
                                    }
                                };
                                *sub_depts_writer.write().await = filter;
                            }
                        }
                    }
                }
            }
        });

        // Broadcast relay task
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    // Filter cues by department subscription
                    let filter = sub_task_depts.read().await;
                    let filtered_msg = if let Some(ref dept_ids) = *filter {
                        BroadcastMessage {
                            cues: msg
                                .cues
                                .iter()
                                .filter(|c| dept_ids.contains(&c.department_id))
                                .cloned()
                                .collect(),
                            ..msg
                        }
                    } else {
                        msg
                    };

                    let json = serde_json::to_string(&filtered_msg).unwrap_or_default();
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }

        read_task.abort();
        *client_count.write().await -= 1;

        // Auto-release timer lock if disconnected user held it
        if let Some(ref s) = session {
            let mut lock = timer_lock.write().await;
            if let Some(ref holder) = *lock {
                if holder.user_id == s.user_id {
                    info!("Timer lock auto-released — {} disconnected", s.user_name);
                    *lock = None;
                }
            }
        }
    }
}
