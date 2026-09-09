/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KRATOS-PS1 — sandbox broker (aedes)
 * ─────────────────────────────────────────────────────────────────────────────
 *  aedes is a full MQTT 3.1.1/5.0 broker written in Node. It exists here ONLY
 *  because this sandbox cannot apt-install Eclipse Mosquitto (no apt egress).
 *
 *  On the laptop / at the venue you run REAL Mosquitto:
 *      mosquitto -c broker/mosquitto.conf
 *  The engine and the Ghost are plain MQTT clients, so the broker is
 *  interchangeable — everything verified through this broker is verified
 *  against Mosquitto too.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const net = require('net');
const { Aedes } = require('aedes');

// aedes 1.x: the broker must be "listened" (persistence initialised) BEFORE
// it will answer client CONNECTs — createBroker() does that for us.
Aedes.createBroker()
  .then((aedes) => {
    aedes.on('client', (c) => console.log(`[broker:aedes] client connected: ${c.id}`));
    aedes.on('clientDisconnect', (c) => console.log(`[broker:aedes] client gone: ${c.id}`));
    aedes.on('clientError', (c, err) => console.error(`[broker:aedes] clientError ${c && c.id}: ${err.message}`));
    aedes.on('connectionError', (c, err) => console.error(`[broker:aedes] connectionError: ${err.message}`));
    aedes.on('error', (err) => console.error('[broker:aedes] error:', err.message));

    const server = net.createServer(aedes.handle);
    server.on('listening', () => {
      console.log('─'.repeat(58));
      console.log('  KRATOS-PS1 MQTT broker (aedes) — sandbox stand-in for Mosquitto');
      console.log('  Listening on 0.0.0.0:1883');
      console.log('─'.repeat(58));
    });
    server.listen(1883, '0.0.0.0');
  })
  .catch((err) => {
    console.error('[broker:aedes] failed to start:', err.message);
    process.exit(1);
  });
