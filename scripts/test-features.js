/**
 * KRATOS-PS1 — feature rehearsal test (run every morning before the pitch)
 * ------------------------------------------------------------------
 * Proves end-to-end, over real Socket.IO, that the engine + ghost can drive
 * all six frontend features:
 *
 *   A1  update_settings is applied (dynamic thresholds)
 *   A2  vision anomaly cycle → VISION_ANOMALY alert fires
 *   A2' vibration spike UNDER a raised limit does NOT alert (proves the
 *       engine uses dynamic variables, not hardcoded numbers)
 *   A3  update_settings again (restore limit + lower max_temp)
 *   A4  spike over restored limit → VIBRATION_HIGH; hot temp → TEMP_HIGH
 *   A5  snapshot on connect carries alerts + settings
 *
 * Prereq: broker + engine running. The script temporarily kills any
 * background ghost (spawns its own with a fast vision cycle) and prints a
 * reminder to restart the Ghost at the end.
 *
 *   node scripts/test-features.js
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');

const ENGINE = process.env.ENGINE_URL || 'http://127.0.0.1:3000';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// deterministic feed: stop the background ghost for the duration of the test
try { execSync('pkill -f "ghost/ghost.js" || true', { stdio: 'ignore' }); } catch { /* windows */ }

const sock = io(ENGINE);
const alertsSeen = [];
let settingsState = null;
let snapshot = null;

sock.on('snapshot', (s) => {
  snapshot = s;
  check('A5  snapshot carries alerts + settings',
    Array.isArray(s.alerts) && s.settings && s.settings.max_vib != null,
    `alerts=${s.alerts?.length} settings=${JSON.stringify(s.settings)}`);
});
sock.on('settings_updated', (s) => { settingsState = s; });
sock.on('alerts_history', (arr) => {
  for (const a of arr) if (!alertsSeen.find((x) => x.id === a.id)) alertsSeen.push(a);
});

function startSpikeGhost(env) {
  return spawn('node', [path.join(__dirname, '..', 'ghost', 'ghost.js'), '--spike'],
    { env: { ...process.env, ...env }, stdio: 'ignore' });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function waitUntil(fn, ms) {
  return new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn() || Date.now() - t0 > ms) { clearInterval(iv); res(fn()); }
    }, 100);
  });
}

(async () => {
  const connected = await waitUntil(() => sock.connected, 5000);
  if (!connected) { console.error('could not connect to engine at', ENGINE); process.exit(1); }
  check('A0  connected to engine', true);

  // A1: raise max_vib to 20 g — a ~14 g spike must NOT alert
  sock.emit('update_settings', { max_vib: 20 });
  const ok1 = await waitUntil(() => settingsState && settingsState.max_vib === 20, 3000);
  check('A1  update_settings applied (max_vib=20)', ok1, JSON.stringify(settingsState));

  // A2: spike #1 with a fast vision cycle (1.5 s) → VISION_ANOMALY yes, VIBRATION_HIGH no
  alertsSeen.length = 0;
  const g1 = startSpikeGhost({ GHOST_VISION_CYCLE: '1500', GHOST_VISION_ACTIVE: '600' });
  await sleep(5500); g1.kill();
  const vib1 = alertsSeen.find((a) => a.type === 'VIBRATION_HIGH');
  const vis1 = alertsSeen.find((a) => a.type === 'VISION_ANOMALY');
  check('A2a spike under raised limit does NOT alert (dynamic thresholds work)', !vib1);
  check('A2b vision anomaly fires VISION_ANOMALY', !!vis1, vis1 ? JSON.stringify(vis1) : 'none seen');

  // A3: restore max_vib=2 and drop max_temp to 40 (ghost runs ~45 °C)
  sock.emit('update_settings', { max_vib: 2, max_temp: 40 });
  const ok3 = await waitUntil(
    () => settingsState && settingsState.max_vib === 2 && settingsState.max_temp === 40, 3000);
  check('A3  update_settings applied (max_vib=2, max_temp=40)', ok3, JSON.stringify(settingsState));

  // A4: spike #2 → VIBRATION_HIGH + TEMP_HIGH
  alertsSeen.length = 0;
  const g2 = startSpikeGhost({});
  await sleep(5500); g2.kill();
  const vib2 = alertsSeen.find((a) => a.type === 'VIBRATION_HIGH');
  const tmp2 = alertsSeen.find((a) => a.type === 'TEMP_HIGH');
  check('A4a spike over restored limit alerts VIBRATION_HIGH', !!vib2, vib2 ? JSON.stringify(vib2) : 'none seen');
  check('A4b hot temperature alerts TEMP_HIGH', !!tmp2, tmp2 ? JSON.stringify(tmp2) : 'none seen');

  const failed = results.filter((r) => !r).length;
  console.log('─'.repeat(62));
  console.log(failed
    ? `  ${failed} check(s) FAILED`
    : '  ALL CHECKS PASSED — engine + ghost drive all six frontend features');
  console.log('  Reminder: restart the background ghost →  npm run ghost');
  sock.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
