# Getting Started with ShowPulse

## Prerequisites

- **Rust toolchain** - Install from https://rustup.rs
  - Windows: also requires Visual Studio Build Tools with "Desktop development with C++" workload
  - macOS/Linux: works out of the box
- **Git** - to clone the repository

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/DGProject2030/showpulse.git
cd showpulse
```

### 2. Run the app

```bash
cargo run
```

First build takes a few minutes to compile dependencies (including cpal for audio and midir for MIDI). Subsequent runs are near-instant.

You'll see:

```
LTC decoder initialized
MTC decoder initialized
ShowPulse starting on http://0.0.0.0:8080
```

### 3. Open in browser

```
http://localhost:8080
```

On first launch, the app automatically creates 6 demo departments, 3 acts, and 22 sample cues so you can start testing immediately.

## Accessing from Other Devices on Your Network

ShowPulse is designed for crew members to connect from their own devices over WiFi.

### Find your machine's IP

**Windows:**
```powershell
ipconfig
```
Look for the `IPv4 Address` under your active network adapter (e.g. `192.168.1.x` or `10.x.x.x`).

**macOS:**
```bash
ipconfig getifaddr en0
```

**Linux:**
```bash
hostname -I
```

### Open the firewall (if needed)

**Windows (run PowerShell as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "ShowPulse" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

**Linux (ufw):**
```bash
sudo ufw allow 8080/tcp
```

**macOS:** The firewall prompt should appear automatically. Click "Allow".

### Connect from other devices

From any device on the same WiFi network, open:

```
http://<your-ip>:8080
```

## Using the App

### Show Tab (default)

The main operational view for live shows. The dashboard is organized into clear vertical sections:

1. **Passed cues badge** (top) — small pill showing "N passed". Click to expand a dropdown listing all passed cues with department colors and timecodes.
2. **Active cue strips** — compact single-line rows for currently triggered cues, one per department. Green dept-colored left border with checkmark and label.
3. **Timer + Controls** (center) — large timecode display with meta info (state/fps/source) on the left, transport controls below: Prev/Play/Pause/Stop/Next + Goto timecode input.
4. **Ready/Go zone** — dedicated countdown for the next imminent cue. "READY" text and progress bar follow traffic-light colors throughout (red->orange->yellow->green). Countdown digits (3, 2, 1) appear alongside with matching colors. At zero: "GO! — Department" in green with flash effect. Progress bar fills from 0% to 100%. Backend-driven Go state ensures reliable 2-second GO! display. Fixed-height layout with no size jumps, smooth in-place DOM updates.
5. **Coming cues** (bottom) — scrollable list of upcoming cues grouped by act. Act dividers show act name as inline text between separator lines. All cards are the same size — state is shown through color and opacity only (no layout shifts). Cards show T- countdown (always visible) and T+ elapsed time after trigger.

**Floating controls** (bottom-right pill):
- **Now** — jump to the current/next cue in the list
- **Auto** — toggle auto-scroll to follow the current cue
- **Collapse** — collapse all act groups
- **Expand** — expand all act groups

You can also double-click an act header to collapse/expand that individual group.

**Interactions:**
- **Click any cue card, active strip, or passed item** to load its timecode into the Goto field
- **Prev/Next buttons** step through cues in timecode order, loading each into Goto
- **Scroll down** in the coming cues section to auto-collapse the above-timer sections (space freed up)
- **Department filter chips** (sidebar) to show/hide cues by department

**Keyboard shortcuts:**
- `Space` - Play
- `P` - Pause
- `Escape` - Stop
- `N` - Next cue (loads TC into Goto)
- `B` - Previous cue (loads TC into Goto)
- `G` - Focus the goto timecode input
- `S` - Toggle sidebar
- `A` - Toggle auto-scroll
- `C` - Jump to current cue

### Editor Tab

For setting up and editing your show.

- **Left panel:**
  - **Departments** — Create, edit, and delete departments (name + color)
  - **Acts** — Create, edit, and delete acts (name + sort order). Shows cue count per act. Duplicate act button clones an entire act with all cues (prompts for time offset)
- **Right panel:** Act-grouped cue list with:
  - **Collapsible act headers** showing cue count and time span per act. Click to collapse/expand
  - **Drag-and-drop** — Grip handle on each cue to drag within or between acts. Drop on act headers to move cues. Auto-calculates new timecodes
  - **Inline quick edit** — Double-click label, timecode, department, or warning time to edit in place. Enter saves, Escape cancels
  - **Multi-select** — Checkbox per cue, shift-click for range select, act header checkbox selects all cues in that act
  - **Bulk action bar** — Appears when cues are selected. Actions: move to act, duplicate, delete, arm/disarm
  - **Add cue** — Button on each act header to add a cue directly to that act
  - **Duplicate cue** — One-click duplicate with TC+5s offset
- **Visual timeline strip** (above cue list):
  - Horizontal bar with act regions and department-colored cue markers
  - Green playhead synced to current timecode (updates at 5Hz)
  - Click any marker to scroll to that cue in the list
- Click **Import** to bulk-import cues from CSV or JSON files

### Importing Cues

ShowPulse supports bulk cue import via the **Import** button in the Editor tab. Importing **replaces** all existing cues (not appends). Full show import from Settings replaces departments, cues, and acts.

**CSV format:** Header row with columns like `timecode`, `label`, `department`, `warn`, `notes`. The parser recognizes common aliases (e.g., "dept" for "department", "tc" for "timecode"). Department names are automatically matched to existing departments.

**JSON format:** Either a bare array `[{...}, {...}]` or wrapped `{ "cues": [{...}, {...}] }`. Each cue needs at minimum a `department_id` (UUID).

Test files are included in the repository:
- `test-import-show.json` — Full show with 6 departments + 30 cues
- `test-import-cues.csv` — 30 cues in CSV format with department names

### Settings Tab

- **Timecode source:** Generator (built-in), LTC, or MTC
- **Frame rate:** 24, 25, 29.97df, 30 fps
- **Generator mode:** Freerun, Countdown, Clock, Loop
- **Start timecode** and **speed** controls
- **Show name:** Configurable name displayed in the navbar
- **Theme customization:** Background, accent, and warning colors (live preview); timecode display size
- **Export/Import:** Save or load your entire show (departments + cues + acts + show name) as a JSON file

## Using LTC (SMPTE Linear Timecode)

LTC allows ShowPulse to sync to timecode from a DAW, timecode generator, or any professional audio source.

1. Go to the **Settings** tab
2. Select **LTC** as the timecode source
3. An **Audio Input Device** dropdown appears
4. Click the refresh button to list available audio inputs
5. Select your audio interface input that receives the LTC signal
6. The status line shows "Listening on: [device name]" when active
7. Feed an LTC signal into that audio input — ShowPulse will decode it in real-time

**Tips:**
- LTC works at any standard sample rate (44.1kHz, 48kHz, 96kHz)
- The signal should be a clean line-level LTC feed (not amplified mic signal)
- The decoder handles 24/25/29.97df/30 fps LTC

## Using MTC (MIDI Time Code)

MTC allows ShowPulse to sync to timecode from MIDI-capable devices (DAWs, show controllers, etc.).

1. Go to the **Settings** tab
2. Select **MTC** as the timecode source
3. A **MIDI Input Port** dropdown appears
4. Click the refresh button to list available MIDI ports
5. Select the MIDI port receiving MTC
6. The status line shows "Listening on: [port name]" when active
7. Start MTC playback from your source — ShowPulse receives both quarter-frame and full-frame messages

**Tips:**
- MTC quarter-frame messages have a 2-frame inherent latency (8 messages to transmit one full timecode)
- Full-frame SysEx messages provide instant sync (used for locate/jump)
- Ensure your MIDI routing sends MTC to ShowPulse's selected port

## Authentication (Optional)

ShowPulse supports user-based authentication with 5 role levels. When enabled, it protects operations based on user role while keeping the Show view accessible.

### Role Hierarchy

| Role | Access |
|------|--------|
| Viewer | Show view only (filtered to assigned departments) |
| Crew Lead | Show view only (filtered to assigned departments) |
| Operator | Show + Editor |
| Manager | Show + Editor + Settings + timer control (must acquire lock) |
| Admin | Full access including user management |

### Enable authentication

Set the `SHOWPULSE_PIN` environment variable before starting to auto-create an admin user:

**Windows (PowerShell):**
```powershell
$env:SHOWPULSE_PIN = "1234"
cargo run
```

**macOS/Linux:**
```bash
SHOWPULSE_PIN=1234 cargo run
```

This creates an admin user named "admin" with the given PIN. From the Admin panel, you can then create additional users with different roles and department assignments.

When no PIN is set and no users exist (default), all operations are open — no login required.

### Timer Lock

Managers must acquire the timer lock before controlling transport (Play/Pause/Stop/Goto). Only one Manager can hold the lock at a time. Admins bypass the lock entirely.

### QR Code for Crew Onboarding

Navigate to `/api/qr` in your browser to display a QR code with the server URL. Crew members can scan this with their phones to quickly connect to ShowPulse.

## Configuration

All settings are via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOWPULSE_PORT` | `8080` | Server port |
| `SHOWPULSE_BIND` | `0.0.0.0` | Bind address (use `127.0.0.1` for local-only) |
| `SHOWPULSE_DATA_FILE` | `showpulse-data.json` | Data file path |
| `SHOWPULSE_PIN` | *(none)* | PIN for admin user (unset + no users = open access) |

## Data Storage

All data is saved to `showpulse-data.json` in the app directory (or the path set via `SHOWPULSE_DATA_FILE`). This includes departments, cues, acts, show name, and users. To reset to demo data, delete this file and restart.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 8080 already in use | Stop the other process, or set `SHOWPULSE_PORT=3000` (or any free port) before starting |
| Can't connect from other devices | Check firewall rules and ensure devices are on the same network |
| No cues showing on Show tab | Go to Editor tab and add departments + cues, or delete `showpulse-data.json` to reset demo data |
| WebSocket dot is red | The real-time connection dropped. It auto-reconnects every 2 seconds. The app falls back to polling in the meantime |
| Build fails on Windows | Ensure Visual Studio Build Tools are installed with the C++ workload |
| No audio devices listed for LTC | Ensure a microphone/audio input is available and not exclusively held by another app |
| No MIDI ports listed for MTC | Ensure a MIDI device or virtual MIDI port is available on the system |
| LTC not decoding | Check that the audio input level is adequate (line level) and the correct input device is selected |
