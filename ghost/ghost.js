/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KRATOS-PS1 "GHOST" v2 — synthetic telemetry generator
 * ─────────────────────────────────────────────────────────────────────────────
 *  Publishes the LOCKED frontend contract (README → "Payload contract"):
 *    • 7-parameter telemetry + digital_twin.fault_zone + rul_days + vision_cam
 *    • Vision anomaly cycle: every 20 s → "Edge Tear" @ 0.92 for 5 s
 *      (drives the red bounding box on the Live Feed page)
 *    • --spike: 4-second vibration burst ("tap the sensor" demo)
 *
 *  Usage:
 *    node ghost/ghost.js              # continuous feed — ALSO the PANIC BUTTON
 *    node ghost/ghost.js --spike      # 4 s vibration burst, then exit
 *
 *  Env:
 *    MQTT_URL            (default mqtt://127.0.0.1:1883)
 *    TOPIC               (default kratos/ps1/telemetry — SAME as ESP32)
 *    INTERVAL            (default 500 ms)
 *    GHOST_VISION_CYCLE  (default 20000 ms — anomaly repeats this often)
 *    GHOST_VISION_ACTIVE (default 5000 ms — anomaly duration)
 * ─────────────────────────────────────────────────────────────────────────────
 */
const mqtt = require('mqtt');

const BROKER = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const TOPIC = process.env.TOPIC || 'kratos/ps1/telemetry';
const STATUS_TOPIC = 'kratos/ps1/status';
const INTERVAL = Number(process.env.INTERVAL || 500);
const VISION_CYCLE_MS = Number(process.env.GHOST_VISION_CYCLE || 20000);
const VISION_ACTIVE_MS = Number(process.env.GHOST_VISION_ACTIVE || 5000);

const args = process.argv.slice(2);
const SPIKE_ONLY = args.includes('--spike');
const SPIKE_MS = 4000;

const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

// UI FIX 3 (clock guard): the SIH demo must say 2026 no matter what the
// laptop clock says. If the clock is off, rewrite the year only.
function demoTimestamp() {
  const d = new Date();
  if (d.getUTCFullYear() !== 2026) d.setUTCFullYear(2026, d.getUTCMonth(), d.getUTCDate());
  return d.toISOString();
}

// Vision anomaly schedule: every VISION_CYCLE_MS, anomaly ON for VISION_ACTIVE_MS.
// First anomaly lands after one full cycle (t = 20 s by default).
function visionState(t) {
  if (Math.floor(t / VISION_CYCLE_MS) >= 1 && t % VISION_CYCLE_MS < VISION_ACTIVE_MS) {
    return { anomaly_detected: true, issue_type: 'Edge Tear', confidence: 0.92 };
  }
  return { anomaly_detected: false, issue_type: 'None', confidence: 0.0 };
}

let t = 0;
let rulDays = 42; // healthy belt — 42 days must render GREEN (UI FIX 2)
let faultZone = 3; // digital twin conveyor section 1-6, wanders slowly
let spikeTicks = SPIKE_ONLY ? Math.ceil(SPIKE_MS / INTERVAL) : 0;

function nextPayload() {
  t += INTERVAL;
  const spiking = spikeTicks > 0;
  if (spiking) spikeTicks--;

  if (Math.random() < 0.02) faultZone = 1 + Math.floor(Math.random() * 6);
  if (Math.random() < 0.002) rulDays = Math.max(1, rulDays - 1);

  return {
    timestamp: demoTimestamp(),
    source: 'ghost', // ESP32 firmware publishes "esp32"
    digital_twin: { fault_zone: faultZone },
    rul_days: Math.round(rulDays),
    telemetry: {
      // ADXL345 — the "tap" burst is what a physical tap looks like on the wire
      vibration_g: r2(spiking ? 9.5 + Math.random() * 4.5 : 1.45 + 0.35 * Math.sin(t / 9000) + (Math.random() - 0.5) * 0.18),
      // ACS712
      current_amps: r1(12.4 + 0.4 * Math.sin(t / 12000) + (Math.random() - 0.5) * 0.2),
      // DS18B20
      temperature_c: r1(45.2 + 1.5 * Math.sin(t / 60000) + (Math.random() - 0.5) * 0.4),
      // VL53L0X
      distance_mm: r1(500 + 6 * Math.sin(t / 45000) + (Math.random() - 0.5) * 4),
      // SS49E
      magnetic_flux_ut: r1(120 + 4 * Math.sin(t / 30000) + (Math.random() - 0.5) * 2),
      // A3144
      speed_rpm: r1(1450 + 8 * Math.sin(t / 20000) + (Math.random() - 0.5) * 6)
    },
    vision_cam: visionState(t) // YOLOv8 simulated feed
  };
}

let timer = null;
const client = mqtt.connect(BROKER, { reconnectPeriod: 2000, connectTimeout: 5000, clientId: 'kratos-ghost' });

function publishOffline() {
  try {
    if (client.connected) {
      client.publish(STATUS_TOPIC, JSON.stringify({ source: 'ghost', state: 'offline', at: Date.now() }));
    }
  } catch { /* best effort */ }
}

client.on('connect', () => {
  client.publish(STATUS_TOPIC, JSON.stringify({ source: 'ghost', state: 'online', at: Date.now() }));
  console.log(`[ghost] ONLINE — publishing locked KRATOS v2 contract → ${TOPIC} (every ${INTERVAL} ms)`);
  console.log(`[ghost] vision anomaly cycle: every ${VISION_CYCLE_MS / 1000}s, active ${VISION_ACTIVE_MS / 1000}s`);
  console.log('[ghost] Ctrl+C stops the feed. This is your PANIC BUTTON.');

  timer = setInterval(() => {
    client.publish(TOPIC, JSON.stringify(nextPayload()));
    if (SPIKE_ONLY && spikeTicks <= 0) {
      console.log('[ghost] spike burst done — exiting.');
      clearInterval(timer);
      publishOffline();
      client.end(false);
      process.exit(0);
    }
  }, INTERVAL);
});
client.on('reconnect', () => console.warn('[ghost] broker offline — retrying every 2 s'));
client.on('error', (err) => console.error('[ghost] mqtt error:', err.message));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[ghost] ${sig} — going offline`);
    publishOffline();
    client.end(false);
    process.exit(0);
  });
}
