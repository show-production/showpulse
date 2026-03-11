#!/usr/bin/env bash
#
# ShowPulse Test Network — open clients on all 6 Ralph Loop agents
#
# Usage:
#   bash scripts/test-network.sh          # open browsers on all agents
#   bash scripts/test-network.sh --check  # connectivity check only
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

open_all() {
  echo "Opening ShowPulse on all agents (http://${SERVER}:${PORT})"
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r host user spuser <<< "$entry"
    url="http://${SERVER}:${PORT}/?user=${spuser}&pin=${PIN}"
    if ssh $SSH_OPTS "${user}@${host}" "DISPLAY=:0 xdg-open '${url}'" 2>/dev/null; then
      echo "  $host -> $spuser : OK"
    else
      echo "  $host -> $spuser : FAILED"
    fi
  done
}

case "${1:-}" in
  --check) check ;;
  *)       open_all ;;
esac
