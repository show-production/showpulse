use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::timecode::types::Timecode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Department {
    pub id: Uuid,
    pub name: String,
    pub color: String, // hex color, e.g. "#ff0000"
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
}

fn default_cue_label() -> String {
    "Untitled Cue".to_string()
}

fn default_warn_seconds() -> u32 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowData {
    pub departments: Vec<Department>,
    pub cues: Vec<Cue>,
}

impl Default for ShowData {
    fn default() -> Self {
        Self {
            departments: Vec::new(),
            cues: Vec::new(),
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
}
