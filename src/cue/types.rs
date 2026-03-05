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
    pub id: Uuid,
    pub department_id: Uuid,
    pub label: String,
    pub trigger_tc: Timecode,
    pub warn_seconds: u32,
    pub notes: String,
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
    pub department: String,
    pub department_id: Uuid,
    pub label: String,
    pub state: CueState,
    pub countdown_sec: f64,
    pub trigger_tc: Timecode,
}
