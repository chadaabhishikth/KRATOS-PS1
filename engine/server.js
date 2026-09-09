/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KRATOS-PS1 TELEMETRY ENGINE v2
 * ─────────────────────────────────────────────────────────────────────────────
 *  Mosquitto (MQTT)  ──►  this Node process  ──►  Socket.IO  ──►  React/Vite
 *
 *  Socket.IO events:
 *    telemetry        (server → all)  every KRATOS v2 payload as received
 *    snapshot         (server → new client on connect)
 *                      { last, history[120], alerts[≤50], settings, topics, broker }
 *    alerts_history   (server → all)  FULL alerts array, re-emitted whenever
 *                      a new alert is pushed (Alerts page binds to this)
 *    settings_updated (server → all)  merged settings after update_settings
 *    update_settings  (client → server) new thresholds, e.g.
 *                      { max_vib: 3.0, max_temp: 60, max_current: 15 }
 *    broker           (server → all)  { state: 'online' | 'offline' }
 *
 *  Alert engine:
 *    VIBRATION_HIGH   vibration_g  > settings.max_vib      (default 2.0 g)
 *    TEMP_HIGH        temperature_c > settings.max_temp    (default 60 °C)
 *    CURRENT_HIGH     current_amps > settings.max_current  (default 15 A)
 *    VISION_ANOMALY   vision_cam.anomaly_detected === true
 *    severity: 'critical' when value > 1.5× limit (vision anomaly always
 *    critical). Per-type cooldown (default 10 s) stops alert storms.
 *    Array capped at the last 50 alerts (oldest dropped).
 *
 *  The Ghost generator and the ESP32 publish the EXACT SAME payload shape to
 *  the SAME topic — hot swap needs ZERO changes here.
 *
 *  Env overrides: PORT (3000) · MQTT_URL (mqtt://127.0.0.1:1883) · TOPICS ("kratos/ps1/#")
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const http = require('http');
const fs = require('fs');
const mqtt = require('mqtt');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const MQTT_URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const TOPICS = (process.env.TOPICS || 'kratos/ps1/#').split(' ').filter(Boolean);
const HISTORY_LEN = 300;
const ALERTS_CAP = 50;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── dynamic thresholds (Settings page) ──────────────────────────────────────
const DEFAULT_SETTINGS = {
  max_vib: 2.0,          // g
  max_temp: 60,          // °C
  max_current: 15,       // A
  alertCooldownMs: 10000 // per-type alert debounce
};
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
let settings = { ...DEFAULT_SETTINGS };

// ── alerts state (Alerts page) ──────────────────────────────────────────────
let alerts = [];        // last 50, oldest → newest
let alertSeq = 0;
const lastAlertAt = {}; // type → Date.now() of last fired alert

// ── rolling telemetry history (Home page sparklines / charts) ───────────────
let history = [];
let last = null;

// ── Socket.IO (created before alert fns so they can emit) ───────────────────
const httpServer = http.createServer((req, res) => serveStatic(req, res));
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

function pushAlert(pkt, type, severity, message, value, limit) {
  const now = Date.now();
  if (lastAlertAt[type] && now - lastAlertAt[type] < settings.alertCooldownMs) return null;
  lastAlertAt[type] = now;

  const alert = {
    id: ++alertSeq,
    ts: new Date().toISOString(),
    type,
    severity,
    message,
    zone: pkt.digital_twin?.fault_zone ?? null,
    value,
    limit,
    source: pkt.source ?? 'unknown'
  };
  alerts.push(alert);
  if (alerts.length > ALERTS_CAP) alerts.splice(0, alerts.length - ALERTS_CAP);

  console.log(`[engine] ALERT #${alert.id} ${type} (${severity}) — ${message}`);
  io.emit('alerts_history', alerts); // full array, every new alert
  return alert;
}

function evaluate(pkt) {
  const tele = pkt.telemetry || {};
  const vision = pkt.vision_cam || {};

  if (typeof tele.vibration_g === 'number' && tele.vibration_g > settings.max_vib) {
    pushAlert(
      pkt, 'VIBRATION_HIGH',
      tele.vibration_g > settings.max_vib * 1.5 ? 'critical' : 'warning',
      `Vibration ${tele.vibration_g} g exceeds limit ${settings.max_vib} g`,
      tele.vibration_g, settings.max_vib
    );
  }
  if (typeof tele.temperature_c === 'number' && tele.temperature_c > settings.max_temp) {
    pushAlert(
      pkt, 'TEMP_HIGH',
      tele.temperature_c > settings.max_temp * 1.5 ? 'critical' : 'warning',
      `Temperature ${tele.temperature_c} °C exceeds limit ${settings.max_temp} °C`,
      tele.temperature_c, settings.max_temp
    );
  }
  if (typeof tele.current_amps === 'number' && tele.current_amps > settings.max_current) {
    pushAlert(
      pkt, 'CURRENT_HIGH',
      tele.current_amps > settings.max_current * 1.5 ? 'critical' : 'warning',
      `Current ${tele.current_amps} A exceeds limit ${settings.max_current} A`,
      tele.current_amps, settings.max_current
    );
  }
  if (vision.anomaly_detected === true) {
    pushAlert(
      pkt, 'VISION_ANOMALY', 'critical',
      `Vision AI: ${vision.issue_type || 'anomaly'} (confidence ${(vision.confidence ?? 0).toFixed(2)})`,
      vision.confidence ?? 0, 1.0
    );
  }
}

// Settings page → engine. Only known numeric keys are accepted; anything else
// is ignored + logged so a typo in the frontend can't corrupt thresholds.
function applySettings(incoming) {
  const changes = {};
  if (incoming && typeof incoming === 'object') {
    for (const key of SETTING_KEYS) {
      const v = incoming[key];
      if (v === undefined) continue;
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        if (settings[key] !== v) {
          settings[key] = v;
          changes[key] = v;
        }
      } else {
        console.warn(`[engine] update_settings: ignoring invalid ${key}=${JSON.stringify(v)}`);
      }
    }
  }
  if (Object.keys(changes).length) {
    console.log('[engine] settings updated →', JSON.stringify(settings));
    io.emit('settings_updated', { ...settings });
  }
  return { ...settings };
}

