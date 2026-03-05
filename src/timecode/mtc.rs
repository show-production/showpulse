use std::sync::{Arc, Mutex};
use std::thread;

use serde::Serialize;
use tokio::sync::watch;
use tracing::{info, error};

use super::types::Timecode;

/// Describes an available MIDI input port.
#[derive(Debug, Clone, Serialize)]
pub struct MidiPort {
    pub index: usize,
    pub name: String,
}

/// MTC quarter-frame accumulator.
/// MTC sends 8 quarter-frame messages (0xF1) to transmit one full timecode.
/// Each message carries a 4-bit nibble; it takes 2 frames to receive all 8.
struct QfAccumulator {
    /// Nibbles 0-7, indexed by piece number (high nibble of data byte >> 4)
    nibbles: [u8; 8],
    /// How many distinct pieces we've received in this cycle
    count: u8,
    /// The piece number of the last received message
    last_piece: u8,
}

impl QfAccumulator {
    fn new() -> Self {
        Self {
            nibbles: [0; 8],
            count: 0,
            last_piece: 0xFF,
        }
    }

    /// Feed a quarter-frame data byte. Returns Some(Timecode) when a full frame is assembled.
    fn feed(&mut self, data: u8) -> Option<Timecode> {
        let piece = (data >> 4) & 0x07;
        let nibble = data & 0x0F;

        // Detect sequence reset (piece should increment 0..7)
        if piece == 0 && self.last_piece != 0xFF {
            self.count = 0;
        }

        self.nibbles[piece as usize] = nibble;
        self.last_piece = piece;
        self.count += 1;

        // After receiving piece 7, we have a complete frame
        if piece == 7 && self.count >= 8 {
            self.count = 0;
            Some(self.decode())
        } else {
            None
        }
    }

    /// Decode the 8 accumulated nibbles into a Timecode.
    /// Layout:
    ///   Piece 0: frames low nibble
    ///   Piece 1: frames high nibble (bits 0-0, bit 1 unused)
    ///   Piece 2: seconds low nibble
    ///   Piece 3: seconds high nibble (bits 0-2)
    ///   Piece 4: minutes low nibble
    ///   Piece 5: minutes high nibble (bits 0-2)
    ///   Piece 6: hours low nibble
    ///   Piece 7: hours high nibble (bit 0) + rate bits (bits 1-2)
    fn decode(&self) -> Timecode {
        let frames = self.nibbles[0] | ((self.nibbles[1] & 0x01) << 4);
        let seconds = self.nibbles[2] | ((self.nibbles[3] & 0x07) << 4);
        let minutes = self.nibbles[4] | ((self.nibbles[5] & 0x07) << 4);
        let hours = self.nibbles[6] | ((self.nibbles[7] & 0x01) << 4);
        // Rate bits in piece 7, bits 1-2: 00=24, 01=25, 10=29.97df, 11=30
        // We extract but don't use them here — frame rate is set globally.

        Timecode::new(hours, minutes, seconds, frames)
    }
}

/// Commands sent to the MTC MIDI thread.
enum MtcCommand {
    Start(usize), // port index
    Stop,
    Shutdown,
}

/// MIDI MTC decoder using midir for MIDI input.
/// The midir connection is kept on a dedicated OS thread.
pub struct MtcDecoder {
    cmd_tx: std::sync::mpsc::Sender<MtcCommand>,
    receiving: Arc<Mutex<bool>>,
}

unsafe impl Send for MtcDecoder {}
unsafe impl Sync for MtcDecoder {}

impl MtcDecoder {
    pub fn new(tc_tx: watch::Sender<Timecode>) -> Self {
        let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<MtcCommand>();
        let receiving = Arc::new(Mutex::new(false));
        let receiving_clone = receiving.clone();

        thread::Builder::new()
            .name("mtc-midi".into())
            .spawn(move || {
                mtc_midi_thread(cmd_rx, tc_tx, receiving_clone);
            })
            .expect("Failed to spawn MTC MIDI thread");

        info!("MTC decoder initialized");
        Self { cmd_tx, receiving }
    }

    /// List available MIDI input ports.
    pub fn list_ports() -> Vec<MidiPort> {
        let midi_in = match midir::MidiInput::new("showpulse-mtc-list") {
            Ok(m) => m,
            Err(e) => {
                error!("MTC: failed to create MIDI input for listing: {}", e);
                return Vec::new();
            }
        };
        let ports = midi_in.ports();
        ports
            .iter()
            .enumerate()
            .map(|(i, p)| MidiPort {
                index: i,
                name: midi_in.port_name(p).unwrap_or_else(|_| format!("Port {}", i)),
            })
            .collect()
    }

    /// Start listening on the specified MIDI input port.
    pub fn start_port(&self, port_index: usize) -> Result<(), String> {
        self.cmd_tx
            .send(MtcCommand::Start(port_index))
            .map_err(|_| "MTC MIDI thread not running".to_string())
    }

