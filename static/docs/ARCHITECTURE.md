# ShowPulse Architecture

## System Overview

ShowPulse is a self-hosted live show management platform. It has:

- **Backend**: Rust + Tokio + Axum (HTTP REST + WebSocket)
- **Frontend**: Vanilla HTML/CSS/JS served as static files (no build step)
- **Data**: JSON file persistence (`showpulse-data.json`)

```
Browser ←──WebSocket──→ Axum Server ←──→ JSON File
Browser ←──HTTP REST──→ Axum Server
```

## Data Flow

```
User Action
  → JS function (show.js / manage.js / settings.js)
    → api() call (api.js)
      → HTTP request to Axum handler
        → CueStore / TimecodeManager mutation
          → JSON file write (persistence)
          → WS broadcast via WsHub
            → JS ws.onmessage (api.js)
              → renderFlowCues() (show.js)
                → DOM update
```

## Backend Architecture

### AppState
```rust
AppState {
  tc_manager: Arc<TimecodeManager>,  // Timecode source orchestration
  store: Arc<CueStore>,              // Department + cue CRUD + JSON persistence
  ws_hub: Arc<WsHub>,                // WebSocket broadcast
}
```

### Timecode Pipeline
```
TimecodeSource (Generator / LTC / MTC)
  → writes to watch::channel
    → Countdown engine reads at 10Hz
      → Computes cue states (pending → warning → active → passed)
        → WS broadcast to all connected clients
```

- **Generator**: Internal Tokio timer, configurable mode/speed/frame-rate
- **LTC**: cpal audio input → bi-phase clock → BCD parsing (dedicated OS thread)
- **MTC**: midir MIDI input → quarter-frame assembly → timecode (dedicated OS thread)

### Persistence
- Single `showpulse-data.json` file
- Written on every mutation (department/cue create/update/delete)
- Structure: `{ departments: [...], cues: [...] }`
- Seed data created on first run if file doesn't exist

## Frontend Architecture

### File Structure
```
static/
  index.html          ← Skeleton HTML (~280 lines)
  css/                ← 7 CSS files
    variables.css     ← :root custom properties
    base.css          ← Reset, shared patterns, utilities
    shell.css         ← TopNav, banners, overlays, toasts
    show.css          ← Show view components
    manage.css        ← Manage view components
    settings.css      ← Settings view components
    modals.css        ← All modal dialogs
  js/                 ← 7 JS files
    state.js          ← Constants, state, DOM cache, helpers
    api.js            ← HTTP + WebSocket
    show.js           ← Show view rendering + interaction
    manage.js         ← CRUD operations + table
    settings.js       ← Source, devices, generator, theme
    import-export.js  ← Show/cue import & export
    ui-helpers.js     ← Toasts, modals, keyboard, init
```

### Load Order
Scripts are loaded synchronously in order:
1. `state.js` — globals, constants, helpers (no dependencies)
2. `api.js` — needs state.js globals
3. `show.js` — needs state.js + api.js
4. `manage.js` — needs state.js + api.js
5. `settings.js` — needs state.js + api.js
6. `import-export.js` — needs state.js + api.js
7. `ui-helpers.js` — needs everything above; calls `initDOM()` and `init()`

### State Management
Global variables in `state.js`:
- `departments`, `cues` — data arrays from API
- `activeDeptFilters` — Set of selected department IDs
- `ws`, `wsConnected` — WebSocket state
- `cueTableSort` — current sort column + direction
- `showPassedCues` — toggle for passed cue visibility
- `DOM` — cached element references (populated by `initDOM()`)

### Real-time Updates
1. `connectWS()` opens WebSocket to `/ws`
2. Server sends JSON messages at 10Hz with timecode + cue states
3. `ws.onmessage` updates TC display and calls `renderFlowCues()`
4. `renderFlowCues()` splits cues into 4 groups and renders each section
5. DOM diffing prevents flicker on rapid updates

## Cue State Machine

```
pending → warning → active → passed
```

- **pending**: Countdown > warn_seconds
- **warning**: Countdown ≤ warn_seconds (Ready/Go zone appears)
- **active**: Timecode has passed trigger point (per-department tracking)
- **passed**: Next same-department cue has triggered
