# KRATOS-PS1 — Intelligent Conveyor Belt Health Monitoring & Predictive Maintenance

**SIH 2026** · Iron-ore conveyor belt joint rupture detection — IoT edge (ESP32) → MQTT (Mosquitto) → Node telemetry engine → Socket.IO → React/Vite (6-page SCADA-style frontend: **Home · Live Feed · Alerts · Settings**).

```
 ADXL345 (I2C) ─┐
                ├─► ESP32 ──► Wi-Fi ──► Mosquitto (:1883) ──► Node engine ──► Socket.IO (:3000) ──► React app
 ACS712 (analog)┘                ▲        kratos/ps1/telemetry      │
                                  │                                 ├─ telemetry        (every packet)
                          GHOST (synthetic feed + panic button)     ├─ alerts_history   (on each new alert)
                                                                    ├─ settings_updated (on threshold change)
                                                                    └─ snapshot         (on client connect)
```

## Payload contract (locked — Ghost and ESP32 are interchangeable)

Published to **`kratos/ps1/telemetry`** at ~2 Hz (presence: `kratos/ps1/status`):

```json
{
  "timestamp": "2026-09-08T22:18:00Z",
  "source": "ghost",
  "digital_twin": { "fault_zone": 3 },
  "rul_days": 42,
  "telemetry": {
    "vibration_g": 1.45,
    "current_amps": 12.4,
    "temperature_c": 45.2,
    "distance_mm": 500,
    "magnetic_flux_ut": 120,
    "speed_rpm": 1450
  },
  "vision_cam": {
    "anomaly_detected": false,
    "issue_type": "None",
    "confidence": 0.0
  }
}
```

| field | sensor | notes |
|---|---|---|
| `timestamp` | — | ISO-8601 UTC; demo clock guard keeps the year at **2026** |
| `source` | — | `ghost` or `esp32` — the dashboard badges this |
| `digital_twin.fault_zone` | — | int 1–6, conveyor section (digital twin view) |
| `rul_days` | AI/ML | 42 in demo → renders **green** (UI FIX 2) |
| `telemetry.vibration_g` | ADXL345 | RMS over ~200 ms burst |
| `telemetry.current_amps` | ACS712 | drive current → load/tension |
| `telemetry.temperature_c` | DS18B20 | gauge shows **°C** (UI FIX 1) |
| `telemetry.distance_mm` | VL53L0X | belt surface clearance |
| `telemetry.magnetic_flux_ut` | SS49E | Hall, drive motor |
| `telemetry.speed_rpm` | A3144 | pulley encoder |
| `vision_cam.*` | YOLOv8 | Ghost cycles an anomaly **every 20 s for 5 s**: `Edge Tear @ 0.92` |

**Firmware reality check:** the board physically reads only ADXL345 + ACS712 (+ chip temp as the DS18B20 stand-in). `distance_mm`, `magnetic_flux_ut`, `speed_rpm` are the same demo constants the Ghost pumps, so the contract stays complete until those sensors are wired.

## Socket.IO events (what React binds to)

| event | direction | payload | drives |
|---|---|---|---|
| `telemetry` | server → all | the payload above | Home, Live Feed |
| `alerts_history` | server → all | **full array (≤50)**, re-emitted on every new alert | Alerts table |
| `settings_updated` | server → all | merged settings object | Settings page |
| `update_settings` | client → server | `{ "max_vib": 3.0, "max_temp": 60, "max_current": 15 }` | engine alarm logic |
| `snapshot` | server → new client | `{ last, history[120], alerts, settings, topics, broker }` | initial state |
| `broker` | server → all | `{ state: 'online' \| 'offline' }` | status chip |

### Alert engine (in the engine, not the frontend)

| type | fires when | severity |
|---|---|---|
| `VIBRATION_HIGH` | `vibration_g > settings.max_vib` (default **2.0 g**) | warning; critical if > 1.5× limit |
| `TEMP_HIGH` | `temperature_c > settings.max_temp` (default **60 °C**) | warning / critical as above |
| `CURRENT_HIGH` | `current_amps > settings.max_current` (default **15 A**) | warning / critical as above |
| `VISION_ANOMALY` | `vision_cam.anomaly_detected === true` | critical |

Alert object: `{ id, ts, type, severity, message, zone, value, limit, source }`.
Array capped at **last 50**, per-type **10 s cooldown** (no alert storms). Thresholds are **dynamic** — `update_settings` changes them live; unknown/invalid keys are ignored + logged.

## Tonight — the pipeline (3 terminals)

