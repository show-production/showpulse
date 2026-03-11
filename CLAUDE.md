# ShowPulse Project Instructions

## Test Network Setup

When the user asks to "set up the test network" or "start agents", follow these steps:

### Step 1: Start the server (in background)
```bash
SHOWPULSE_PORT=4000 ./showpulse.exe
```

### Step 2: Open ShowPulse on all 6 agents
SSH into each agent and open a browser with auto-login. Run all 6 in parallel:
```
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no t@pc1 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=FS&pin=1234'"
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no t@pc2 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=SoundDesk&pin=1234'"
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no t@pc3 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=LaserDesk&pin=1234'"
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no t@pc4 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=automationDesk&pin=1234'"
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ralphlopp5@pc5 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=backStage&pin=1234'"
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ralph6@pc6 "DISPLAY=:0 xdg-open 'http://192.168.10.82:4000/?user=pyroDesk&pin=1234'"
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

## Build
```bash
cargo build --release
```
After changing static files, run `touch src/main.rs` before building (rust-embed caches the file list).
