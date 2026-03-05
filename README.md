# ShowPulse

Self-hosted, local-WiFi show management platform for live productions. Reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments, and pushes real-time countdown alerts to crew devices via web browsers.

**Repository:** https://github.com/DGProject2030/showpulse

## Features

- **Three timecode sources:** Built-in generator (Freerun/Countdown/Clock/Loop), SMPTE LTC audio input, MIDI MTC input
- **Frame-accurate timecode:** 10Hz engine broadcasts timecode with frame precision to all connected browsers via WebSocket
- **Per-department cue state:** Each cue stays active until the next cue in the same department triggers
- **Ready / 3-2-1 / Go visualization:** Dedicated countdown zone — READY stays visible while 3, 2, 1 digits appear alongside, then GO! with department name. Traffic-light colors (red→orange→green), fixed-height layout (no size jumps), scale-pop and flash effects
- **Clean dashboard layout:** Passed cues count badge (expandable dropdown), active cue strips, centered timer with transport controls, Ready/Go zone, scrollable coming cues
- **Uniform cue cards:** All cards same size regardless of state — no layout shifts, color-only tier differentiation
- **Cue navigation:** Click any cue to load its timecode into Goto, Prev/Next buttons to step through cues
- **Multi-department support:** Lighting, Sound, Video, Pyro, Automation, Stage Management — each with color coding and per-department filtering
- **Cue numbering:** Auto-generated (Q1, Q2, Q3...) or custom, displayed throughout the UI
- **Full cue management:** CRUD for departments and cues, sortable table, department filtering, bulk CSV/JSON import
- **Zero dependencies at runtime:** Single Rust binary, JSON file persistence, no database
- **Responsive UI:** Works on desktop, tablet, and phone — dark theme for backstage use with toast notifications and 44px touch targets

## Quick Start

```bash
git clone https://github.com/DGProject2030/showpulse.git
cd showpulse
cargo run
```

Open http://localhost:8080 — demo data with 6 departments and 22 cues loads automatically on first run.

For other devices on the same WiFi: `http://<your-ip>:8080`

## Documentation

- [Getting Started](GETTING_STARTED.md) — prerequisites, setup, usage guide
- [Project Overview](PROJECT_OVERVIEW.md) — architecture, implementation status, API reference
- [Implementation Plan](IMPLEMENTATION_PLAN.md) — original design spec and phases
- [Next Steps](NEXT_IMPLEMENTATION_PLAN.md) — remaining work roadmap

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust + Tokio + Axum |
| Audio input (LTC) | cpal |
| MIDI input (MTC) | midir |
| Persistence | JSON file (serde) |
| Frontend | Vanilla HTML/CSS/JS (single page) |
| Real-time | WebSocket + fallback polling |

## Current Status

All core features are complete: LTC/MTC decoding, timecode generator, cue management with bulk import, per-department countdown engine, full UI/UX polish, animated Ready/Go countdown, clean dashboard layout with passed count badge, active strips, uniform-size cue cards (color-only differentiation), cue navigation (click-to-goto, prev/next), and transport controls. Remaining work: unit tests, authentication, and security hardening. See [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for the roadmap.
