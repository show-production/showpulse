# ShowPulse

Self-hosted, local-WiFi show management platform for live productions. Reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments, and pushes real-time countdown alerts to crew devices via web browsers.

**Repository:** https://github.com/DGProject2030/showpulse

## Features

- **Three timecode sources:** Built-in generator (Freerun/Countdown/Clock/Loop), SMPTE LTC audio input, MIDI MTC input
- **Real-time countdowns:** 10Hz engine broadcasts cue states to all connected browsers via WebSocket
- **Multi-department support:** Lighting, Sound, Video, Pyro, Automation, Stage Management — each with color coding and per-department filtering
- **Full cue management:** CRUD for departments and cues, sortable table, department filtering, JSON export/import
- **Zero dependencies at runtime:** Single Rust binary, JSON file persistence, no database
- **Responsive UI:** Works on desktop, tablet, and phone — dark theme for backstage use

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

Phases 1-2 (LTC + MTC decoding) are complete. The core pipeline works end-to-end: timecode source → countdown engine → WebSocket → crew browsers. See [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for remaining work.