    /// Stop listening.
    pub fn stop(&self) {
        let _ = self.cmd_tx.send(MtcCommand::Stop);
    }

    /// Whether we are actively receiving MTC signal.
    pub fn is_receiving(&self) -> bool {
        self.receiving.lock().map(|r| *r).unwrap_or(false)
    }
}

impl Drop for MtcDecoder {
    fn drop(&mut self) {
        let _ = self.cmd_tx.send(MtcCommand::Shutdown);
    }
}

/// Runs on a dedicated OS thread. Owns the midir connection.
fn mtc_midi_thread(
    cmd_rx: std::sync::mpsc::Receiver<MtcCommand>,
    tc_tx: watch::Sender<Timecode>,
    receiving: Arc<Mutex<bool>>,
) {
    // We store the active connection as a Box<dyn Any> to erase the generic
    // (MidiInputConnection<()> requires the callback closure type).
    // Dropping it closes the port.
    let mut active_connection: Option<midir::MidiInputConnection<()>> = None;

    loop {
        match cmd_rx.recv() {
            Ok(MtcCommand::Start(port_index)) => {
                // Stop any existing connection
                active_connection = None;
                if let Ok(mut r) = receiving.lock() {
                    *r = false;
                }

                match open_midi_port(port_index, tc_tx.clone(), receiving.clone()) {
                    Ok(conn) => {
                        active_connection = Some(conn);
                    }
                    Err(e) => {
                        error!("MTC: failed to open MIDI port {}: {}", port_index, e);
                    }
                }
            }
            Ok(MtcCommand::Stop) => {
                if active_connection.is_some() {
                    info!("MTC: stopping MIDI input");
                }
                active_connection = None;
                if let Ok(mut r) = receiving.lock() {
                    *r = false;
                }
            }
            Ok(MtcCommand::Shutdown) | Err(_) => {
                active_connection = None;
                break;
            }
        }
    }
}

/// Open a MIDI input port and start listening for MTC messages.
fn open_midi_port(
    port_index: usize,
    tc_tx: watch::Sender<Timecode>,
    receiving: Arc<Mutex<bool>>,
) -> Result<midir::MidiInputConnection<()>, String> {
    let midi_in = midir::MidiInput::new("showpulse-mtc")
        .map_err(|e| format!("Failed to create MIDI input: {}", e))?;

    let ports = midi_in.ports();
    let port = ports
        .get(port_index)
        .ok_or_else(|| format!("MIDI port index {} not found", port_index))?;

    let port_name = midi_in
        .port_name(port)
        .unwrap_or_else(|_| "unknown".to_string());
    info!("MTC: opening MIDI port: {}", port_name);

    let qf = Arc::new(Mutex::new(QfAccumulator::new()));

    let conn = midi_in
        .connect(
            port,
            "showpulse-mtc-in",
            move |_timestamp, message, _data| {
                process_midi_message(message, &qf, &tc_tx, &receiving);
            },
            (),
        )
        .map_err(|e| format!("Failed to connect to MIDI port: {}", e))?;

    info!("MTC: listening on '{}'", port_name);
    Ok(conn)
}

/// Process a single MIDI message, looking for MTC quarter-frame and full-frame SysEx.
fn process_midi_message(
    message: &[u8],
    qf: &Arc<Mutex<QfAccumulator>>,
    tc_tx: &watch::Sender<Timecode>,
    receiving: &Arc<Mutex<bool>>,
) {
    if message.is_empty() {
        return;
    }

    match message[0] {
        // Quarter-frame message: F1 dd
        0xF1 if message.len() >= 2 => {
            if let Ok(mut acc) = qf.lock() {
                if let Some(tc) = acc.feed(message[1]) {
                    let _ = tc_tx.send(tc);
                    if let Ok(mut r) = receiving.lock() {
                        *r = true;
                    }
                }
            }
        }

        // Full-frame SysEx: F0 7F 7F 01 01 hr mn sc fr F7
        0xF0 if message.len() >= 10
            && message[1] == 0x7F
            && message[2] == 0x7F
            && message[3] == 0x01
            && message[4] == 0x01 =>
        {
            // Hours byte includes rate bits in top 2 bits: rr0hhhhh
            let hours = message[5] & 0x1F;
            let minutes = message[6] & 0x3F;
            let seconds = message[7] & 0x3F;
            let frames = message[8] & 0x1F;

            if hours <= 23 && minutes <= 59 && seconds <= 59 && frames <= 30 {
                let tc = Timecode::new(hours, minutes, seconds, frames);
                let _ = tc_tx.send(tc);
                if let Ok(mut r) = receiving.lock() {
                    *r = true;
                }
            }
        }

        _ => {} // Ignore all other MIDI messages
    }
}
