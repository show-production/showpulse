use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::types::{Cue, CueImportError, CueImportResult, Department, ShowData};

/// Maximum allowed length for string fields (names, labels, notes).
const MAX_STRING_LEN: usize = 500;

/// Truncate a string to MAX_STRING_LEN to prevent memory abuse.
fn clamp_string(s: &mut String) {
    if s.len() > MAX_STRING_LEN {
        // Truncate at a char boundary
        let mut end = MAX_STRING_LEN;
        while !s.is_char_boundary(end) && end > 0 {
            end -= 1;
        }
        s.truncate(end);
    }
}

/// Validate and normalize a hex color string. Returns a sanitized "#rrggbb" or a default.
fn sanitize_color(color: &str) -> String {
    let trimmed = color.trim();
    let hex = trimmed.strip_prefix('#').unwrap_or(trimmed);
    if hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        format!("#{hex}")
    } else if hex.len() == 3 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        // Expand shorthand #rgb → #rrggbb
        let expanded: String = hex.chars().flat_map(|c| [c, c]).collect();
        format!("#{expanded}")
    } else {
        "#888888".to_string()
    }
}

/// Clamp timecode fields to valid ranges.
fn sanitize_timecode(tc: &mut super::super::timecode::types::Timecode) {
    if tc.hours > 23 { tc.hours = 23; }
    if tc.minutes > 59 { tc.minutes = 59; }
    if tc.seconds > 59 { tc.seconds = 59; }
    if tc.frames > 29 { tc.frames = 29; }
}

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
        match serde_json::to_string_pretty(&*data) {
            Ok(json) => {
                if let Err(e) = tokio::fs::write(&self.file_path, json).await {
                    tracing::error!("Failed to write data file {:?}: {}", self.file_path, e);
                }
            }
            Err(e) => {
                tracing::error!("Failed to serialize show data: {}", e);
            }
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
        clamp_string(&mut dept.name);
        dept.color = sanitize_color(&dept.color);
        self.data.write().await.departments.push(dept.clone());
        self.persist().await;
        dept
    }

    pub async fn update_department(&self, id: Uuid, mut update: Department) -> Option<Department> {
        clamp_string(&mut update.name);
        update.color = sanitize_color(&update.color);
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

    /// Sanitize all string fields and timecode on a cue.
    fn sanitize_cue(cue: &mut Cue) {
        clamp_string(&mut cue.label);
        clamp_string(&mut cue.cue_number);
        clamp_string(&mut cue.notes);
        sanitize_timecode(&mut cue.trigger_tc);
    }

    pub async fn create_cue(&self, mut cue: Cue) -> Cue {
        cue.id = Uuid::new_v4();
        Self::sanitize_cue(&mut cue);
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
            Self::sanitize_cue(&mut cue);
            valid_cues.push(cue);
            imported += 1;
        }

        // Always replace — clear old cues even if some/all failed validation
        let mut data = self.data.write().await;
        data.cues = valid_cues;
        drop(data);
        self.persist().await;

        CueImportResult { imported, errors }
    }

    /// Replace the entire show (departments + cues) atomically.
    pub async fn replace_show(&self, departments: Vec<Department>, cues: Vec<Cue>) -> CueImportResult {
        let mut sanitized_depts = departments;
        for dept in &mut sanitized_depts {
            clamp_string(&mut dept.name);
            dept.color = sanitize_color(&dept.color);
        }

        let dept_ids: std::collections::HashSet<Uuid> = sanitized_depts.iter().map(|d| d.id).collect();

        let mut imported = 0;
        let mut errors = Vec::new();
        let mut valid_cues = Vec::new();

        for (index, mut cue) in cues.into_iter().enumerate() {
            if !dept_ids.contains(&cue.department_id) {
                errors.push(CueImportError {
                    index,
                    message: format!(
                        "department_id {} does not match any department in import",
                        cue.department_id
                    ),
                });
                continue;
            }
            cue.id = Uuid::new_v4();
            Self::sanitize_cue(&mut cue);
            valid_cues.push(cue);
            imported += 1;
        }

        let mut data = self.data.write().await;
        data.departments = sanitized_depts;
        data.cues = valid_cues;
        drop(data);
        self.persist().await;

        CueImportResult { imported, errors }
    }

    pub async fn update_cue(&self, id: Uuid, mut update: Cue) -> Option<Cue> {
        Self::sanitize_cue(&mut update);
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

    /// Get the file path (for testing).
    pub fn file_path(&self) -> &std::path::Path {
        &self.file_path
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cue::types::{Cue, Department};
    use crate::timecode::types::Timecode;
    use tempfile::NamedTempFile;

    fn test_store() -> CueStore {
        let tmp = NamedTempFile::new().unwrap();
        CueStore::new(tmp.path().to_path_buf())
    }

    fn make_dept(name: &str) -> Department {
        Department {
            id: Uuid::nil(),
            name: name.to_string(),
            color: "#ff0000".to_string(),
        }
    }

    fn make_cue(dept_id: Uuid, label: &str, tc: Timecode) -> Cue {
        Cue {
            id: Uuid::nil(),
            department_id: dept_id,
            cue_number: String::new(),
            label: label.to_string(),
            trigger_tc: tc,
            warn_seconds: 10,
            notes: String::new(),
        }
    }

    // ── Department CRUD ──

    #[tokio::test]
    async fn create_and_list_departments() {
        let store = test_store();
        assert!(store.list_departments().await.is_empty());

        let dept = store.create_department(make_dept("Lighting")).await;
        assert_ne!(dept.id, Uuid::nil());
        assert_eq!(dept.name, "Lighting");

        let all = store.list_departments().await;
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "Lighting");
    }

    #[tokio::test]
    async fn get_department() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        assert!(store.get_department(dept.id).await.is_some());
        assert!(store.get_department(Uuid::new_v4()).await.is_none());
    }

    #[tokio::test]
    async fn update_department() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        let updated = store
            .update_department(
                dept.id,
                Department {
                    id: dept.id,
                    name: "Audio".to_string(),
                    color: "#00ff00".to_string(),
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.name, "Audio");
        assert_eq!(updated.color, "#00ff00");
    }

    #[tokio::test]
    async fn update_nonexistent_department_returns_none() {
        let store = test_store();
        let result = store
            .update_department(Uuid::new_v4(), make_dept("Ghost"))
            .await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn delete_department() {
        let store = test_store();
        let dept = store.create_department(make_dept("Video")).await;
        assert!(store.delete_department(dept.id).await);
        assert!(store.list_departments().await.is_empty());
    }

    #[tokio::test]
    async fn delete_nonexistent_department_returns_false() {
        let store = test_store();
        assert!(!store.delete_department(Uuid::new_v4()).await);
    }

    #[tokio::test]
    async fn delete_department_cascades_to_cues() {
        let store = test_store();
        let dept = store.create_department(make_dept("Pyro")).await;

        store
            .create_cue(make_cue(dept.id, "Blast", Timecode::new(0, 0, 10, 0)))
            .await;
        store
            .create_cue(make_cue(dept.id, "Spark", Timecode::new(0, 0, 20, 0)))
            .await;
        assert_eq!(store.list_cues(None).await.len(), 2);

        store.delete_department(dept.id).await;
        assert!(store.list_cues(None).await.is_empty());
    }

    // ── Cue CRUD ──

    #[tokio::test]
    async fn create_and_list_cues() {
        let store = test_store();
        let dept = store.create_department(make_dept("Lighting")).await;

        let cue = store
            .create_cue(make_cue(dept.id, "Fade up", Timecode::new(0, 0, 5, 0)))
            .await;
        assert_ne!(cue.id, Uuid::nil());

        let all = store.list_cues(None).await;
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].label, "Fade up");
    }

    #[tokio::test]
    async fn get_cue() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;
        let cue = store
            .create_cue(make_cue(dept.id, "Play", Timecode::ZERO))
            .await;

        assert!(store.get_cue(cue.id).await.is_some());
        assert!(store.get_cue(Uuid::new_v4()).await.is_none());
    }

    #[tokio::test]
    async fn update_cue() {
        let store = test_store();
        let dept = store.create_department(make_dept("Video")).await;
        let cue = store
            .create_cue(make_cue(dept.id, "Roll VT", Timecode::ZERO))
            .await;

        let mut update = cue.clone();
        update.label = "Roll package".to_string();
        update.trigger_tc = Timecode::new(0, 1, 0, 0);
        let updated = store.update_cue(cue.id, update).await.unwrap();

        assert_eq!(updated.label, "Roll package");
        assert_eq!(updated.trigger_tc, Timecode::new(0, 1, 0, 0));
    }

    #[tokio::test]
    async fn delete_cue() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;
        let cue = store
            .create_cue(make_cue(dept.id, "Play", Timecode::ZERO))
            .await;

        assert!(store.delete_cue(cue.id).await);
        assert!(store.list_cues(None).await.is_empty());
    }

    #[tokio::test]
    async fn delete_nonexistent_cue_returns_false() {
        let store = test_store();
        assert!(!store.delete_cue(Uuid::new_v4()).await);
    }

    // ── Cue list: filtering and sorting ──

    #[tokio::test]
    async fn list_cues_filtered_by_department() {
        let store = test_store();
        let d1 = store.create_department(make_dept("Lighting")).await;
        let d2 = store.create_department(make_dept("Sound")).await;

        store
            .create_cue(make_cue(d1.id, "L1", Timecode::new(0, 0, 10, 0)))
            .await;
        store
            .create_cue(make_cue(d2.id, "S1", Timecode::new(0, 0, 20, 0)))
            .await;
        store
            .create_cue(make_cue(d1.id, "L2", Timecode::new(0, 0, 30, 0)))
            .await;

        let lighting = store.list_cues(Some(d1.id)).await;
        assert_eq!(lighting.len(), 2);
        assert!(lighting.iter().all(|c| c.department_id == d1.id));

        let sound = store.list_cues(Some(d2.id)).await;
        assert_eq!(sound.len(), 1);
    }

    #[tokio::test]
    async fn list_cues_sorted_by_trigger_tc() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        // Insert out of order
        store
            .create_cue(make_cue(dept.id, "Third", Timecode::new(0, 0, 30, 0)))
            .await;
        store
            .create_cue(make_cue(dept.id, "First", Timecode::new(0, 0, 10, 0)))
            .await;
        store
            .create_cue(make_cue(dept.id, "Second", Timecode::new(0, 0, 20, 0)))
            .await;

        let cues = store.list_cues(None).await;
        assert_eq!(cues[0].label, "First");
        assert_eq!(cues[1].label, "Second");
        assert_eq!(cues[2].label, "Third");
    }

    // ── Auto-generated cue numbers ──

    #[tokio::test]
    async fn auto_generated_cue_numbers() {
        let store = test_store();
        let dept = store.create_department(make_dept("Lighting")).await;

        let c1 = store
            .create_cue(make_cue(dept.id, "A", Timecode::ZERO))
            .await;
        let c2 = store
            .create_cue(make_cue(dept.id, "B", Timecode::ZERO))
            .await;
        let c3 = store
            .create_cue(make_cue(dept.id, "C", Timecode::ZERO))
            .await;

        assert_eq!(c1.cue_number, "Q1");
        assert_eq!(c2.cue_number, "Q2");
        assert_eq!(c3.cue_number, "Q3");
    }

    #[tokio::test]
    async fn custom_cue_number_preserved() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        let mut cue = make_cue(dept.id, "Custom", Timecode::ZERO);
        cue.cue_number = "C99".to_string();
        let created = store.create_cue(cue).await;
        assert_eq!(created.cue_number, "C99");
    }

    // ── Bulk import ──

    #[tokio::test]
    async fn import_cues_replaces_existing() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        // Create initial cues
        store
            .create_cue(make_cue(dept.id, "Old", Timecode::ZERO))
            .await;
        assert_eq!(store.list_cues(None).await.len(), 1);

        // Import replaces
        let new_cues = vec![
            make_cue(dept.id, "New1", Timecode::new(0, 0, 10, 0)),
            make_cue(dept.id, "New2", Timecode::new(0, 0, 20, 0)),
        ];
        let result = store.import_cues(new_cues).await;
        assert_eq!(result.imported, 2);
        assert!(result.errors.is_empty());

        let cues = store.list_cues(None).await;
        assert_eq!(cues.len(), 2);
        // Old cue should be gone
        assert!(!cues.iter().any(|c| c.label == "Old"));
    }

    #[tokio::test]
    async fn import_cues_invalid_department_id() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;
        let bad_id = Uuid::new_v4();

        let cues = vec![
            make_cue(dept.id, "Valid", Timecode::ZERO),
            make_cue(bad_id, "Invalid", Timecode::ZERO),
        ];
        let result = store.import_cues(cues).await;
        assert_eq!(result.imported, 1);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].index, 1);
    }

    #[tokio::test]
    async fn import_cues_all_invalid() {
        let store = test_store();
        store.create_department(make_dept("Sound")).await;

        let cues = vec![
            make_cue(Uuid::new_v4(), "Bad1", Timecode::ZERO),
            make_cue(Uuid::new_v4(), "Bad2", Timecode::ZERO),
        ];
        let result = store.import_cues(cues).await;
        assert_eq!(result.imported, 0);
        assert_eq!(result.errors.len(), 2);
        assert!(store.list_cues(None).await.is_empty());
    }

    #[tokio::test]
    async fn import_cues_empty() {
        let store = test_store();
        let dept = store.create_department(make_dept("Sound")).await;

        // Pre-populate
        store
            .create_cue(make_cue(dept.id, "Old", Timecode::ZERO))
            .await;

        // Import empty list still replaces
        let result = store.import_cues(Vec::new()).await;
        assert_eq!(result.imported, 0);
        assert!(result.errors.is_empty());
        assert!(store.list_cues(None).await.is_empty());
    }

    // ── JSON persistence round-trip ──

    #[tokio::test]
    async fn persistence_roundtrip() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();

        // Create store with data
        {
            let store = CueStore::new(path.clone());
            let dept = store.create_department(make_dept("Lighting")).await;
            store
                .create_cue(make_cue(dept.id, "Fade", Timecode::new(0, 1, 0, 0)))
                .await;
        }

        // Reload from file
        let store2 = CueStore::new(path);
        let depts = store2.list_departments().await;
        assert_eq!(depts.len(), 1);
        assert_eq!(depts[0].name, "Lighting");

        let cues = store2.list_cues(None).await;
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].label, "Fade");
        assert_eq!(cues[0].trigger_tc, Timecode::new(0, 1, 0, 0));
    }

    // ── Seed ──

    #[tokio::test]
    async fn seed_if_empty_populates_data() {
        let store = test_store();
        store.seed_if_empty().await;

        let depts = store.list_departments().await;
        assert_eq!(depts.len(), 6);

        let cues = store.list_cues(None).await;
        assert_eq!(cues.len(), 22);
    }

    #[tokio::test]
    async fn seed_if_empty_does_not_overwrite() {
        let store = test_store();
        store.create_department(make_dept("Custom")).await;
        store.seed_if_empty().await;

        let depts = store.list_departments().await;
        assert_eq!(depts.len(), 1);
        assert_eq!(depts[0].name, "Custom");
    }

    // ── Replace show ──

    #[tokio::test]
    async fn replace_show() {
        let store = test_store();
        let old_dept = store.create_department(make_dept("Old")).await;
        store
            .create_cue(make_cue(old_dept.id, "OldCue", Timecode::ZERO))
            .await;

        let new_dept_id = Uuid::new_v4();
        let new_depts = vec![Department {
            id: new_dept_id,
            name: "New".to_string(),
            color: "#00ff00".to_string(),
        }];
        let new_cues = vec![make_cue(new_dept_id, "NewCue", Timecode::new(0, 0, 5, 0))];

        let result = store.replace_show(new_depts, new_cues).await;
        assert_eq!(result.imported, 1);
        assert!(result.errors.is_empty());

        let depts = store.list_departments().await;
        assert_eq!(depts.len(), 1);
        assert_eq!(depts[0].name, "New");

        let cues = store.list_cues(None).await;
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].label, "NewCue");
    }
}
