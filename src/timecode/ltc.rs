use std::sync::{Arc, Mutex};
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use tokio::sync::watch;
use tracing::{info, error};

use super::types::Timecode;

/// Describes an available audio input device.
#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub index: usize,
    pub name: String,
}

/// Shared state for the LTC decode loop, accessed from the cpal audio callback.
struct LtcState {
    tc_tx: watch::Sender<Timecode>,
    sample_rate: f64,
    prev_sample: f32,
    half_period_samples: f64,
    threshold: f64,
    half_period_count: u8,
    first_half_short: bool,
    shift_register: u128,
    bit_count: u32,
    receiving: bool,
}

impl LtcState {
    fn new(tc_tx: watch::Sender<Timecode>, sample_rate: f64) -> Self {
        // LTC at 30fps = 80 bits * 30 = 2400 bits/s
        // Threshold between short (1/4800 s) and long (1/2400 s) half-periods: 1/3600 s
        let threshold = sample_rate / 3600.0;
        Self {
            tc_tx,
            sample_rate,
            prev_sample: 0.0,
            half_period_samples: 0.0,
            threshold,
            half_period_count: 0,
            first_half_short: false,
            shift_register: 0,
            bit_count: 0,
            receiving: false,
        }
    }

    fn process_sample(&mut self, sample: f32) {
        self.half_period_samples += 1.0;

        // Detect zero crossing
        let crossed = (self.prev_sample >= 0.0 && sample < 0.0)
            || (self.prev_sample < 0.0 && sample >= 0.0);
        self.prev_sample = sample;

        if !crossed {
            return;
        }

        let half_dur = self.half_period_samples;
        self.half_period_samples = 0.0;

        // Ignore glitches shorter than 1/4 of expected minimum half-period
        let min_half = self.sample_rate / 9600.0;
        if half_dur < min_half {
            return;
        }

        let is_short = half_dur < self.threshold;

        if self.half_period_count == 0 {
            self.first_half_short = is_short;
            self.half_period_count = 1;
        } else {
            self.half_period_count = 0;

            let bit: u8 = if self.first_half_short && is_short {
                1
            } else if !self.first_half_short {
                // Long half = bit 0; second "half" starts next bit
                self.first_half_short = is_short;
                self.half_period_count = 1;
                0
            } else {
                // Decode error, reset
                self.bit_count = 0;
                self.shift_register = 0;
                return;
            };

            // Shift in bit (LTC is LSB first)
            self.shift_register = (self.shift_register >> 1) | ((bit as u128) << 79);
            self.bit_count += 1;

            // Check for sync word (0x3FFD) at bits 64-79
            if self.bit_count >= 80 {
                let sync_bits = ((self.shift_register >> 64) & 0xFFFF) as u16;
                if sync_bits == 0x3FFD {
                    self.decode_frame();
                    self.bit_count = 0;
                    self.shift_register = 0;
                }
            }

            if self.bit_count > 160 {
                self.bit_count = 0;
                self.shift_register = 0;
            }
        }
    }

    fn decode_frame(&mut self) {
        let r = self.shift_register;

        // LTC 80-bit frame layout (LSB first):
        // 0-3: frames units, 4-7: user bits 1, 8-9: frames tens,
        // 10: drop frame, 11: color frame, 12-15: user bits 2,
        // 16-19: seconds units, 20-23: user bits 3, 24-26: seconds tens,
        // 27: polarity, 28-31: user bits 4,
        // 32-35: minutes units, 36-39: user bits 5, 40-42: minutes tens,
        // 43: binary group flag, 44-47: user bits 6,
        // 48-51: hours units, 52-55: user bits 7, 56-57: hours tens,
        // 58-59: flags, 60-63: user bits 8, 64-79: sync word (0x3FFD)

        let frames_units = (r & 0x0F) as u8;
        let frames_tens = ((r >> 8) & 0x03) as u8;
        let seconds_units = ((r >> 16) & 0x0F) as u8;
        let seconds_tens = ((r >> 24) & 0x07) as u8;
        let minutes_units = ((r >> 32) & 0x0F) as u8;
        let minutes_tens = ((r >> 40) & 0x07) as u8;
        let hours_units = ((r >> 48) & 0x0F) as u8;
        let hours_tens = ((r >> 56) & 0x03) as u8;

        let frames = frames_tens * 10 + frames_units;
        let seconds = seconds_tens * 10 + seconds_units;
        let minutes = minutes_tens * 10 + minutes_units;
        let hours = hours_tens * 10 + hours_units;

        if hours > 23 || minutes > 59 || seconds > 59 || frames > 30 {
            return;
        }

        let tc = Timecode::new(hours, minutes, seconds, frames);
        self.receiving = true;
        let _ = self.tc_tx.send(tc);
    }
}

/// Commands sent to the LTC audio thread.
enum LtcCommand {
    Start(usize), // device index
    Stop,
    Shutdown,
}

/// SMPTE LTC decoder using audio input via cpal.
/// The cpal Stream is !Send, so we keep it on a dedicated OS thread.
pub struct LtcDecoder {
    cmd_tx: std::sync::mpsc::Sender<LtcCommand>,
    receiving: Arc<Mutex<bool>>,
}

