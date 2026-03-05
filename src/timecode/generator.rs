use serde::{Deserialize, Serialize};
use tokio::sync::watch;
use tokio::time::{Duration, Instant};

use super::types::{FrameRate, Timecode};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GeneratorMode {
    Freerun,
    Countdown,
    Clock,
    Loop,
}

impl Default for GeneratorMode {
    fn default() -> Self {
        Self::Freerun
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GeneratorState {
    Stopped,
    Running,
    Paused,
}

impl Default for GeneratorState {
    fn default() -> Self {
        Self::Stopped
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorConfig {
    pub mode: GeneratorMode,
    pub frame_rate: FrameRate,
    pub start_tc: Timecode,
    pub loop_in: Option<Timecode>,
    pub loop_out: Option<Timecode>,
    pub speed: f64,
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            mode: GeneratorMode::Freerun,
            frame_rate: FrameRate::Fps30,
            start_tc: Timecode::ZERO,
            loop_in: None,
            loop_out: None,
            speed: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorStatus {
    pub state: GeneratorState,
    pub config: GeneratorConfig,
    pub current_tc: Timecode,
}

/// Commands sent to the generator task
#[derive(Debug, Clone)]
pub enum GeneratorCommand {
    Play,
    Pause,
    Stop,
    Goto(Timecode),
    UpdateConfig(GeneratorConfig),
}

pub struct TimecodeGenerator {
    cmd_tx: tokio::sync::mpsc::Sender<GeneratorCommand>,
    status_rx: watch::Receiver<GeneratorStatus>,
}

impl TimecodeGenerator {
    pub fn new(tc_tx: watch::Sender<Timecode>) -> Self {
        let (cmd_tx, cmd_rx) = tokio::sync::mpsc::channel(32);
        let initial_status = GeneratorStatus {
            state: GeneratorState::Stopped,
            config: GeneratorConfig::default(),
            current_tc: Timecode::ZERO,
        };
        let (status_tx, status_rx) = watch::channel(initial_status);

        tokio::spawn(generator_task(cmd_rx, tc_tx, status_tx));

        Self { cmd_tx, status_rx }
    }

    pub async fn send_command(&self, cmd: GeneratorCommand) {
        let _ = self.cmd_tx.send(cmd).await;
    }

    pub fn status(&self) -> GeneratorStatus {
        self.status_rx.borrow().clone()
    }
}

async fn generator_task(
    mut cmd_rx: tokio::sync::mpsc::Receiver<GeneratorCommand>,
    tc_tx: watch::Sender<Timecode>,
    status_tx: watch::Sender<GeneratorStatus>,
) {
    let mut config = GeneratorConfig::default();
    let mut state = GeneratorState::Stopped;
    let mut current_tc = Timecode::ZERO;
    let mut accumulated_frames: f64 = 0.0;
    let mut last_tick = Instant::now();

    let tick_interval = Duration::from_millis(10); // 10ms tick for smooth updates

    loop {
        tokio::select! {
            cmd = cmd_rx.recv() => {
                match cmd {
                    Some(GeneratorCommand::Play) => {
                        if state == GeneratorState::Stopped {
                            current_tc = config.start_tc;
                            accumulated_frames = current_tc.to_total_frames(config.frame_rate) as f64;
                        }
                        state = GeneratorState::Running;
                        last_tick = Instant::now();
                    }
                    Some(GeneratorCommand::Pause) => {
                        state = GeneratorState::Paused;
                    }
                    Some(GeneratorCommand::Stop) => {
                        state = GeneratorState::Stopped;
                        current_tc = config.start_tc;
                        accumulated_frames = current_tc.to_total_frames(config.frame_rate) as f64;
                        let _ = tc_tx.send(current_tc);
                    }
                    Some(GeneratorCommand::Goto(tc)) => {
                        current_tc = tc;
                        accumulated_frames = tc.to_total_frames(config.frame_rate) as f64;
                        let _ = tc_tx.send(current_tc);
                    }
                    Some(GeneratorCommand::UpdateConfig(new_config)) => {
                        config = new_config;
                    }
                    None => break,
                }
                let _ = status_tx.send(GeneratorStatus { state, config: config.clone(), current_tc });
            }
            _ = tokio::time::sleep(tick_interval) => {
                if state != GeneratorState::Running {
                    continue;
                }

                let now = Instant::now();
                let elapsed = now.duration_since(last_tick);
                last_tick = now;

                let elapsed_secs = elapsed.as_secs_f64() * config.speed;
                let frames_advanced = elapsed_secs * config.frame_rate.fps();

                match config.mode {
                    GeneratorMode::Freerun => {
                        accumulated_frames += frames_advanced;
                        current_tc = Timecode::from_total_frames(
                            accumulated_frames as u32,
                            config.frame_rate,
                        );
                    }
                    GeneratorMode::Countdown => {
                        accumulated_frames -= frames_advanced;
                        if accumulated_frames <= 0.0 {
                            accumulated_frames = 0.0;
                            state = GeneratorState::Stopped;
                        }
                        current_tc = Timecode::from_total_frames(
                            accumulated_frames as u32,
                            config.frame_rate,
                        );
                    }
                    GeneratorMode::Clock => {
                        let now_wall = chrono_free_clock();
                        current_tc = now_wall;
                        accumulated_frames = current_tc.to_total_frames(config.frame_rate) as f64;
                    }
                    GeneratorMode::Loop => {
                        accumulated_frames += frames_advanced;
                        if let (Some(loop_in), Some(loop_out)) = (config.loop_in, config.loop_out) {
                            let max = loop_out.to_total_frames(config.frame_rate) as f64;
                            let min = loop_in.to_total_frames(config.frame_rate) as f64;
                            if accumulated_frames >= max {
                                accumulated_frames = min + (accumulated_frames - max);
                            }
                        }
                        current_tc = Timecode::from_total_frames(
                            accumulated_frames as u32,
                            config.frame_rate,
                        );
                    }
                }

                let _ = tc_tx.send(current_tc);
                let _ = status_tx.send(GeneratorStatus { state, config: config.clone(), current_tc });
            }
        }
    }
}

/// Get current wall-clock time as a Timecode (no chrono dependency)
fn chrono_free_clock() -> Timecode {
    use std::time::SystemTime;
    let duration = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs_today = (duration.as_secs() % 86400) as u32;
    let hours = (secs_today / 3600) as u8;
    let minutes = ((secs_today % 3600) / 60) as u8;
    let seconds = (secs_today % 60) as u8;
    Timecode::new(hours, minutes, seconds, 0)
}
