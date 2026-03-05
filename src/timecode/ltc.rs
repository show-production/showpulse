use tokio::sync::watch;
use tracing::info;

use super::types::Timecode;

/// SMPTE LTC decoder stub.
/// Full implementation will use `cpal` crate for audio capture and decode
/// the 80-bit LTC frame from the audio stream.
pub struct LtcDecoder {
    _tc_tx: watch::Sender<Timecode>,
}

impl LtcDecoder {
    pub fn new(tc_tx: watch::Sender<Timecode>) -> Self {
        info!("LTC decoder initialized (stub — awaiting cpal integration)");
        Self { _tc_tx: tc_tx }
    }

    /// Start listening on the configured audio input device.
    /// Currently a no-op stub.
    pub async fn start(&self) {
        info!("LTC decoder: no audio device configured, standing by");
    }
}
