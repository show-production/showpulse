use std::sync::Arc;
use tokio::time::{Duration, interval};

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

        let mut cue_statuses: Vec<CueStatus> = Vec::new();

        for cue in &show.cues {
            let cue_secs = cue.trigger_tc.to_seconds_f64(frame_rate);
            let diff = cue_secs - current_secs;

            let state = if diff < -1.0 {
                CueState::Passed
            } else if diff.abs() <= 1.0 {
                CueState::Active
            } else if diff <= cue.warn_seconds as f64 {
                CueState::Warning
            } else {
                CueState::Upcoming
            };

            // Only include cues that are relevant (not long passed)
            if diff < -60.0 {
                continue;
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
