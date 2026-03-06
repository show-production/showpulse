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

#[cfg(test)]
mod tests {
    use super::*;

    // ── FrameRate basics ──

    #[test]
    fn frame_rate_fps_values() {
        assert_eq!(FrameRate::Fps24.fps(), 24.0);
        assert_eq!(FrameRate::Fps25.fps(), 25.0);
        assert_eq!(FrameRate::Fps2997Df.fps(), 29.97);
        assert_eq!(FrameRate::Fps30.fps(), 30.0);
    }

    #[test]
    fn frame_rate_max_frames() {
        assert_eq!(FrameRate::Fps24.max_frames(), 24);
        assert_eq!(FrameRate::Fps25.max_frames(), 25);
        assert_eq!(FrameRate::Fps2997Df.max_frames(), 30);
        assert_eq!(FrameRate::Fps30.max_frames(), 30);
    }

    #[test]
    fn frame_rate_default_is_30() {
        assert_eq!(FrameRate::default(), FrameRate::Fps30);
    }

    // ── Timecode parse ──

    #[test]
    fn parse_valid() {
        let tc = Timecode::parse("01:02:03:04").unwrap();
        assert_eq!(tc, Timecode::new(1, 2, 3, 4));
    }

    #[test]
    fn parse_zero() {
        let tc = Timecode::parse("00:00:00:00").unwrap();
        assert_eq!(tc, Timecode::ZERO);
    }

    #[test]
    fn parse_invalid_too_few_parts() {
        assert!(Timecode::parse("01:02:03").is_none());
    }

    #[test]
    fn parse_invalid_too_many_parts() {
        assert!(Timecode::parse("01:02:03:04:05").is_none());
    }

    #[test]
    fn parse_invalid_non_numeric() {
        assert!(Timecode::parse("aa:bb:cc:dd").is_none());
    }

    #[test]
    fn parse_empty() {
        assert!(Timecode::parse("").is_none());
    }

    // ── Timecode display ──

    #[test]
    fn display_zero_padded() {
        let tc = Timecode::new(1, 2, 3, 4);
        assert_eq!(tc.to_string(), "01:02:03:04");
    }

    #[test]
    fn display_zero() {
        assert_eq!(Timecode::ZERO.to_string(), "00:00:00:00");
    }

    #[test]
    fn parse_display_roundtrip() {
        let s = "12:34:56:07";
        assert_eq!(Timecode::parse(s).unwrap().to_string(), s);
    }

    // ── to_total_frames / from_total_frames round-trip (non-drop-frame) ──

    #[test]
    fn roundtrip_24fps() {
        for &tc in &[
            Timecode::ZERO,
            Timecode::new(0, 0, 1, 0),
            Timecode::new(0, 1, 0, 0),
            Timecode::new(1, 0, 0, 0),
            Timecode::new(0, 0, 0, 23),
            Timecode::new(23, 59, 59, 23),
        ] {
            let frames = tc.to_total_frames(FrameRate::Fps24);
            let back = Timecode::from_total_frames(frames, FrameRate::Fps24);
            assert_eq!(tc, back, "24fps roundtrip failed for {tc}");
        }
    }

    #[test]
    fn roundtrip_25fps() {
        for &tc in &[
            Timecode::ZERO,
            Timecode::new(0, 0, 1, 0),
            Timecode::new(0, 1, 0, 0),
            Timecode::new(1, 0, 0, 0),
            Timecode::new(0, 0, 0, 24),
        ] {
            let frames = tc.to_total_frames(FrameRate::Fps25);
            let back = Timecode::from_total_frames(frames, FrameRate::Fps25);
            assert_eq!(tc, back, "25fps roundtrip failed for {tc}");
        }
    }

    #[test]
    fn roundtrip_30fps() {
        for &tc in &[
            Timecode::ZERO,
            Timecode::new(0, 0, 1, 0),
            Timecode::new(0, 1, 0, 0),
            Timecode::new(1, 0, 0, 0),
            Timecode::new(0, 0, 0, 29),
        ] {
            let frames = tc.to_total_frames(FrameRate::Fps30);
            let back = Timecode::from_total_frames(frames, FrameRate::Fps30);
            assert_eq!(tc, back, "30fps roundtrip failed for {tc}");
        }
    }

    // ── Drop-frame (29.97df) ──

    #[test]
    fn roundtrip_2997df() {
        // Standard DF timecodes — note: frames 0,1 are dropped at non-10th minutes
        for &tc in &[
            Timecode::ZERO,
            Timecode::new(0, 0, 1, 0),
            Timecode::new(0, 0, 59, 29),
            Timecode::new(0, 1, 0, 2),  // after drop: first valid frame at minute 1
            Timecode::new(0, 10, 0, 0), // 10th minute — no drop
            Timecode::new(0, 20, 0, 0), // 20th minute — no drop
            Timecode::new(1, 0, 0, 0),
        ] {
            let frames = tc.to_total_frames(FrameRate::Fps2997Df);
            let back = Timecode::from_total_frames(frames, FrameRate::Fps2997Df);
            assert_eq!(tc, back, "29.97df roundtrip failed for {tc}");
        }
    }

    #[test]
    fn df_minute_boundary_drops_frames_0_1() {
        // At minute 1, frames 0 and 1 are dropped, so 0:1:0:0 and 0:1:0:1 should not
        // appear as valid timecodes. The first valid TC at minute 1 is 0:1:0:2.
        let tc_at_min1 = Timecode::new(0, 1, 0, 2);
        let frames = tc_at_min1.to_total_frames(FrameRate::Fps2997Df);
        // One frame before should be 0:0:59:29
        let one_before = Timecode::from_total_frames(frames - 1, FrameRate::Fps2997Df);
        assert_eq!(one_before, Timecode::new(0, 0, 59, 29));
    }

