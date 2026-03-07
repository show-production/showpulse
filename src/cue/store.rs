use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::{Role, User};
use super::types::{Act, ContinueMode, Cue, CueImportError, CueImportResult, Department, ShowData};

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
        // Validate: reject paths with ".." to prevent directory traversal
        assert!(
            !file_path.components().any(|c| c == std::path::Component::ParentDir),
            "Data file path must not contain '..' segments"
        );

        // Canonicalize — resolve to absolute path within the working directory
        let canonical = if file_path.exists() {
            file_path.canonicalize().expect("Failed to canonicalize data file path")
        } else {
            let parent = file_path.parent().unwrap_or(std::path::Path::new("."));
            let parent_canon = if parent.as_os_str().is_empty() || parent == std::path::Path::new(".") {
                std::env::current_dir().expect("Cannot determine working directory")
            } else {
                parent.canonicalize().expect("Data file parent directory must exist")
            };
            parent_canon.join(file_path.file_name().expect("Data file must have a file name"))
        };

        let data = if canonical.exists() {
            match std::fs::read_to_string(&canonical) {
                Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
                Err(_) => ShowData::default(),
            }
        } else {
            ShowData::default()
        };

        Self {
            data: Arc::new(RwLock::new(data)),
            file_path: canonical,
        }
    }

    /// Atomic persist: write to .tmp file then rename to avoid corruption.
    async fn persist(&self) {
        let data = self.data.read().await;
        match serde_json::to_string_pretty(&*data) {
            Ok(json) => {
                let tmp_path = self.file_path.with_extension("json.tmp");
                if let Err(e) = tokio::fs::write(&tmp_path, &json).await {
                    tracing::error!("Failed to write temp file {:?}: {}", tmp_path, e);
                    return;
                }
                if let Err(e) = tokio::fs::rename(&tmp_path, &self.file_path).await {
                    tracing::error!("Failed to rename {:?} -> {:?}: {}", tmp_path, self.file_path, e);
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

    /// Sanitize all string fields, timecode, and optional color on a cue.
    fn sanitize_cue(cue: &mut Cue) {
        clamp_string(&mut cue.label);
        clamp_string(&mut cue.cue_number);
        clamp_string(&mut cue.notes);
        sanitize_timecode(&mut cue.trigger_tc);
        if let Some(ref color) = cue.color {
            let sanitized = sanitize_color(color);
            cue.color = Some(sanitized);
        }
        // Clamp post_wait to non-negative
        if let Some(pw) = cue.post_wait {
            if pw < 0.0 {
                cue.post_wait = Some(0.0);
            }
        }
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
            cue.duration = update.duration;
            cue.armed = update.armed;
            cue.color = update.color;
            cue.continue_mode = update.continue_mode;
            cue.post_wait = update.post_wait;
            cue.act_id = update.act_id;
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

    /// Populate store with demo departments, acts, and cues if it is empty.
    pub async fn seed_if_empty(&self) {
        let data = self.data.read().await;
        if !data.departments.is_empty() || !data.cues.is_empty() {
            return;
        }
        drop(data);

        use crate::timecode::types::Timecode;

        // Show name
        self.set_show_name("Demo Show — Live at Venue".to_string()).await;

        // 6 departments
        let departments = vec![
            ("Lighting",   "#ffcc00"),
            ("Sound",      "#00aaff"),
            ("Video",      "#ff44aa"),
            ("Pyro",       "#ff4400"),
            ("Automation", "#88ff44"),
            ("Stage Mgmt", "#aa66ff"),
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

        // 3 acts
        let act_pre   = self.create_act(Act { id: Uuid::nil(), name: "Pre-Show".to_string(),  sort_order: 1 }).await;
        let act_main  = self.create_act(Act { id: Uuid::nil(), name: "Main Show".to_string(), sort_order: 2 }).await;
        let act_close = self.create_act(Act { id: Uuid::nil(), name: "Closing".to_string(),   sort_order: 3 }).await;

        // Dept indices: 0=Lighting, 1=Sound, 2=Video, 3=Pyro, 4=Automation, 5=Stage Mgmt
        //                                                                                          continue      post
        // (dept, cue#,  label,                      tc,                   warn, dur,   armed, color,          mode,         wait, act,    notes)
        struct SeedCue {
            dept: usize, num: &'static str, label: &'static str, tc: Timecode, warn: u32,
            dur: Option<u32>, armed: bool, color: Option<&'static str>,
            cont: ContinueMode, pw: Option<f64>, act: Uuid, notes: &'static str,
        }

        let cues = vec![
            // ── Pre-Show ──
            SeedCue { dept: 5, num: "SM1",  label: "Standby — Places",           tc: Timecode::new(0, 0, 10, 0),  warn: 15, dur: None,     armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_pre.id, notes: "Call all departments to standby positions" },
            SeedCue { dept: 0, num: "LX1",  label: "House lights to 50%",         tc: Timecode::new(0, 0, 30, 0),  warn: 10, dur: Some(5),  armed: true,  color: None,             cont: ContinueMode::AutoContinue, pw: Some(3.0), act: act_pre.id, notes: "Gentle fade — audience settling" },
            SeedCue { dept: 1, num: "SND1", label: "Play opening music",          tc: Timecode::new(0, 0, 45, 0),  warn: 10, dur: Some(15), armed: true,  color: None,             cont: ContinueMode::AutoFollow,   pw: None,     act: act_pre.id, notes: "Track: Overture.wav — level -12dB" },
            SeedCue { dept: 0, num: "LX2",  label: "House lights out",            tc: Timecode::new(0, 1,  0, 0),  warn:  8, dur: Some(3),  armed: true,  color: Some("#ff8800"),  cont: ContinueMode::Stop,         pw: None,     act: act_pre.id, notes: "3-second fade to black" },
            SeedCue { dept: 2, num: "VID1", label: "Roll intro video",            tc: Timecode::new(0, 1,  5, 0),  warn:  5, dur: Some(25), armed: true,  color: None,             cont: ContinueMode::AutoFollow,   pw: None,     act: act_pre.id, notes: "1920x1080 ProRes — check projector focus" },

            // ── Main Show ──
            SeedCue { dept: 0, num: "LX3",  label: "Stage wash — blue",           tc: Timecode::new(0, 1, 30, 0),  warn: 10, dur: Some(30), armed: true,  color: Some("#0066ff"),  cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Full stage blue wash, movers to position 1" },
            SeedCue { dept: 4, num: "AUT1", label: "Raise main curtain",          tc: Timecode::new(0, 1, 35, 0),  warn:  8, dur: Some(12), armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Speed: medium — watch for snag sensor" },
            SeedCue { dept: 1, num: "SND2", label: "Mic check — lead vocal",      tc: Timecode::new(0, 2,  0, 0),  warn: 12, dur: None,     armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Open channel 1 — monitor wedge level +3dB" },
            SeedCue { dept: 3, num: "FX1",  label: "Pyro — stage left fountain",  tc: Timecode::new(0, 2, 30, 0),  warn: 15, dur: Some(4),  armed: true,  color: Some("#ff2200"),  cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Safety: confirm clear zone before arming" },
            SeedCue { dept: 0, num: "LX4",  label: "Spotlight — center stage",    tc: Timecode::new(0, 3,  0, 0),  warn: 10, dur: None,     armed: true,  color: None,             cont: ContinueMode::AutoContinue, pw: Some(2.0), act: act_main.id, notes: "Follow spot operator: pick up presenter at mark C" },
            SeedCue { dept: 2, num: "VID2", label: "IMAG camera 1 — wide",        tc: Timecode::new(0, 3, 15, 0),  warn:  5, dur: Some(15), armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Camera 1 on switcher PGM — dissolve transition" },
            SeedCue { dept: 1, num: "SND3", label: "Band track — verse 1",        tc: Timecode::new(0, 3, 30, 0),  warn:  8, dur: Some(45), armed: true,  color: None,             cont: ContinueMode::AutoFollow,   pw: None,     act: act_main.id, notes: "Track: MainBacking_v2.wav — sync to click" },
            SeedCue { dept: 3, num: "FX2",  label: "Pyro — confetti burst",       tc: Timecode::new(0, 4,  0, 0),  warn: 12, dur: Some(3),  armed: false, color: Some("#ff6600"),  cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "DISARMED — weather check needed for outdoor venue" },
            SeedCue { dept: 0, num: "LX5",  label: "Full stage — warm white",     tc: Timecode::new(0, 4, 30, 0),  warn: 10, dur: Some(60), armed: true,  color: Some("#ffdd88"),  cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "All fixtures warm white 3200K, intensity 80%" },
            SeedCue { dept: 4, num: "AUT2", label: "Lower mid-stage scrim",       tc: Timecode::new(0, 5,  0, 0),  warn: 10, dur: Some(8),  armed: true,  color: None,             cont: ContinueMode::AutoContinue, pw: Some(5.0), act: act_main.id, notes: "Scrim fly bar to trim 2 — speed slow" },
            SeedCue { dept: 2, num: "VID3", label: "Roll VT package — interview", tc: Timecode::new(0, 5, 30, 0),  warn:  8, dur: Some(90), armed: true,  color: None,             cont: ContinueMode::AutoFollow,   pw: None,     act: act_main.id, notes: "Pre-recorded segment — 1:30 duration, check audio embed" },
            SeedCue { dept: 1, num: "SND4", label: "Fade music out",              tc: Timecode::new(0, 6,  0, 0),  warn: 10, dur: Some(5),  armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "5-second fade, hold ambient bed at -30dB" },
            SeedCue { dept: 5, num: "SM2",  label: "Cue presenter — stage right", tc: Timecode::new(0, 6, 15, 0),  warn:  8, dur: None,     armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_main.id, notes: "Radio call: 'Presenter standby stage right'" },

            // ── Closing ──
            SeedCue { dept: 0, num: "LX6",  label: "Blackout",                    tc: Timecode::new(0, 7,  0, 0),  warn: 10, dur: Some(2),  armed: true,  color: Some("#220000"),  cont: ContinueMode::AutoContinue, pw: Some(1.0), act: act_close.id, notes: "Snap blackout — all fixtures to 0% in 0.5s" },
            SeedCue { dept: 4, num: "AUT3", label: "Lower main curtain",          tc: Timecode::new(0, 7,  5, 0),  warn:  5, dur: Some(10), armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_close.id, notes: "Full speed — tabs closing" },
            SeedCue { dept: 0, num: "LX7",  label: "House lights up",             tc: Timecode::new(0, 7, 30, 0),  warn: 10, dur: Some(8),  armed: true,  color: Some("#ffffcc"),  cont: ContinueMode::AutoFollow,   pw: None,     act: act_close.id, notes: "Fade to full house — 8-second ramp" },
            SeedCue { dept: 5, num: "SM3",  label: "All clear",                   tc: Timecode::new(0, 8,  0, 0),  warn: 10, dur: None,     armed: true,  color: None,             cont: ContinueMode::Stop,         pw: None,     act: act_close.id, notes: "Radio call: 'Show complete — all clear'" },
        ];

        for c in cues {
            self.create_cue(Cue {
                id: Uuid::nil(),
                department_id: dept_ids[c.dept],
                cue_number: c.num.to_string(),
                label: c.label.to_string(),
                trigger_tc: c.tc,
                warn_seconds: c.warn,
                notes: c.notes.to_string(),
                duration: c.dur,
                armed: c.armed,
                color: c.color.map(|s| s.to_string()),
                continue_mode: c.cont,
                post_wait: c.pw,
                act_id: Some(c.act),
            }).await;
        }
    }

    // --- Show name ---

    pub async fn get_show_name(&self) -> String {
        self.data.read().await.show_name.clone()
    }

    pub async fn set_show_name(&self, name: String) {
        let mut clamped = name;
        clamp_string(&mut clamped);
        self.data.write().await.show_name = clamped;
        self.persist().await;
    }

    // --- Acts ---

    pub async fn list_acts(&self) -> Vec<Act> {
        let mut acts = self.data.read().await.acts.clone();
        acts.sort_by_key(|a| a.sort_order);
        acts
    }

    pub async fn create_act(&self, mut act: Act) -> Act {
        act.id = Uuid::new_v4();
        clamp_string(&mut act.name);
        let mut data = self.data.write().await;
        // Auto-assign sort_order if not set
        if act.sort_order == 0 {
            act.sort_order = data.acts.len() as u32 + 1;
        }
        data.acts.push(act.clone());
        drop(data);
        self.persist().await;
        act
    }

    pub async fn update_act(&self, id: Uuid, mut update: Act) -> Option<Act> {
        clamp_string(&mut update.name);
        let mut data = self.data.write().await;
        if let Some(act) = data.acts.iter_mut().find(|a| a.id == id) {
            act.name = update.name;
            act.sort_order = update.sort_order;
            let result = act.clone();
            drop(data);
            self.persist().await;
            Some(result)
        } else {
            None
        }
    }

    pub async fn delete_act(&self, id: Uuid) -> bool {
        let mut data = self.data.write().await;
        let len_before = data.acts.len();
        data.acts.retain(|a| a.id != id);
        // Unassign cues from deleted act
        for cue in &mut data.cues {
            if cue.act_id == Some(id) {
                cue.act_id = None;
            }
        }
        let deleted = data.acts.len() < len_before;
        drop(data);
        if deleted {
            self.persist().await;
        }
        deleted
    }

    /// Shift all cues in an act so the earliest cue starts at `new_start`.
    /// Uses 30fps for frame math (delta is relative, so rate doesn't affect the offset).
    pub async fn shift_act(&self, act_id: Uuid, new_start: crate::timecode::types::Timecode) -> bool {
        use crate::timecode::types::FrameRate;
        let rate = FrameRate::Fps30;
        let mut data = self.data.write().await;
        let act_cues: Vec<usize> = data.cues.iter().enumerate()
            .filter(|(_, c)| c.act_id == Some(act_id))
            .map(|(i, _)| i)
            .collect();

        if act_cues.is_empty() {
            return false;
        }

        let earliest_frames = act_cues.iter()
            .map(|&i| data.cues[i].trigger_tc.to_total_frames(rate))
            .min()
            .unwrap_or(0);

        let new_start_frames = new_start.to_total_frames(rate);
        let delta = new_start_frames as i64 - earliest_frames as i64;

        for &i in &act_cues {
            let old_frames = data.cues[i].trigger_tc.to_total_frames(rate) as i64;
            let new_frames = (old_frames + delta).max(0) as u32;
            data.cues[i].trigger_tc = crate::timecode::types::Timecode::from_total_frames(new_frames, rate);
        }

        drop(data);
        self.persist().await;
        true
    }

    // --- Users ---

    pub async fn has_users(&self) -> bool {
        !self.data.read().await.users.is_empty()
    }

    pub async fn user_count(&self) -> usize {
        self.data.read().await.users.len()
    }

    pub async fn list_users(&self) -> Vec<User> {
        self.data.read().await.users.clone()
    }

    /// Find a user by name (PIN verification is done by the caller).
    pub async fn find_user_by_name(&self, name: &str) -> Option<User> {
        let data = self.data.read().await;
        data.users.iter().find(|u| u.name == name).cloned()
    }

    pub async fn get_user(&self, id: Uuid) -> Option<User> {
        let data = self.data.read().await;
        data.users.iter().find(|u| u.id == id).cloned()
    }

    pub async fn create_user(&self, mut user: User) -> User {
        use crate::auth::{hash_pin, is_hashed};
        user.id = Uuid::new_v4();
        clamp_string(&mut user.name);
        // Hash PIN if not already hashed
        if !is_hashed(&user.pin) {
            user.pin = hash_pin(&user.pin);
        }
        let mut data = self.data.write().await;
        data.users.push(user.clone());
        drop(data);
        self.persist().await;
        user
    }

    pub async fn update_user(&self, id: Uuid, mut update: User) -> Option<User> {
        use crate::auth::{hash_pin, is_hashed};
        clamp_string(&mut update.name);
        let mut data = self.data.write().await;
        if let Some(user) = data.users.iter_mut().find(|u| u.id == id) {
            user.name = update.name;
            if !update.pin.is_empty() {
                // Hash PIN if not already hashed
                user.pin = if is_hashed(&update.pin) {
                    update.pin
                } else {
                    hash_pin(&update.pin)
                };
            }
            user.role = update.role;
            user.departments = update.departments;
            let result = user.clone();
            drop(data);
            self.persist().await;
            Some(result)
        } else {
            None
        }
    }

    pub async fn delete_user(&self, id: Uuid) -> bool {
        let mut data = self.data.write().await;
        let len_before = data.users.len();
        data.users.retain(|u| u.id != id);
        let deleted = data.users.len() < len_before;
        if deleted {
            drop(data);
            self.persist().await;
        }
        deleted
    }

    /// Create a default admin user from SHOWPULSE_PIN if no users exist yet.
    /// The PIN is hashed before storage.
    pub async fn seed_admin_user(&self, pin: &str) {
        let data = self.data.read().await;
        if !data.users.is_empty() {
            return;
        }
        drop(data);
        // create_user will hash the PIN
        self.create_user(User {
            id: Uuid::new_v4(),
            name: "admin".to_string(),
            pin: pin.to_string(),
            role: Role::Admin,
            departments: Vec::new(),
        }).await;
        tracing::info!("Seeded default admin user from SHOWPULSE_PIN");
    }

    /// Migrate any plaintext PINs to argon2 hashes. Called once at startup.
    pub async fn migrate_plaintext_pins(&self) {
        use crate::auth::{hash_pin, is_hashed};
        let mut data = self.data.write().await;
        let mut migrated = 0;
        for user in data.users.iter_mut() {
            if !is_hashed(&user.pin) {
                user.pin = hash_pin(&user.pin);
                migrated += 1;
            }
        }
        if migrated > 0 {
            drop(data);
            self.persist().await;
            tracing::info!("Migrated {} plaintext PIN(s) to argon2 hashes", migrated);
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
            duration: None,
            armed: true,
            color: None,
            continue_mode: ContinueMode::Stop,
            post_wait: None,
            act_id: None,
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
