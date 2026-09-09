/**
 * KRATOS-PS1 — pipeline verification (one-shot)
 * ------------------------------------------------------------------
 * Connects to the engine over Socket.IO exactly the way the React app
 * will, and prints the first 3 telemetry packets of the v2 contract.
 *
 *   node scripts/verify.js
 *   ENGINE_URL=http://192.168.1.42:3000 node scripts/verify.js   (LAN test)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { io } = require('socket.io-client');

const N = 3;
const url = process.env.ENGINE_URL || 'http://127.0.0.1:3000';
const sock = io(url, { transports: ['websocket', 'polling'] });

let count = 0;
const timer = setTimeout(() => {
  console.error('TIMEOUT: no packets in 10 s — is the Ghost (or ESP32) publishing?');
  process.exit(1);
}, 10000);

sock.on('connect', () => console.log(`[verify] socket connected → ${url}`));
sock.on('snapshot', (s) =>
  console.log(
    `[verify] snapshot: last=${s.last?.source ?? 'none'} history=${s.history?.length ?? 0} ` +
    `alerts=${s.alerts?.length ?? 0} settings=${JSON.stringify(s.settings ?? {})} broker=${s.broker}`
  )
);
sock.on('telemetry', (p) => {
  count++;
  const t = p.telemetry || {};
  console.log(
    `[verify] packet ${count}: src=${p.source} ts=${p.timestamp} zone=${p.digital_twin?.fault_zone} rul=${p.rul_days}d ` +
    `vib=${t.vibration_g}g curr=${t.current_amps}A temp=${t.temperature_c}C dist=${t.distance_mm}mm ` +
    `flux=${t.magnetic_flux_ut}µT rpm=${t.speed_rpm} anomaly=${p.vision_cam?.anomaly_detected}(${p.vision_cam?.issue_type}) ` +
    `ai=${JSON.stringify(p.ai)}`
  );
  if (count >= N) {
    clearTimeout(timer);
    console.log('[verify] PIPELINE OK — broker → engine → Socket.IO healthy on the v2 contract');
    sock.close();
    process.exit(0);
  }
});
sock.on('alerts_history', (alerts) => {
  const a = alerts[alerts.length - 1];
  console.log(`[verify] ALERT #${a.id} ${a.type} (${a.severity}) — ${a.message}`);
});
sock.on('connect_error', (e) => {
  console.error('[verify] connect error:', e.message);
  process.exit(1);
});
