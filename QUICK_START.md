# ShowPulse — Quick Start

## One-File Installation

ShowPulse is a single executable. No installer, no dependencies, no configuration required.

### Step 1: Download

Download `showpulse.exe` (4.1 MB) from the [Releases page](https://github.com/DGProject2030/showpulse/releases).

### Step 2: Run

Double-click `showpulse.exe` — or from a terminal:

```
showpulse.exe
```

### Step 3: Open

Open your browser to:

```
http://localhost:8080
```

That's it. You're running.

---

## Connect Your Crew

Everyone on the same network can access ShowPulse by opening:

```
http://<your-ip>:8080
```

To find your IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

---

## Optional: Set an Admin PIN

To protect your show with user accounts:

```
set SHOWPULSE_PIN=1234
showpulse.exe
```

This creates an admin user (name: `admin`, PIN: `1234`) on first run. Log in, then add crew members from Settings > Users.

Without a PIN, all endpoints are open — anyone on the network can control the show.

---

## Environment Variables

All optional. Defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOWPULSE_PORT` | `8080` | HTTP port |
| `SHOWPULSE_BIND` | `0.0.0.0` | Bind address (0.0.0.0 = all interfaces) |
| `SHOWPULSE_PIN` | — | Admin PIN (seeds admin user on first run) |
| `SHOWPULSE_DATA_FILE` | `showpulse-data.json` | Data file path |

---

## What's Included

The single binary contains everything:

- Web UI (Show view, Editor, Settings)
- Timecode engine (Generator, LTC audio, MTC MIDI)
- Real-time WebSocket broadcast
- User management with 5 roles
- Hebrew + English interface
- Mobile-optimized layout

---

## Building From Source

```
git clone https://github.com/DGProject2030/showpulse.git
cd showpulse
cargo build --release
```

Binary at: `target/release/showpulse.exe` (or `showpulse` on Linux/Mac).
