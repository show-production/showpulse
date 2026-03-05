# ShowPulse

Self-hosted, local-WiFi show management platform for live productions. Reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments, and pushes real-time countdown alerts to crew devices via web browsers.

**Repository:** https://github.com/DGProject2030/showpulse

## Features

- **Three timecode sources:** Built-in generator (Freerun/Countdown/Clock/Loop), SMPTE LTC audio input, MIDI MTC input
- **Real-time countdowns:** 10Hz engine broadcasts cue states to all connected browsers via WebSocket
- **Per-department cue state:** Each cue stays active until the next cue in the same department triggers
- **Ready / 3-2-1 / Go visualization:** Large countdown display for the next imminent cue
- **Multi-department support:** Lighting, Sound, Video, Pyro, Automation, Stage Management — each with color coding and per-department filtering
- **Cue numbering:** Auto-generated (Q1, Q2, Q3...) or custom, displayed throughout the UI
- **Full cue management:** CRUD for departments and cues, sortable table, department filtering, bulk CSV/JSON import
- **Zero dependencies at runtime:** Single Rust binary, JSON file persistence, no database
- **Responsive UI:** Works on desktop, tablet, and phone — dark theme for backstage use with sticky timecode header, toast notifications, and 44px touch targets

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

All core features are complete: LTC/MTC decoding, timecode generator, cue management with bulk import, per-department countdown engine, full UI/UX polish (15 items + 5 user feedback items), and Ready/Go visualization. Remaining work: unit tests, authentication, and security hardening. See [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for the roadmap.
