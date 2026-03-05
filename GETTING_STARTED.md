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

On first launch, the app automatically creates 6 demo departments and 22 sample cues so you can start testing immediately.

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

The main operational view for live shows.

- **Sticky timecode display** at the top (stays visible when scrolling)
- **Transport controls:** Play, Pause, Stop, and Goto timecode
- **Ready / 3-2-1 / Go display:** Shows the next imminent cue with countdown, consistent layout across all states
- **Department filter chips** let you show/hide cues by department
- **Cue cards** in stable timecode order with cue numbers — state changes only affect color and border, cues never shift position
- Each card shows a countdown timer and progress bar
- Cues stay **active until replaced** by the next cue in the same department
- **Show/Hide Passed** toggle to declutter the view during a show

**Keyboard shortcuts:**
- `Space` - Play
- `P` - Pause
- `Escape` - Stop
- `G` - Focus the goto timecode input

### Manage Tab

For setting up your show.

- **Left panel:** Create, edit, and delete departments (name + color)
- **Right panel:** Cue list table with:
  - **#** column showing cue numbers (auto-generated Q1, Q2, Q3... or custom)
  - Department dropdown filter
  - Clickable column headers to sort (# , Timecode, Label, Department, Lead Time)
  - Edit and delete buttons per cue
- Click **+ Add** to create new departments or cues
- Click **Import** to bulk-import cues from CSV or JSON files

### Importing Cues

ShowPulse supports bulk cue import via the **Import** button in the Manage tab.

**CSV format:** Header row with columns like `timecode`, `label`, `department`, `warn`, `notes`. The parser recognizes common aliases (e.g., "dept" for "department", "tc" for "timecode"). Department names are automatically matched to existing departments.

**JSON format:** Either a bare array `[{...}, {...}]` or wrapped `{ "cues": [{...}, {...}] }`. Each cue needs at minimum a `department_id` (UUID).

Test files are included in the repository:
- `test-import-show.json` — Full show with 8 departments + 72 cues
- `test-import-cues.csv` — 74 cues in CSV format with department names

### Settings Tab

- **Timecode source:** Generator (built-in), LTC, or MTC
- **Frame rate:** 24, 25, 29.97df, 30 fps
- **Generator mode:** Freerun, Countdown, Clock, Loop
- **Start timecode** and **speed** controls
- **Theme customization:** Background, accent, and warning colors (live preview); timecode display size
- **Export/Import:** Save or load your entire show (departments + cues) as a JSON file

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

## Data Storage

All data is saved to `showpulse-data.json` in the app directory. To reset to demo data, delete this file and restart.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 8080 already in use | Stop the other process, or edit `src/config.rs` to change the port |
| Can't connect from other devices | Check firewall rules and ensure devices are on the same network |
| No cues showing on Show tab | Go to Manage tab and add departments + cues, or delete `showpulse-data.json` to reset demo data |
| WebSocket dot is red | The real-time connection dropped. It auto-reconnects every 2 seconds. The app falls back to polling in the meantime |
| Build fails on Windows | Ensure Visual Studio Build Tools are installed with the C++ workload |
| No audio devices listed for LTC | Ensure a microphone/audio input is available and not exclusively held by another app |
| No MIDI ports listed for MTC | Ensure a MIDI device or virtual MIDI port is available on the system |
| LTC not decoding | Check that the audio input level is adequate (line level) and the correct input device is selected |
