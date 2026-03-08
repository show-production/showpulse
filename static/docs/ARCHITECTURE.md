# ShowPulse Architecture

## System Overview

ShowPulse is a self-hosted live show management platform. It has:

- **Backend**: Rust + Tokio + Axum (HTTP REST + WebSocket)
- **Frontend**: Vanilla HTML/CSS/JS served as static files (no build step)
- **Data**: JSON file persistence (`showpulse-data.json`)

```
Browser <--WebSocket--> Axum Server <--> JSON File
Browser <--HTTP REST--> Axum Server
```

## Data Flow

```
User Action
  -> JS function (show.js / manage.js / settings.js / auth.js)
    -> api() call (api.js)
      -> HTTP request to Axum handler
        -> CueStore / TimecodeManager mutation
          -> JSON file write (persistence)
          -> WS broadcast via WsHub
            -> JS ws.onmessage (api.js)
              -> renderFlowCues() (show.js)
                -> DOM update
```

## Backend Architecture

### AppState
```rust
AppState {
  tc_manager: Arc<TimecodeManager>,  // Timecode source orchestration
  store: Arc<CueStore>,              // Department + cue + act CRUD + JSON persistence
  ws_hub: Arc<WsHub>,                // WebSocket broadcast + connected client tracking
  sessions: SessionStore,            // User-based auth session tokens
  timer_lock: TimerLockState,        // Exclusive timer control for Managers
  login_limiter: LoginLimiter,       // Per-IP brute-force rate limiting
}
```

### Security Layers (applied in `main.rs`)
- **Auth middleware** (`require_auth`): Protects POST/PUT/DELETE when users exist. GET passes through freely. When no users are configured, all endpoints are open.
- **CORS**: Restricted to same-origin (`http://localhost:{port}`)
- **Body limit**: 1MB max request body (`DefaultBodyLimit`)
- **Concurrency limit**: 50 concurrent requests (`ConcurrencyLimitLayer`)
- **WebSocket limit**: 100 max concurrent WS connections (`MAX_WS_CLIENTS`)
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

### Timecode Pipeline
```
TimecodeSource (Generator / LTC / MTC)
  -> writes to watch::channel
    -> Countdown engine reads at 10Hz
      -> Computes cue states (upcoming -> warning -> go -> active -> passed)
        -> WS broadcast to all connected clients
```

- **Generator**: Internal Tokio timer, configurable mode/speed/frame-rate
- **LTC**: cpal audio input -> bi-phase clock -> BCD parsing (dedicated OS thread)
- **MTC**: midir MIDI input -> quarter-frame assembly -> timecode (dedicated OS thread)

### Persistence
- Single `showpulse-data.json` file
- Written on every mutation (department/cue/act/user create/update/delete)
- Structure: `{ show_name, departments: [...], cues: [...], acts: [...], users: [...] }`
- Seed data (6 departments, 3 acts, 22 cues) created on first run if file doesn't exist

## Frontend Architecture

### File Structure
```
static/
  index.html          <- Skeleton HTML (~543 lines)
  css/                <- 7 CSS files
    variables.css     <- :root custom properties
    base.css          <- Reset, shared patterns, utilities
    shell.css         <- TopNav, banners, overlays, toasts
    show.css          <- Show view components
    manage.css        <- Manage view components
    settings.css      <- Settings view components
    modals.css        <- All modal dialogs
  js/                 <- 9 JS files
    state.js          <- Constants, state, DOM cache, helpers, CRUD helpers
    api.js            <- HTTP + WebSocket
    auth.js           <- Login, role gating, user management, timer lock
    show.js           <- Show view rendering + interaction
    manage.js         <- Editor: act-grouped cue list, drag-drop, inline edit, multi-select, bulk ops
    timeline.js       <- Timeline editor: zoom/pan, scrub, minimap, tooltips, selection sync
    settings.js       <- Source, devices, generator, theme
    import-export.js  <- Show/cue import & export, analytical print report
    ui-helpers.js     <- Toasts, modals, keyboard, init
  docs/               <- Developer documentation
```

### Load Order
Scripts are loaded synchronously in order:
1. `state.js` -- globals, constants, helpers (no dependencies)
2. `api.js` -- needs state.js globals
3. `auth.js` -- needs state.js + api.js
4. `show.js` -- needs state.js + api.js + auth.js
5. `manage.js` -- needs state.js + api.js
6. `timeline.js` -- needs state.js + manage.js
7. `settings.js` -- needs state.js + api.js
8. `import-export.js` -- needs state.js + api.js
9. `ui-helpers.js` -- needs everything above; calls `initDOM()` and `init()`

### State Management
Global variables in `state.js`:
- `departments`, `cues`, `acts` -- data arrays from API
- `showName` -- current show name
- `activeDeptFilters` -- Set of selected department IDs
- `ws`, `wsConnected` -- WebSocket state
- `cueTableSort` -- current sort column + direction
- `autoPulse` -- auto-scroll toggle (persisted to localStorage, default true)
- `authEnabled`, `authToken`, `authRole`, `authName`, `authDepts` -- auth state
- `hasTimerLock` -- whether current user holds the timer lock
- `DOM` -- cached element references (populated by `initDOM()`)

### Real-time Updates
1. `connectWS()` opens WebSocket to `/ws`
2. Server sends JSON messages at 10Hz with timecode + cue states
3. `ws.onmessage` validates message, updates TC display, calls `renderFlowCues()`
4. `renderFlowCues()` sorts all cues chronologically, DOM-diffs via `diffCueListWithActs()`
5. Cues grouped by act with collapsible divider headers
6. Warning/go cues expand inline with countdown row (READY/3/2/1/GO!) -- no separate zone
7. T- countdown always visible; T+ elapsed shown after trigger

## Cue State Machine

```
upcoming -> warning -> go -> active -> passed
```

- **upcoming**: Countdown > warn_seconds
- **warning**: Countdown <= warn_seconds (inline countdown row on card with traffic-light colors: red -> orange -> yellow -> green on status text, digits, and progress bar). Entry eased with CSS animation chain (warn-enter 0.6s + warn-pulse 1.5s infinite)
- **go**: Triggered -- backend emits this state for 2 seconds (`GO_HOLD_SECONDS`). Frontend shows GO! text + green flash animation on the card
- **active**: Past trigger point + GO hold delay (per-department tracking). Stays active until next same-dept cue triggers or duration expires. Shows T+ elapsed time
- **passed**: Next same-department cue has triggered, or cue duration expired. Shows T+ elapsed time (dimmed)

### Cue Data Model (expanded)
The `Cue` struct includes: `duration` (optional seconds), `armed` (bool -- disarmed cues skipped by engine), `color` (per-cue override), `continue_mode` (stop/auto_continue/auto_follow), `post_wait` (seconds before auto-continue), `act_id` (optional act assignment).

### Authentication & Roles
5-level role system: Viewer(1), CrewLead(2), Operator(3), Manager(4), Admin(5).
- Users authenticate with name + PIN
- `SHOWPULSE_PIN` env var seeds admin user on first run
- No users configured = open access (no login required)
- Managers must acquire timer lock before controlling transport
- Admins bypass timer lock
