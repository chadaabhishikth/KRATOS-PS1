#!/usr/bin/env bash
# KRATOS-PS1 — simulate a TAP on the vibration sensor (4-second burst).
# Use this mid-demo to show the VIBRATION alarm if the physical ESP32 is
# offline; it speaks the exact same wire contract as a real tap.
#    ./scripts/tap.sh
cd "$(dirname "$0")/.."
node ghost/ghost.js --spike
