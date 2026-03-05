use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::types::{Cue, CueImportError, CueImportResult, Department, ShowData};

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
        if cue.cue_number.is_empty() {
            let data = self.data.read().await;
            let next = data.cues.len() + 1;
            drop(data);
            cue.cue_number = format!("Q{next}");
        }
        self.data.write().await.cues.push(cue.clone());
        self.persist().await;
        cue
    }

    pub async fn import_cues(&self, cues: Vec<Cue>) -> CueImportResult {
        let dept_ids: std::collections::HashSet<Uuid> = self
            .data
            .read()
            .await
            .departments
            .iter()
            .map(|d| d.id)
            .collect();

        let mut imported = 0;
        let mut errors = Vec::new();
        let mut valid_cues = Vec::new();

        for (index, mut cue) in cues.into_iter().enumerate() {
            if !dept_ids.contains(&cue.department_id) {
                errors.push(CueImportError {
                    index,
                    message: format!(
                        "department_id {} does not match any existing department",
                        cue.department_id
                    ),
                });
                continue;
            }
            cue.id = Uuid::new_v4();
            valid_cues.push(cue);
            imported += 1;
        }

        if imported > 0 {
            let mut data = self.data.write().await;
            data.cues = valid_cues;
            drop(data);
            self.persist().await;
        }

        CueImportResult { imported, errors }
    }

    pub async fn update_cue(&self, id: Uuid, update: Cue) -> Option<Cue> {
        let mut data = self.data.write().await;
        if let Some(cue) = data.cues.iter_mut().find(|c| c.id == id) {
            cue.department_id = update.department_id;
            cue.cue_number = update.cue_number;
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

    /// Populate store with demo departments and cues if it is empty.
    pub async fn seed_if_empty(&self) {
        let data = self.data.read().await;
        if !data.departments.is_empty() || !data.cues.is_empty() {
            return;
        }
        drop(data);

        use crate::timecode::types::Timecode;

        // 6 departments
        let departments = vec![
            ("Lighting",  "#ffcc00"),
            ("Sound",     "#00aaff"),
            ("Video",     "#ff44aa"),
            ("Pyro",      "#ff4400"),
            ("Automation","#88ff44"),
            ("Stage Mgmt","#aa66ff"),
        ];

        let mut dept_ids = Vec::new();
        for (name, color) in &departments {
            let dept = self.create_department(Department {
                id: Uuid::nil(),
                name: name.to_string(),
                color: color.to_string(),
            }).await;
            dept_ids.push(dept.id);
        }

        // Mock cues spread across the show timeline
        let cues: Vec<(usize, &str, Timecode, u32)> = vec![
            // (dept_index, label, trigger_tc, warn_seconds)
            (5, "Standby — Places",            Timecode::new(0, 0, 10, 0),  15),
            (0, "House lights to 50%",          Timecode::new(0, 0, 30, 0),  10),
            (1, "Play opening music",           Timecode::new(0, 0, 45, 0),  10),
            (0, "House lights out",             Timecode::new(0, 1,  0, 0),   8),
            (2, "Roll intro video",             Timecode::new(0, 1,  5, 0),   5),
            (0, "Stage wash — blue",            Timecode::new(0, 1, 30, 0),  10),
            (4, "Raise main curtain",           Timecode::new(0, 1, 35, 0),   8),
            (1, "Mic check — lead vocal",       Timecode::new(0, 2,  0, 0),  12),
            (3, "Pyro — stage left fountain",   Timecode::new(0, 2, 30, 0),  15),
            (0, "Spotlight — center stage",     Timecode::new(0, 3,  0, 0),  10),
            (2, "IMAG camera 1 — wide",         Timecode::new(0, 3, 15, 0),   5),
            (1, "Band track — verse 1",         Timecode::new(0, 3, 30, 0),   8),
            (3, "Pyro — confetti burst",        Timecode::new(0, 4,  0, 0),  12),
            (0, "Full stage — warm white",      Timecode::new(0, 4, 30, 0),  10),
            (4, "Lower mid-stage scrim",        Timecode::new(0, 5,  0, 0),  10),
            (2, "Roll VT package — interview",  Timecode::new(0, 5, 30, 0),   8),
            (1, "Fade music out",               Timecode::new(0, 6,  0, 0),  10),
            (5, "Cue presenter — stage right",  Timecode::new(0, 6, 15, 0),   8),
            (0, "Blackout",                     Timecode::new(0, 7,  0, 0),  10),
            (4, "Lower main curtain",           Timecode::new(0, 7,  5, 0),   5),
            (0, "House lights up",              Timecode::new(0, 7, 30, 0),  10),
            (5, "All clear",                    Timecode::new(0, 8,  0, 0),  10),
        ];

        for (dept_idx, label, tc, warn) in cues {
            self.create_cue(Cue {
                id: Uuid::nil(),
                department_id: dept_ids[dept_idx],
                cue_number: String::new(),
                label: label.to_string(),
                trigger_tc: tc,
                warn_seconds: warn,
                notes: String::new(),
            }).await;
        }
    }
}
