# ShowPulse Project Instructions

## Test Network Setup

When the user asks to "set up the test network" or "start agents", follow these steps:

### Step 1: Start the server (in background)
```bash
SHOWPULSE_PORT=4000 ./showpulse.exe
```

### Step 2: Open ShowPulse on all 6 agents
```bash
bash scripts/test-network.sh
```
This automatically disables screen sleep/lock on all agents, then opens browsers with auto-login.

### Other script modes
```bash
bash scripts/test-network.sh --check      # connectivity check only
bash scripts/test-network.sh --no-sleep   # disable sleep/lock only (no browser)
```

### Agent Inventory

| Agent | SSH User   | ShowPulse User | PIN  |
|-------|------------|----------------|------|
| pc1   | t          | FS             | 1234 |
| pc2   | t          | SoundDesk      | 1234 |
| pc3   | t          | LaserDesk      | 1234 |
| pc4   | t          | automationDesk | 1234 |
| pc5   | ralphlopp5 | backStage      | 1234 |
| pc6   | ralph6     | pyroDesk       | 1234 |

- Server LAN IP: `192.168.10.82`
- Server port: `4000` (via `SHOWPULSE_PORT`)
- Agents reachable via Tailscale SSH (hostnames pc1-pc6)
- Auto-login URL format: `http://192.168.10.82:4000/?user=NAME&pin=1234`
- Sleep prevention: disables DPMS, X11 screensaver, GNOME lock, and systemd suspend

## Build
```bash
cargo build --release
```
After changing static files, run `touch src/main.rs` before building (rust-embed caches the file list).
