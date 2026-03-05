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

First build takes a few minutes to compile dependencies. Subsequent runs are near-instant.

You'll see:

```
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

- **Timecode display** at the top shows current time
- **Transport controls:** Play, Pause, Stop, and Goto timecode
- **Department filter chips** let you show/hide cues by department
- **Cue cards** grouped by state: Active (green glow), Warning (amber pulse), Upcoming, Passed
- Each card shows a countdown timer and progress bar

**Keyboard shortcuts:**
- `Space` - Play
- `P` - Pause
- `Escape` - Stop
- `G` - Focus the goto timecode input

### Manage Tab

For setting up your show.

- **Left panel:** Create, edit, and delete departments (name + color)
- **Right panel:** Cue list table with:
  - Department dropdown filter
  - Clickable column headers to sort (Timecode, Label, Department, Warn)
  - Edit and delete buttons per cue
- Click **+ Add** to create new departments or cues

### Settings Tab

- **Timecode source:** Generator (built-in), LTC, or MTC
- **Frame rate:** 24, 25, 29.97df, 30 fps
- **Generator mode:** Freerun, Countdown, Clock, Loop
- **Start timecode** and **speed** controls
- **Theme customization:** Background, accent, and warning colors; timecode display size
- **Export/Import:** Save or load your show as a JSON file

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
