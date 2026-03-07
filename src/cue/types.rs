use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::User;
use crate::timecode::types::Timecode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Department {
    pub id: Uuid,
    pub name: String,
    pub color: String, // hex color, e.g. "#ff0000"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Act {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub sort_order: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContinueMode {
    Stop,
    AutoContinue,
    AutoFollow,
}

impl Default for ContinueMode {
    fn default() -> Self {
        Self::Stop
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cue {
    #[serde(default)]
    pub id: Uuid,
    pub department_id: Uuid,
    #[serde(default)]
    pub cue_number: String,
    #[serde(default = "default_cue_label")]
    pub label: String,
    #[serde(default)]
    pub trigger_tc: Timecode,
    #[serde(default = "default_warn_seconds")]
    pub warn_seconds: u32,
    #[serde(default)]
    pub notes: String,
    /// Duration in seconds. None = instantaneous (point cue).
    #[serde(default)]
    pub duration: Option<u32>,
    /// Disarmed cues are skipped by the countdown engine.
    #[serde(default = "default_true")]
    pub armed: bool,
    /// Per-cue color override. None = use department color.
    #[serde(default)]
    pub color: Option<String>,
    /// What happens after this cue triggers.
    #[serde(default)]
    pub continue_mode: ContinueMode,
    /// Seconds before auto-continuing to next cue (only with AutoContinue).
    #[serde(default)]
    pub post_wait: Option<f64>,
    /// Act this cue belongs to. None = unassigned.
    #[serde(default)]
    pub act_id: Option<Uuid>,
}

fn default_cue_label() -> String {
    "Untitled Cue".to_string()
}

fn default_warn_seconds() -> u32 {
    10
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowData {
    #[serde(default)]
    pub show_name: String,
    pub departments: Vec<Department>,
    pub cues: Vec<Cue>,
    #[serde(default)]
    pub acts: Vec<Act>,
    #[serde(default)]
    pub users: Vec<User>,
}

impl Default for ShowData {
    fn default() -> Self {
        Self {
            show_name: String::new(),
            departments: Vec::new(),
            cues: Vec::new(),
            acts: Vec::new(),
            users: Vec::new(),
        }
    }
}

/// Error detail for a single cue that failed import validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CueImportError {
    pub index: usize,
    pub message: String,
}

/// Response from the bulk cue import endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CueImportResult {
    pub imported: usize,
    pub errors: Vec<CueImportError>,
}

/// Cue state relative to current timecode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CueState {
    Upcoming,
    Warning,
    Go,
    Active,
    Passed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CueStatus {
    pub id: Uuid,
    pub cue_number: String,
    pub department: String,
    pub department_id: Uuid,
    pub label: String,
    pub state: CueState,
    pub countdown_sec: f64,
    pub trigger_tc: Timecode,
    pub armed: bool,
    pub duration: Option<u32>,
    pub color: Option<String>,
    /// Seconds elapsed since trigger (for active cues with duration).
    pub elapsed_sec: Option<f64>,
    /// Act this cue belongs to (if any).
    pub act_id: Option<Uuid>,
    pub act_name: Option<String>,
}
