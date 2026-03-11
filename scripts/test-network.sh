#!/usr/bin/env bash
#
# ShowPulse Test Network — open clients on all 6 Ralph Loop agents
#
# Usage:
#   bash scripts/test-network.sh              # disable sleep + open browsers
#   bash scripts/test-network.sh --check      # connectivity check only
#   bash scripts/test-network.sh --no-sleep   # disable sleep/lock only
#

set -euo pipefail

SERVER="192.168.10.82"
PORT="4000"
PIN="1234"

# hostname|ssh_user|showpulse_user
AGENTS=(
  "pc1|t|FS"
  "pc2|t|SoundDesk"
  "pc3|t|LaserDesk"
  "pc4|t|automationDesk"
  "pc5|ralphlopp5|backStage"
  "pc6|ralph6|pyroDesk"
)

SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes"

check() {
  echo "Checking agent connectivity..."
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r host user spuser <<< "$entry"
    if ssh $SSH_OPTS "${user}@${host}" "echo ok" &>/dev/null; then
      echo "  $host ($spuser) : ONLINE"
    else
      echo "  $host ($spuser) : OFFLINE"
    fi
  done
}

disable_sleep() {
  echo "Disabling screen sleep/lock on all agents..."
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r host user spuser <<< "$entry"
    if ssh $SSH_OPTS "${user}@${host}" bash -s <<'REMOTE' 2>/dev/null; then
      export DISPLAY=:0

      # Disable DPMS (monitor power saving)
      xset -dpms 2>/dev/null || true
      # Disable X11 screen saver / blanking
      xset s off 2>/dev/null || true
      xset s noblank 2>/dev/null || true

      # Connect to the real user D-Bus session (Linux Mint / Cinnamon)
      export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus

      # Kill stale dconf-service instances (they can silently eat writes)
      killall dconf-service 2>/dev/null || true

      # Disable Cinnamon screensaver activation and lock
      gsettings set org.cinnamon.desktop.screensaver idle-activation-enabled false 2>/dev/null || true
      gsettings set org.cinnamon.desktop.screensaver lock-enabled false 2>/dev/null || true
      gsettings set org.cinnamon.desktop.session idle-delay 0 2>/dev/null || true

      # Disable power management screen blanking
      gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0 2>/dev/null || true
      gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0 2>/dev/null || true
      gsettings set org.cinnamon.settings-daemon.plugins.power idle-dim-ac false 2>/dev/null || true
      gsettings set org.cinnamon.settings-daemon.plugins.power idle-dim-battery false 2>/dev/null || true
      gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
      gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true

      # Kill cinnamon-screensaver so it respawns with new settings
      kill -9 $(pgrep -f cinnamon-screensaver) 2>/dev/null || true

      # Prevent systemd suspend/hibernate
      sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
REMOTE
      echo "  $host ($spuser) : OK"
    else
      echo "  $host ($spuser) : FAILED"
    fi
  done
}

open_all() {
  disable_sleep
  echo ""
  echo "Closing browsers and cleaning session restore..."
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r host user spuser <<< "$entry"
    ssh $SSH_OPTS "${user}@${host}" bash -s <<'CLEANUP' 2>/dev/null || true
      pkill -f firefox 2>/dev/null || true
      sleep 1
      find ~/.mozilla/firefox/ -name "sessionstore*" -delete 2>/dev/null
      find ~/.mozilla/firefox/ -name "recovery.jsonlz4" -delete 2>/dev/null
      find ~/.mozilla/firefox/ -name "recovery.baklz4" -delete 2>/dev/null
CLEANUP
  done
  sleep 2
  echo "Opening ShowPulse on all agents (http://${SERVER}:${PORT})"
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r host user spuser <<< "$entry"
    url="http://${SERVER}:${PORT}/?user=${spuser}&pin=${PIN}"
    if ssh $SSH_OPTS "${user}@${host}" "DISPLAY=:0 nohup firefox --new-window '${url}' >/dev/null 2>&1 &" 2>/dev/null; then
      echo "  $host -> $spuser : OK"
    else
      echo "  $host -> $spuser : FAILED"
    fi
  done
}

case "${1:-}" in
  --check)    check ;;
  --no-sleep) disable_sleep ;;
  *)          open_all ;;
esac