// Safety: LtcDecoder only holds a channel sender (Send+Sync) and Arc<Mutex> (Send+Sync).
// The actual cpal::Stream lives on its own dedicated OS thread.
unsafe impl Send for LtcDecoder {}
unsafe impl Sync for LtcDecoder {}

impl LtcDecoder {
    pub fn new(tc_tx: watch::Sender<Timecode>) -> Self {
        let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<LtcCommand>();
        let receiving = Arc::new(Mutex::new(false));
        let receiving_clone = receiving.clone();

        thread::Builder::new()
            .name("ltc-audio".into())
            .spawn(move || {
                ltc_audio_thread(cmd_rx, tc_tx, receiving_clone);
            })
            .expect("Failed to spawn LTC audio thread");

        info!("LTC decoder initialized");
        Self { cmd_tx, receiving }
    }

    /// List available audio input devices.
    pub fn list_devices() -> Vec<AudioDevice> {
        let host = cpal::default_host();
        let mut devices = Vec::new();
        if let Ok(input_devices) = host.input_devices() {
            for (i, dev) in input_devices.enumerate() {
                let name = dev.name().unwrap_or_else(|_| format!("Device {}", i));
                devices.push(AudioDevice { index: i, name });
            }
        }
        devices
    }

    /// Start listening on the specified audio input device.
    pub fn start_device(&self, device_index: usize) -> Result<(), String> {
        self.cmd_tx
            .send(LtcCommand::Start(device_index))
            .map_err(|_| "LTC audio thread not running".to_string())
    }

    /// Stop the active audio stream.
    pub fn stop(&self) {
        let _ = self.cmd_tx.send(LtcCommand::Stop);
    }

    /// Whether we are actively receiving LTC signal.
    pub fn is_receiving(&self) -> bool {
        self.receiving.lock().map(|r| *r).unwrap_or(false)
    }
}

impl Drop for LtcDecoder {
    fn drop(&mut self) {
        let _ = self.cmd_tx.send(LtcCommand::Shutdown);
    }
}

/// Runs on a dedicated OS thread. Owns the cpal::Stream (which is !Send).
fn ltc_audio_thread(
    cmd_rx: std::sync::mpsc::Receiver<LtcCommand>,
    tc_tx: watch::Sender<Timecode>,
    receiving: Arc<Mutex<bool>>,
) {
    // The active stream is kept alive here; dropping it stops audio capture.
    let mut active_stream: Option<cpal::Stream> = None;

    loop {
        match cmd_rx.recv() {
            Ok(LtcCommand::Start(device_index)) => {
                // Stop any existing stream
                active_stream = None;
                if let Ok(mut r) = receiving.lock() {
                    *r = false;
                }

                match open_device(device_index, tc_tx.clone(), receiving.clone()) {
                    Ok(stream) => {
                        active_stream = Some(stream);
                    }
                    Err(e) => {
                        error!("LTC: failed to open device {}: {}", device_index, e);
                    }
                }
            }
            Ok(LtcCommand::Stop) => {
                if active_stream.is_some() {
                    info!("LTC: stopping audio stream");
                }
                active_stream = None;
                if let Ok(mut r) = receiving.lock() {
                    *r = false;
                }
            }
            Ok(LtcCommand::Shutdown) | Err(_) => {
                active_stream = None;
                break;
            }
        }
    }
}

/// Open an audio device and start the cpal input stream.
fn open_device(
    device_index: usize,
    tc_tx: watch::Sender<Timecode>,
    receiving: Arc<Mutex<bool>>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();
    let device = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate devices: {}", e))?
        .nth(device_index)
        .ok_or_else(|| format!("Audio device index {} not found", device_index))?;

    let dev_name = device.name().unwrap_or_else(|_| "unknown".to_string());
    info!("LTC: opening audio device: {}", dev_name);

    let config = device
        .default_input_config()
        .map_err(|e| format!("No default input config: {}", e))?;

    let sample_rate = config.sample_rate().0 as f64;
    let channels = config.channels() as usize;
    info!("LTC: sample rate={}, channels={}", sample_rate, channels);

    let state = Arc::new(Mutex::new(LtcState::new(tc_tx, sample_rate)));
    let err_fn = |err: cpal::StreamError| {
        error!("LTC audio stream error: {}", err);
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            let state = state.clone();
            let receiving = receiving.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if let Ok(mut s) = state.lock() {
                            for chunk in data.chunks(channels) {
                                if let Some(&sample) = chunk.first() {
                                    s.process_sample(sample);
                                }
                            }
                            if let Ok(mut r) = receiving.lock() {
                                *r = s.receiving;
                            }
                        }
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Failed to build stream: {}", e))?
        }
        cpal::SampleFormat::I16 => {
            let state = state.clone();
            let receiving = receiving.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if let Ok(mut s) = state.lock() {
                            for chunk in data.chunks(channels) {
                                if let Some(&sample) = chunk.first() {
                                    let f = sample as f32 / i16::MAX as f32;
                                    s.process_sample(f);
                                }
                            }
                            if let Ok(mut r) = receiving.lock() {
                                *r = s.receiving;
                            }
                        }
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Failed to build i16 stream: {}", e))?
        }
        format => {
            return Err(format!("Unsupported sample format: {:?}", format));
        }
    };

    stream.play().map_err(|e| format!("Failed to start stream: {}", e))?;
    info!("LTC: audio stream started on '{}'", dev_name);

    Ok(stream)
}