```bash
# 0) once
npm install

# terminal 1 — broker
mosquitto -c broker/mosquitto.conf
#   …or via Docker:
# docker run -d --name kratos-mosq -p 1883:1883 \
#   -v "$PWD/broker/mosquitto.conf:/mosquitto/config/mosquitto.conf" \
#   eclipse-mosquitto:2 -c /mosquitto/config/mosquitto.conf

# terminal 2 — engine (Socket.IO + reference dashboard on :3000)
node engine/server.js

# terminal 3 — Ghost (or: ./scripts/panic.sh)
node ghost/ghost.js
```

- **Rehearsal test (run every morning):** `node scripts/test-features.js` — proves settings, alerts, and the vision cycle end-to-end (kills the ghost while running; restart it after).
- **Pipeline probe:** `node scripts/verify.js`
- **Watch the wire:** `mosquitto_sub -h 127.0.0.1 -t 'kratos/ps1/#' -v`
- **Reference dashboard** (renders the corrected 6-feature UI live): `http://localhost:3000`
- **Teammates (Vite):** `const socket = io('http://192.168.x.x:3000')` → bind `snapshot` / `telemetry` / `alerts_history` / `settings_updated`, emit `update_settings`. Map state exactly to `pkt.telemetry.vibration_g`, `pkt.digital_twin.fault_zone`, etc. Engine CORS is open (`*`).
- All-in-one: `./scripts/start_stack.sh` · stop: `./scripts/stop_stack.sh`

### The 3 UI fixes (baked into `engine/public/index.html`)

1. **Temperature gauge** shows **°C** — the "45% Load" label belonged to the Belt Load gauge.
2. **RUL thresholds** — `≥30 d green · 14–29 d amber · <14 d red`. **42 days = green.**
3. **Date hardcoded to 2026** — `SIH 2026 · 08 Sep 2026`, independent of wall clock.

## Tonight — Phase 2: hardware hot swap

1. Flash `firmware/kratos_ps1/kratos_ps1.ino` (Arduino IDE: **esp32** boards + **PubSubClient**; edit `WIFI_SSID/WIFI_PASS/MQTT_HOST` first; upload; Serial @115200 prints the IP).
2. **Hot swap:** `Ctrl+C` the Ghost — the ESP32 publishes the *same contract to the same topic*; the badge flips `GHOST FEED → ESP32 LIVE` in ~1 s. **No engine change.**
3. **Demo moment:** tap the ADXL345 (or `./scripts/tap.sh`) → `VIBRATION_HIGH` alert fires and the Alerts table updates live.

## Tomorrow — Phase 3: contingency

- **Panic button (keep the tab ready):** `./scripts/panic.sh` — dashboard back on simulated data in ~1 s.
- **Tap without hardware:** `./scripts/tap.sh`
- **Assets:** export both slide decks (Conveyor Belt / Sarkari Vani) as **PDF** before the venue. *(Decks aren't in this repo — keep them on the team drive.)*
- **Handoff line (rehearse verbatim):** *"That's the edge layer — the ESP32 talks to the broker. Over to the team to walk through how that live stream becomes the dashboard and the AI prediction."*

## Layout

```
broker/mosquitto.conf        broker config (0.0.0.0:1883, LAN demo)
broker/aedes.js              pure-Node MQTT broker — sandbox stand-in only
engine/server.js             v2 engine: telemetry stream + alert engine + dynamic settings
engine/public/index.html     reference dashboard (6 features, UI fixes baked in)
ghost/ghost.js               v2 synthetic feed + panic button + tap simulator
firmware/kratos_ps1/         ESP32 C++ (v2 contract, NTP + 2026 demo clock guard)
scripts/                     start_stack / stop_stack / panic / tap / verify / test-features
```

## Troubleshooting

| symptom | fix |
|---|---|
| Engine logs `broker offline` | Terminal 1 not running, or firewall — allow **1883/tcp** and **3000/tcp** on the LAN |
| ESP32 on Wi-Fi but MQTT fails | `MQTT_HOST` must be the laptop IPv4 on the same SSID; ping from Serial Monitor |
| Vite can't reach the engine | use the **LAN IP** (not localhost); CORS is open; check 3000/tcp |
| ACS712 reads a constant offset | calibrate `ACS_ZERO_MV` with the drive off |
| Alerts page empty during a spike | spikes last 4 s — check the engine log `ALERT #…` lines; cooldown is 10 s per type |
| Timestamp shows wrong year at venue | clock guard forces 2026 in Ghost + firmware; check laptop clock anyway |