    #[test]
    fn df_ten_minute_boundary_no_drop() {
        // At 10th minute, no frames are dropped — 0:10:0:0 is valid
        let tc = Timecode::new(0, 10, 0, 0);
        let frames = tc.to_total_frames(FrameRate::Fps2997Df);
        let one_before = Timecode::from_total_frames(frames - 1, FrameRate::Fps2997Df);
        assert_eq!(one_before, Timecode::new(0, 9, 59, 29));
    }

    #[test]
    fn df_total_frames_at_one_hour() {
        // At 29.97df, one hour = 107892 frames
        let tc = Timecode::new(1, 0, 0, 0);
        assert_eq!(tc.to_total_frames(FrameRate::Fps2997Df), 107892);
    }

    // ── to_total_frames known values ──

    #[test]
    fn total_frames_30fps_one_second() {
        let tc = Timecode::new(0, 0, 1, 0);
        assert_eq!(tc.to_total_frames(FrameRate::Fps30), 30);
    }

    #[test]
    fn total_frames_30fps_one_minute() {
        let tc = Timecode::new(0, 1, 0, 0);
        assert_eq!(tc.to_total_frames(FrameRate::Fps30), 1800);
    }

    #[test]
    fn total_frames_30fps_one_hour() {
        let tc = Timecode::new(1, 0, 0, 0);
        assert_eq!(tc.to_total_frames(FrameRate::Fps30), 108000);
    }

    #[test]
    fn total_frames_zero_is_zero() {
        assert_eq!(Timecode::ZERO.to_total_frames(FrameRate::Fps24), 0);
        assert_eq!(Timecode::ZERO.to_total_frames(FrameRate::Fps25), 0);
        assert_eq!(Timecode::ZERO.to_total_frames(FrameRate::Fps2997Df), 0);
        assert_eq!(Timecode::ZERO.to_total_frames(FrameRate::Fps30), 0);
    }

    // ── add_frames ──

    #[test]
    fn add_frames_positive() {
        let tc = Timecode::new(0, 0, 0, 0);
        let result = tc.add_frames(30, FrameRate::Fps30);
        assert_eq!(result, Timecode::new(0, 0, 1, 0));
    }

    #[test]
    fn add_frames_negative() {
        let tc = Timecode::new(0, 0, 1, 0);
        let result = tc.add_frames(-15, FrameRate::Fps30);
        assert_eq!(result, Timecode::new(0, 0, 0, 15));
    }

    #[test]
    fn add_frames_clamps_at_zero() {
        let tc = Timecode::new(0, 0, 0, 5);
        let result = tc.add_frames(-100, FrameRate::Fps30);
        assert_eq!(result, Timecode::ZERO);
    }

    #[test]
    fn add_frames_carries_across_seconds() {
        let tc = Timecode::new(0, 0, 0, 29);
        let result = tc.add_frames(1, FrameRate::Fps30);
        assert_eq!(result, Timecode::new(0, 0, 1, 0));
    }

    #[test]
    fn add_frames_carries_across_minutes() {
        let tc = Timecode::new(0, 0, 59, 29);
        let result = tc.add_frames(1, FrameRate::Fps30);
        assert_eq!(result, Timecode::new(0, 1, 0, 0));
    }

    // ── to_seconds_f64 / from_seconds_f64 ──

    #[test]
    fn seconds_f64_roundtrip_30fps() {
        let tc = Timecode::new(0, 1, 30, 0);
        let secs = tc.to_seconds_f64(FrameRate::Fps30);
        assert!((secs - 90.0).abs() < 0.01, "expected ~90.0, got {secs}");
        let back = Timecode::from_seconds_f64(secs, FrameRate::Fps30);
        assert_eq!(back, tc);
    }

    #[test]
    fn seconds_f64_zero() {
        let secs = Timecode::ZERO.to_seconds_f64(FrameRate::Fps25);
        assert_eq!(secs, 0.0);
    }

    #[test]
    fn from_seconds_f64_fractional() {
        // 1.5 seconds at 30fps = 45 frames = 0:0:1:15
        let tc = Timecode::from_seconds_f64(1.5, FrameRate::Fps30);
        assert_eq!(tc, Timecode::new(0, 0, 1, 15));
    }

    // ── Serde ──

    #[test]
    fn framerate_serde_roundtrip() {
        let json = serde_json::to_string(&FrameRate::Fps2997Df).unwrap();
        assert_eq!(json, "\"29.97df\"");
        let back: FrameRate = serde_json::from_str(&json).unwrap();
        assert_eq!(back, FrameRate::Fps2997Df);
    }

    #[test]
    fn timecode_serde_roundtrip() {
        let tc = Timecode::new(1, 2, 3, 4);
        let json = serde_json::to_string(&tc).unwrap();
        let back: Timecode = serde_json::from_str(&json).unwrap();
        assert_eq!(back, tc);
    }

    #[test]
    fn timecode_source_serde() {
        let json = serde_json::to_string(&TimecodeSource::Generator).unwrap();
        assert_eq!(json, "\"generator\"");
        let json = serde_json::to_string(&TimecodeSource::Ltc).unwrap();
        assert_eq!(json, "\"ltc\"");
    }
}
