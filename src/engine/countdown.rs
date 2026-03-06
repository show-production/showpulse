use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{Duration, interval};
use uuid::Uuid;

use crate::cue::store::CueStore;
use crate::cue::types::{CueState, CueStatus};
use crate::timecode::TimecodeManager;
use crate::ws::hub::{BroadcastMessage, WsHub};

/// Duration (in seconds) to keep a cue in Warning state with countdown_sec <= 0
/// before transitioning to Active. This gives the frontend time to show GO animation.
const GO_HOLD_SECONDS: f64 = 2.0;

pub async fn run(
    tc_manager: Arc<TimecodeManager>,
    store: Arc<CueStore>,
    ws_hub: Arc<WsHub>,
) {
    let mut tick = interval(Duration::from_millis(100)); // 10Hz broadcast rate
    let mut last_second: Option<u8> = None;
    let mut cached_cue_statuses: Vec<CueStatus> = Vec::new();

    loop {
        tick.tick().await;

        let status = tc_manager.status().await;
        let current_tc = status.timecode;
        let frame_rate = status.frame_rate;

        // Recompute cue states only when the second changes (expensive),
        // but always broadcast the timecode so frames stay live on screen.
        let second_changed = last_second != Some(current_tc.seconds);
        last_second = Some(current_tc.seconds);

        if !second_changed && !cached_cue_statuses.is_empty() {
            let run_status = if status.running { "running" } else { "stopped" };
            ws_hub.broadcast(BroadcastMessage {
                timecode: current_tc.to_string(),
                frame_rate: frame_rate.fps(),
                status: run_status.to_string(),
                cues: cached_cue_statuses.clone(),
            });
            continue;
        }

        let show = store.show_data().await;
        let current_secs = current_tc.to_seconds_f64(frame_rate);

        // Sort armed cues by trigger timecode
        let mut sorted_cues: Vec<_> = show.cues.iter().filter(|c| c.armed).cloned().collect();
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

        // Also include disarmed cues in output (greyed out) but don't compute state
        let mut cue_statuses: Vec<CueStatus> = Vec::new();

        // First: armed cues with full state computation
        for cue in &sorted_cues {
            let cue_secs = cue.trigger_tc.to_seconds_f64(frame_rate);
            let diff = cue_secs - current_secs;

            // Find the next same-department cue's trigger time (the one after this cue)
            let next_dept_trigger = dept_trigger_times
                .get(&cue.department_id)
                .and_then(|times| times.iter().find(|&&t| t > cue_secs).copied());

            let elapsed_since_trigger = if current_secs >= cue_secs {
                Some(current_secs - cue_secs)
            } else {
                None
            };

            let state = if current_secs < cue_secs {
                // Cue hasn't triggered yet
                if diff <= cue.warn_seconds as f64 {
                    CueState::Warning
                } else {
                    CueState::Upcoming
                }
            } else {
                // Cue has triggered (current_secs >= cue_secs).
                // Show Go state for GO_HOLD_SECONDS so frontend displays GO animation,
                // then transition to Active.
                let elapsed = elapsed_since_trigger.unwrap_or(0.0);
                if elapsed < GO_HOLD_SECONDS {
                    CueState::Go
                } else {
                    // Check duration-based completion: if cue has a duration and
                    // elapsed exceeds it, treat as passed (even without a next dept cue).
                    let duration_passed = cue
                        .duration
                        .map(|d| elapsed >= d as f64)
                        .unwrap_or(false);

                    if duration_passed {
                        CueState::Passed
                    } else {
                        match next_dept_trigger {
                            // Next same-dept cue has also triggered → this one is passed
                            Some(next_t) if current_secs >= next_t => CueState::Passed,
                            // No next same-dept cue, or it hasn't triggered yet → still active
                            _ => CueState::Active,
                        }
                    }
                }
            };

            // Filter out cues that have been passed for more than 60 seconds.
            if state == CueState::Passed {
                let passed_at = if let Some(dur) = cue.duration {
                    // Passed due to duration expiry
                    cue_secs + dur as f64
                } else if let Some(next_t) = next_dept_trigger {
                    next_t
                } else {
                    cue_secs
                };
                if current_secs > passed_at + 60.0 {
                    continue;
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
                cue_number: cue.cue_number.clone(),
                department: dept_name,
                department_id: cue.department_id,
                label: cue.label.clone(),
                state,
                countdown_sec: diff,
                trigger_tc: cue.trigger_tc,
                armed: true,
                duration: cue.duration,
                color: cue.color.clone(),
                elapsed_sec: elapsed_since_trigger,
            });
        }

        // Second: disarmed cues (always shown as Upcoming, no countdown logic)
        let mut disarmed_cues: Vec<_> = show.cues.iter().filter(|c| !c.armed).cloned().collect();
        disarmed_cues.sort_by(|a, b| a.trigger_tc.cmp(&b.trigger_tc));

        for cue in &disarmed_cues {
            let cue_secs = cue.trigger_tc.to_seconds_f64(frame_rate);
            let diff = cue_secs - current_secs;

            let dept_name = show
                .departments
                .iter()
                .find(|d| d.id == cue.department_id)
                .map(|d| d.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());

            cue_statuses.push(CueStatus {
                id: cue.id,
                cue_number: cue.cue_number.clone(),
                department: dept_name,
                department_id: cue.department_id,
                label: cue.label.clone(),
                state: CueState::Upcoming,
                countdown_sec: diff,
                trigger_tc: cue.trigger_tc,
                armed: false,
                duration: cue.duration,
                color: cue.color.clone(),
                elapsed_sec: None,
            });
        }

        // Cache for inter-second ticks
        cached_cue_statuses = cue_statuses.clone();

        let run_status = if status.running { "running" } else { "stopped" };

        ws_hub.broadcast(BroadcastMessage {
            timecode: current_tc.to_string(),
            frame_rate: frame_rate.fps(),
            status: run_status.to_string(),
            cues: cue_statuses,
        });
    }
}
