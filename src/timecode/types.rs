use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum FrameRate {
    #[serde(rename = "24")]
    Fps24,
    #[serde(rename = "25")]
    Fps25,
    #[serde(rename = "29.97df")]
    Fps2997Df,
    #[serde(rename = "30")]
    Fps30,
}

impl FrameRate {
    pub fn fps(self) -> f64 {
        match self {
            Self::Fps24 => 24.0,
            Self::Fps25 => 25.0,
            Self::Fps2997Df => 29.97,
            Self::Fps30 => 30.0,
        }
    }

    pub fn frame_duration_ms(self) -> f64 {
        1000.0 / self.fps()
    }

    pub fn max_frames(self) -> u8 {
        match self {
            Self::Fps24 => 24,
            Self::Fps25 => 25,
            Self::Fps2997Df => 30,
            Self::Fps30 => 30,
        }
    }
}

impl Default for FrameRate {
    fn default() -> Self {
        Self::Fps30
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Timecode {
    pub hours: u8,
    pub minutes: u8,
    pub seconds: u8,
    pub frames: u8,
}

impl Timecode {
    pub const ZERO: Timecode = Timecode {
        hours: 0,
        minutes: 0,
        seconds: 0,
        frames: 0,
    };

    pub fn new(hours: u8, minutes: u8, seconds: u8, frames: u8) -> Self {
        Self {
            hours,
            minutes,
            seconds,
            frames,
        }
    }

    pub fn to_total_frames(self, rate: FrameRate) -> u32 {
        let max_frames = rate.max_frames() as u32;
        let total = self.hours as u32 * 3600 * max_frames
            + self.minutes as u32 * 60 * max_frames
            + self.seconds as u32 * max_frames
            + self.frames as u32;

        if rate == FrameRate::Fps2997Df {
            // Drop-frame compensation: drop 2 frames per minute, except every 10th minute
            let minutes_total =
                self.hours as u32 * 60 + self.minutes as u32;
            let drop = 2 * (minutes_total - minutes_total / 10);
            total - drop
        } else {
            total
        }
    }

    pub fn from_total_frames(mut total: u32, rate: FrameRate) -> Self {
        let max_frames = rate.max_frames() as u32;

        if rate == FrameRate::Fps2997Df {
            // Reverse drop-frame calculation
            let d = total / 17982; // number of complete 10-minute blocks
            let m = total % 17982;
            let extra = if m >= 2 {
                (m - 2) / 1798
            } else {
                0
            };
            total += 18 * d + 2 * extra;
        }

        let frames = (total % max_frames) as u8;
        total /= max_frames;
        let seconds = (total % 60) as u8;
        total /= 60;
        let minutes = (total % 60) as u8;
        let hours = (total / 60) as u8;

        Self {
            hours,
            minutes,
            seconds,
            frames,
        }
    }

    pub fn to_seconds_f64(self, rate: FrameRate) -> f64 {
        let total_frames = self.to_total_frames(rate);
        total_frames as f64 / rate.fps()
    }

    pub fn from_seconds_f64(secs: f64, rate: FrameRate) -> Self {
        let total_frames = (secs * rate.fps()).round() as u32;
        Self::from_total_frames(total_frames, rate)
    }

    pub fn add_frames(self, frames: i64, rate: FrameRate) -> Self {
        let current = self.to_total_frames(rate) as i64;
        let new_total = (current + frames).max(0) as u32;
        Self::from_total_frames(new_total, rate)
    }

    /// Parse from "HH:MM:SS:FF" string
    pub fn parse(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 4 {
            return None;
        }
        Some(Self {
            hours: parts[0].parse().ok()?,
            minutes: parts[1].parse().ok()?,
            seconds: parts[2].parse().ok()?,
            frames: parts[3].parse().ok()?,
        })
    }
}

impl fmt::Display for Timecode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{:02}:{:02}:{:02}:{:02}",
            self.hours, self.minutes, self.seconds, self.frames
        )
    }
}

impl Default for Timecode {
    fn default() -> Self {
        Self::ZERO
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimecodeSource {
    Ltc,
    Mtc,
    Generator,
}

impl Default for TimecodeSource {
    fn default() -> Self {
        Self::Generator
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimecodeStatus {
    pub timecode: Timecode,
    pub frame_rate: FrameRate,
    pub source: TimecodeSource,
    pub running: bool,
}
