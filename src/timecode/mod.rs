pub mod generator;
pub mod ltc;
pub mod mtc;
pub mod types;

use std::sync::Arc;
use tokio::sync::{watch, RwLock};
use types::{Timecode, TimecodeSource, TimecodeStatus, FrameRate};
use generator::TimecodeGenerator;

/// Manages all timecode sources and provides the current timecode.
pub struct TimecodeManager {
    /// Current active source
    active_source: Arc<RwLock<TimecodeSource>>,
    /// Timecode channels per source
    generator_tc_rx: watch::Receiver<Timecode>,
    ltc_tc_rx: watch::Receiver<Timecode>,
    mtc_tc_rx: watch::Receiver<Timecode>,
    /// Generator instance (for sending commands)
    pub generator: Arc<TimecodeGenerator>,
    /// LTC decoder instance (for device management)
    pub ltc_decoder: Arc<ltc::LtcDecoder>,
    /// MTC decoder instance (for device management)
    pub mtc_decoder: Arc<mtc::MtcDecoder>,
    /// Frame rate
    frame_rate: Arc<RwLock<FrameRate>>,
}

impl TimecodeManager {
    pub fn new() -> Self {
        let (gen_tc_tx, gen_tc_rx) = watch::channel(Timecode::ZERO);
        let (ltc_tc_tx, ltc_tc_rx) = watch::channel(Timecode::ZERO);
        let (mtc_tc_tx, mtc_tc_rx) = watch::channel(Timecode::ZERO);

        let generator = Arc::new(TimecodeGenerator::new(gen_tc_tx));
        let ltc_decoder = Arc::new(ltc::LtcDecoder::new(ltc_tc_tx));
        let mtc_decoder = Arc::new(mtc::MtcDecoder::new(mtc_tc_tx));

        Self {
            active_source: Arc::new(RwLock::new(TimecodeSource::Generator)),
            generator_tc_rx: gen_tc_rx,
            ltc_tc_rx,
            mtc_tc_rx,
            generator,
            ltc_decoder,
            mtc_decoder,
            frame_rate: Arc::new(RwLock::new(FrameRate::default())),
        }
    }

    pub async fn current_timecode(&self) -> Timecode {
        let source = *self.active_source.read().await;
        match source {
            TimecodeSource::Generator => *self.generator_tc_rx.borrow(),
            TimecodeSource::Ltc => *self.ltc_tc_rx.borrow(),
            TimecodeSource::Mtc => *self.mtc_tc_rx.borrow(),
        }
    }

    pub async fn status(&self) -> TimecodeStatus {
        let source = *self.active_source.read().await;
        let tc = self.current_timecode().await;
        let frame_rate = *self.frame_rate.read().await;
        let running = match source {
            TimecodeSource::Generator => {
                self.generator.status().state == generator::GeneratorState::Running
            }
            TimecodeSource::Ltc => self.ltc_decoder.is_receiving(),
            TimecodeSource::Mtc => self.mtc_decoder.is_receiving(),
        };
        TimecodeStatus {
            timecode: tc,
            frame_rate,
            source,
            running,
        }
    }

    pub async fn set_source(&self, source: TimecodeSource) {
        *self.active_source.write().await = source;
    }

    pub async fn active_source(&self) -> TimecodeSource {
        *self.active_source.read().await
    }

    pub async fn set_frame_rate(&self, rate: FrameRate) {
        *self.frame_rate.write().await = rate;
    }
}
