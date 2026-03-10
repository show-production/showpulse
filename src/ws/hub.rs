use axum::extract::ws::{CloseFrame, Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{broadcast, oneshot, RwLock};
use tokio::time::Instant;
use tracing::info;
use uuid::Uuid;

use crate::auth::{Role, TimerLockState};
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
    pub role: Role,
    /// Pre-set department filter for Viewer/CrewLead users.
    pub dept_filter: Option<HashSet<Uuid>>,
}

/// Snapshot of a connected client for the admin dashboard.
#[derive(Clone)]
pub struct ConnectedClient {
    pub user_id: Option<Uuid>,
    pub user_name: Option<String>,
    pub role: Option<Role>,
    pub connected_at: Instant,
}

/// Tracks connected clients and broadcasts timecode/cue state.
pub struct WsHub {
    tx: broadcast::Sender<BroadcastMessage>,
    clients: Arc<RwLock<HashMap<Uuid, ConnectedClient>>>,
    /// Per-connection kick channels for single-instance enforcement.
    kick_channels: Arc<RwLock<HashMap<Uuid, oneshot::Sender<()>>>>,
    timer_lock: TimerLockState,
}

impl WsHub {
    pub fn new(timer_lock: TimerLockState) -> Self {
        let (tx, _) = broadcast::channel(128);
        Self {
            tx,
            clients: Arc::new(RwLock::new(HashMap::new())),
            kick_channels: Arc::new(RwLock::new(HashMap::new())),
            timer_lock,
        }
    }

    pub fn broadcast(&self, msg: BroadcastMessage) {
        let _ = self.tx.send(msg);
    }

    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    /// Return a snapshot of all connected clients for the admin dashboard.
    pub async fn list_clients(&self) -> Vec<ConnectedClient> {
        self.clients.read().await.values().cloned().collect()
    }

    pub async fn handle_connection(&self, socket: WebSocket, session: Option<WsSessionInfo>) {
        let mut rx = self.tx.subscribe();
        let (mut sender, mut receiver) = socket.split();
        let clients = self.clients.clone();
        let kick_channels = self.kick_channels.clone();
        let timer_lock = self.timer_lock.clone();

        let conn_id = Uuid::new_v4();
        let client = ConnectedClient {
            user_id: session.as_ref().map(|s| s.user_id),
            user_name: session.as_ref().map(|s| s.user_name.clone()),
            role: session.as_ref().map(|s| s.role),
            connected_at: Instant::now(),
        };

        // Single-instance enforcement: kick existing WS connections for this user
        if let Some(ref s) = session {
            let clients_read = clients.read().await;
            let existing: Vec<Uuid> = clients_read
                .iter()
                .filter(|(_, c)| c.user_id == Some(s.user_id))
                .map(|(id, _)| *id)
                .collect();
            drop(clients_read);

            if !existing.is_empty() {
                info!(
                    "Kicking {} existing connection(s) for user {}",
                    existing.len(),
                    s.user_name
                );
                let mut kicks = kick_channels.write().await;
                for old_id in existing {
                    if let Some(tx) = kicks.remove(&old_id) {
                        let _ = tx.send(());
                    }
                }
            }
        }

        clients.write().await.insert(conn_id, client);

        // Create kick channel for this connection
        let (kick_tx, mut kick_rx) = oneshot::channel::<()>();
        kick_channels.write().await.insert(conn_id, kick_tx);

        // Pre-set department filter from session (Viewer/CrewLead)
        let initial_filter = session.as_ref().and_then(|s| s.dept_filter.clone());
        let sub_task_depts: Arc<RwLock<Option<HashSet<Uuid>>>> =
            Arc::new(RwLock::new(initial_filter));
        let sub_depts_writer = sub_task_depts.clone();

        // Spawn reader task to handle incoming client messages
        let mut read_task = tokio::spawn(async move {
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
            // Returns when client disconnects
        });

        // Broadcast relay task — exits when client disconnects, broadcast fails, or kicked
        loop {
            tokio::select! {
                result = rx.recv() => {
                    match result {
                        Ok(msg) => {
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
                _ = &mut read_task => {
                    // Client disconnected — read stream ended
                    break;
                }
                _ = &mut kick_rx => {
                    // Kicked: another connection for this user replaced us
                    let _ = sender.send(Message::Close(Some(CloseFrame {
                        code: 4001,
                        reason: "session_replaced".into(),
                    }))).await;
                    break;
                }
            }
        }

        // Cleanup
        kick_channels.write().await.remove(&conn_id);
        clients.write().await.remove(&conn_id);

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