// ── MQTT side ────────────────────────────────────────────────────────────────
const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 2000, connectTimeout: 5000, clientId: 'kratos-engine' });

client.on('connect', () => {
  console.log(`[engine] broker connected: ${MQTT_URL}`);
  io.emit('broker', { state: 'online' });
  client.subscribe(TOPICS, (err) => {
    if (err) console.error('[engine] subscribe failed:', err.message);
    else console.log(`[engine] subscribed: ${TOPICS.join(', ')}`);
  });
});
client.on('reconnect', () => {
  console.warn('[engine] broker offline — retrying every 2 s');
  io.emit('broker', { state: 'offline' });
});
client.on('error', (err) => console.error('[engine] mqtt error:', err.message));
const AI_URL = process.env.AI_URL || 'http://127.0.0.1:8000/predict';

async function getAIPrediction(telemetry) {
  // 1-second timeout to prevent API bottlenecking the MQTT stream
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vibration_g: typeof telemetry.vibration_g === 'number' ? telemetry.vibration_g : 0,
        current_amps: typeof telemetry.current_amps === 'number' ? telemetry.current_amps : 0,
        temperature_c: typeof telemetry.temperature_c === 'number' ? telemetry.temperature_c : 25
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      status: 'UNKNOWN',
      confidence: 0,
      rul_days: null,
      ai_available: false
    };
  }
}

client.on('message', async (topic, payload) => {
  let data;
  try {
    data = JSON.parse(payload.toString('utf8'));
  } catch {
    data = { _raw: payload.toString('utf8'), parseError: true };
  }
  data._topic = topic;
  data._recvTs = Date.now();

  // Presence packets (kratos/ps1/status) — log only, not telemetry
  if (!data.telemetry && !data.vision_cam) {
    console.log(`[engine] status: ${topic} ${payload.toString('utf8')}`);
    return;
  }

  // Enrich with AI prediction
  if (data.telemetry) {
    const ai = await getAIPrediction(data.telemetry);
    data.ai = ai;
    if (typeof ai.rul_days === 'number') {
      data.rul_days = ai.rul_days;
    }
  }

  evaluate(data);   // alerts first so alerts_history can lead telemetry
  last = data;
  history.push(data);
  if (history.length > HISTORY_LEN) history.splice(0, history.length - HISTORY_LEN);
  io.emit('telemetry', data);
});

// ── Socket.IO side (what the React app binds to) ─────────────────────────────
io.on('connection', (sock) => {
  console.log(`[engine] frontend connected (${io.engine.clientsCount} total)`);
  sock.emit('snapshot', {
    last,
    history: history.slice(-120),
    alerts,                       // Alerts page initial state (last 50)
    settings: { ...settings },    // Settings page initial state
    topics: TOPICS,
    broker: client.connected ? 'online' : 'offline'
  });

  sock.on('update_settings', (incoming) => applySettings(incoming));
  sock.onAny((event) => {
    if (!['update_settings', 'connect', 'disconnect', 'ping', 'pong'].includes(event)) {
      console.warn(`[engine] unknown socket event from frontend: ${event}`);
    }
  });
});

// ── tiny static file server for the reference dashboard ─────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  let urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('─'.repeat(58));
  console.log('  KRATOS-PS1 telemetry engine v2');
  console.log(`  Dashboard   : http://0.0.0.0:${PORT}`);
  console.log(`  Socket.IO   : io('http://<this-lan-ip>:${PORT}')`);
  console.log(`  Broker      : ${MQTT_URL}`);
  console.log(`  Topics      : ${TOPICS.join(', ')}`);
  console.log(`  Defaults    : ${JSON.stringify(DEFAULT_SETTINGS)}`);
  console.log('─'.repeat(58));
});
