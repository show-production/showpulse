# ShowPulse

Self-hosted, local-WiFi show management platform for live productions. Reads SMPTE LTC and MIDI MTC timecode, manages cue lists for multiple departments, and pushes real-time countdown alerts to crew devices via web browsers.

**Repository:** https://github.com/DGProject2030/showpulse

## Features

- **Three timecode sources:** Built-in generator (Freerun/Countdown/Clock/Loop), SMPTE LTC audio input, MIDI MTC input
- **Frame-accurate timecode:** 10Hz engine broadcasts timecode with frame precision to all connected browsers via WebSocket
- **Per-department cue state:** Each cue stays active until the next cue in the same department triggers
- **Ready / 3-2-1 / Go visualization:** Dedicated countdown zone with traffic-light colors (red->orange->green), backend-driven Go state, progress bar 0->100%, fixed-height layout with pop/flash effects
- **Always-visible countdown:** T- countdown shown during warning/go states, T+ elapsed time after trigger
- **Act grouping:** Cues organized by acts with collapsible divider headers (double-click or floating controls)
- **Floating flow controls:** Bottom-right pill with Now, Auto-scroll, Collapse All, Expand All
- **Warning entry easing:** Smooth CSS animation when cues enter the warning zone
- **Clean dashboard layout:** Passed cues count badge (expandable dropdown), active cue strips, centered timer with transport, Ready/Go zone, scrollable coming cues
- **Uniform cue cards:** All cards same size regardless of state — no layout shifts, color-only tier differentiation with vivid department colors
- **Cue navigation:** Click any cue to load its timecode into Goto, Prev/Next buttons to step through cues
- **Multi-department support:** Lighting, Sound, Video, Pyro, Automation, Stage Management — each with color coding and per-department filtering
- **Cue numbering:** Auto-generated (Q1, Q2, Q3...) or custom, displayed throughout the UI
- **Cue fields:** Armed/disarmed toggle, optional duration, per-cue color override, continue mode (stop/auto-continue/auto-follow), post-wait timing
- **Full cue management:** CRUD for departments, cues, and acts, sortable table, department filtering, bulk CSV/JSON import
- **Show name:** Configurable show name displayed in the navbar
- **User-based authentication:** 5 roles (Viewer/CrewLead/Operator/Manager/Admin), per-user department assignment, exclusive timer lock for Managers
- **QR code onboarding:** Auto-generated QR code with server URL for quick crew device setup
- **Security hardening:** CORS same-origin, request body limits (1MB), concurrency limits (50), WS client limit (100), security headers
- **Test coverage:** 73 tests — unit tests for timecode math and cue store, integration tests for all REST endpoints
- **Zero dependencies at runtime:** Single Rust binary, JSON file persistence, no database
- **Responsive UI:** Works on desktop, tablet, and phone — dark theme for backstage use with toast notifications and 44px touch targets

## Quick Start

```bash
git clone https://github.com/DGProject2030/showpulse.git
cd showpulse
cargo run
```

Open http://localhost:8080 — demo data with 6 departments, 3 acts, and 22 cues loads automatically on first run.

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

All core features are complete: LTC/MTC decoding, timecode generator, cue management with bulk import (including armed/duration/color/continue-mode fields), per-department countdown engine with backend-driven Go state, act grouping with collapsible dividers, floating flow controls (Now/Auto/Collapse/Expand), always-visible T-/T+ countdown, warning entry easing, vivid department colors, full UI/UX polish, animated Ready/Go countdown with traffic-light colors, clean dashboard layout with passed count badge, active strips, uniform-size cue cards (color-only differentiation), cue navigation (click-to-goto, prev/next), show name, user-based authentication with 5 roles and timer lock, QR onboarding, security hardening, and 73 unit/integration tests. 43 API endpoints + WebSocket. Remaining work: multi-show support, generator presets, print view, rate limiting, and portable single-binary distribution. See [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md) for the roadmap.
