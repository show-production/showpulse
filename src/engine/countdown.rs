use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{Duration, interval};
use uuid::Uuid;

use crate::cue::store::CueStore;
use crate::cue::types::{CueState, CueStatus};
use crate::timecode::TimecodeManager;
use crate::ws::hub::{BroadcastMessage, WsHub};

pub async fn run(
    tc_manager: Arc<TimecodeManager>,
    store: Arc<CueStore>,
    ws_hub: Arc<WsHub>,
) {
    let mut tick = interval(Duration::from_millis(100)); // 10Hz broadcast rate
    let mut last_second: Option<u8> = None;

    loop {
        tick.tick().await;

        let status = tc_manager.status().await;
        let current_tc = status.timecode;
        let frame_rate = status.frame_rate;

        // Only broadcast when the second changes (avoid flooding)
        if last_second == Some(current_tc.seconds) && status.running {
            continue;
        }
        last_second = Some(current_tc.seconds);

        let show = store.show_data().await;
        let current_secs = current_tc.to_seconds_f64(frame_rate);

        // Sort cues by trigger timecode
        let mut sorted_cues = show.cues.clone();
        sorted_cues.sort_by(|a, b| a.trigger_tc.cmp(&b.trigger_tc));

        // Build per-department ordered trigger times for "next cue" lookup
        let mut dept_trigger_times: HashMap<Uuid, Vec<f64>> = HashMap::new();
        for cue in &sorted_cues {
            let secs = cue.trigger_tc.to_seconds_f64(frame_rate);
            dept_trigger_times
                .entry(cue.department_id)
                .or_default()
                .push(secs);
        }

        let mut cue_statuses: Vec<CueStatus> = Vec::new();

        for cue in &sorted_cues {
            let cue_secs = cue.trigger_tc.to_seconds_f64(frame_rate);
            let diff = cue_secs - current_secs;

            // Find the next same-department cue's trigger time (the one after this cue)
            let next_dept_trigger = dept_trigger_times
                .get(&cue.department_id)
                .and_then(|times| times.iter().find(|&&t| t > cue_secs).copied());

            let state = if current_secs < cue_secs {
                // Cue hasn't triggered yet
                if diff <= cue.warn_seconds as f64 {
                    CueState::Warning
                } else {
                    CueState::Upcoming
                }
            } else {
                // Cue has triggered (current_secs >= cue_secs)
                match next_dept_trigger {
                    // Next same-dept cue has also triggered → this one is passed
                    Some(next_t) if current_secs >= next_t => CueState::Passed,
                    // No next same-dept cue, or it hasn't triggered yet → still active
                    _ => CueState::Active,
                }
            };

            // Filter out cues that have been passed for more than 60 seconds.
            // A cue becomes "passed" when its next same-dept cue triggers,
            // so measure 60s from that trigger time.
            if state == CueState::Passed {
                if let Some(next_t) = next_dept_trigger {
                    if current_secs > next_t + 60.0 {
                        continue;
                    }
                }
            }

            let dept_name = show
                .departments
                .iter()
                .find(|d| d.id == cue.department_id)
                .map(|d| d.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());

            cue_statuses.push(CueStatus {
                id: cue.id,
                department: dept_name,
                department_id: cue.department_id,
                label: cue.label.clone(),
                state,
                countdown_sec: diff.max(0.0),
                trigger_tc: cue.trigger_tc,
            });
        }

        let run_status = if status.running { "running" } else { "stopped" };

        ws_hub.broadcast(BroadcastMessage {
            timecode: current_tc.to_string(),
            frame_rate: frame_rate.fps(),
            status: run_status.to_string(),
            cues: cue_statuses,
        });
    }
}
