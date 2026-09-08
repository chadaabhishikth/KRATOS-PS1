#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  THE PANIC BUTTON
#  ESP32 refuses to join the venue Wi-Fi? Run this. The dashboard lights up
#  with simulated data within ~1 s and the pitch continues.
#    ./scripts/panic.sh
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."
exec node ghost/ghost.js
