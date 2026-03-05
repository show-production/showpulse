use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::types::{Cue, Department, ShowData};

/// In-memory store with JSON file persistence.
pub struct CueStore {
    data: Arc<RwLock<ShowData>>,
    file_path: PathBuf,
}

impl CueStore {
    pub fn new(file_path: PathBuf) -> Self {
        let data = if file_path.exists() {
            match std::fs::read_to_string(&file_path) {
                Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
                Err(_) => ShowData::default(),
            }
        } else {
            ShowData::default()
        };

        Self {
            data: Arc::new(RwLock::new(data)),
            file_path,
        }
    }

    async fn persist(&self) {
        let data = self.data.read().await;
        if let Ok(json) = serde_json::to_string_pretty(&*data) {
            let _ = tokio::fs::write(&self.file_path, json).await;
        }
    }

    // --- Departments ---

    pub async fn list_departments(&self) -> Vec<Department> {
        self.data.read().await.departments.clone()
    }

    pub async fn get_department(&self, id: Uuid) -> Option<Department> {
        self.data.read().await.departments.iter().find(|d| d.id == id).cloned()
    }

    pub async fn create_department(&self, mut dept: Department) -> Department {
        dept.id = Uuid::new_v4();
        self.data.write().await.departments.push(dept.clone());
        self.persist().await;
        dept
    }

    pub async fn update_department(&self, id: Uuid, update: Department) -> Option<Department> {
        let mut data = self.data.write().await;
        if let Some(dept) = data.departments.iter_mut().find(|d| d.id == id) {
            dept.name = update.name;
            dept.color = update.color;
            let result = dept.clone();
            drop(data);
            self.persist().await;
            Some(result)
        } else {
            None
        }
    }

    pub async fn delete_department(&self, id: Uuid) -> bool {
        let mut data = self.data.write().await;
        let len_before = data.departments.len();
        data.departments.retain(|d| d.id != id);
        data.cues.retain(|c| c.department_id != id);
        let deleted = data.departments.len() < len_before;
        drop(data);
        if deleted {
            self.persist().await;
        }
        deleted
    }

    // --- Cues ---

    pub async fn list_cues(&self, department_id: Option<Uuid>) -> Vec<Cue> {
        let data = self.data.read().await;
        let mut cues: Vec<Cue> = match department_id {
            Some(did) => data.cues.iter().filter(|c| c.department_id == did).cloned().collect(),
            None => data.cues.clone(),
        };
        cues.sort_by(|a, b| a.trigger_tc.cmp(&b.trigger_tc));
        cues
    }

    pub async fn get_cue(&self, id: Uuid) -> Option<Cue> {
        self.data.read().await.cues.iter().find(|c| c.id == id).cloned()
    }

    pub async fn create_cue(&self, mut cue: Cue) -> Cue {
        cue.id = Uuid::new_v4();
        self.data.write().await.cues.push(cue.clone());
        self.persist().await;
        cue
    }

    pub async fn update_cue(&self, id: Uuid, update: Cue) -> Option<Cue> {
        let mut data = self.data.write().await;
        if let Some(cue) = data.cues.iter_mut().find(|c| c.id == id) {
            cue.department_id = update.department_id;
            cue.label = update.label;
            cue.trigger_tc = update.trigger_tc;
            cue.warn_seconds = update.warn_seconds;
            cue.notes = update.notes;
            let result = cue.clone();
            drop(data);
            self.persist().await;
            Some(result)
        } else {
            None
        }
    }

    pub async fn delete_cue(&self, id: Uuid) -> bool {
        let mut data = self.data.write().await;
        let len_before = data.cues.len();
        data.cues.retain(|c| c.id != id);
        let deleted = data.cues.len() < len_before;
        drop(data);
        if deleted {
            self.persist().await;
        }
        deleted
    }

    pub async fn show_data(&self) -> ShowData {
        self.data.read().await.clone()
    }
}
