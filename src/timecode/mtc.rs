use tokio::sync::watch;
use tracing::info;

use super::types::Timecode;

/// MIDI MTC decoder stub.
/// Full implementation will use `midir` crate for MIDI input and parse
/// MTC Quarter Frame (F1 xx) and Full Frame (F0 7F ... F7) messages.
pub struct MtcDecoder {
    _tc_tx: watch::Sender<Timecode>,
}

impl MtcDecoder {
    pub fn new(tc_tx: watch::Sender<Timecode>) -> Self {
        info!("MTC decoder initialized (stub — awaiting midir integration)");
        Self { _tc_tx: tc_tx }
    }

    /// Start listening on the configured MIDI input device.
    /// Currently a no-op stub.
    pub async fn start(&self) {
        info!("MTC decoder: no MIDI device configured, standing by");
    }
}
