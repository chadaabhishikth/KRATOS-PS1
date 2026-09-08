#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KRATOS-PS1 — start broker + engine (idempotent, background-safe)
#   ./scripts/start_stack.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

command -v mosquitto >/dev/null 2>&1 || {
  echo "ERROR: mosquitto not installed.";
  echo "  Debian/Ubuntu : sudo apt install mosquitto mosquitto-clients";
  echo "  macOS (brew)  : brew install mosquitto";
  exit 1
}

[ -d node_modules ] || npm install --no-audit --no-fund

# 1) Mosquitto broker
if pgrep -f "mosquitto -c broker/mosquitto.conf" >/dev/null 2>&1; then
  echo "OK  broker already running (:1883)"
else
  nohup mosquitto -c broker/mosquitto.conf > broker.log 2>&1 &
  echo $! > broker.pid
  sleep 1
  echo "OK  broker up (:1883)  pid $(cat broker.pid)"
fi

# 2) Node telemetry engine (Socket.IO + demo dashboard)
if pgrep -f "node engine/server.js" >/dev/null 2>&1; then
  echo "OK  engine already running (:3000)"
else
  nohup node engine/server.js > engine.log 2>&1 &
  echo $! > engine.pid
  sleep 1
  echo "OK  engine up (http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000)  pid $(cat engine.pid)"
fi

echo
echo "Next — start the Ghost feed (this is also your PANIC button):"
echo "    node ghost/ghost.js"
echo
echo "Watch the wire (any packet from Ghost or ESP32):"
echo "    mosquitto_sub -h 127.0.0.1 -t 'kratos/ps1/#' -v"
