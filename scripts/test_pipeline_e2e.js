import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');
const { io } = require('socket.io-client');

async function runTest() {
  console.log('=== STARTING END-TO-END PIPELINE VALIDATION ===');

  // 1. Verify FastAPI
  console.log('1. Checking FastAPI AI microservice (port 8000)...');
  const healthRes = await fetch('http://127.0.0.1:8000/health');
  if (!healthRes.ok) throw new Error('FastAPI health check failed');
  const healthData = await healthRes.json();
  console.log('   FastAPI Health:', JSON.stringify(healthData));

  // 2. Connect to Engine Socket.IO
  console.log('2. Connecting to Engine Socket.IO (port 3000)...');
  const sock = io('http://127.0.0.1:3000', { transports: ['websocket', 'polling'] });
  
  await new Promise((resolve, reject) => {
    sock.on('connect', () => {
      console.log('   Socket.IO Connected.');
      resolve();
    });
    sock.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('Socket.IO connection timeout')), 3000);
  });

  // 3. Connect MQTT publisher and send a test telemetry packet
  console.log('3. Publishing test telemetry packets to kratos/ps1/telemetry...');
  const client = mqtt.connect('mqtt://127.0.0.1:1883');
  
  await new Promise((resolve) => client.on('connect', resolve));

  const receivedPackets = [];

  const packetPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for enriched packet')), 5000);
    sock.on('telemetry', (pkt) => {
      if (pkt.source === 'test_runner') {
        receivedPackets.push(pkt);
        if (receivedPackets.length >= 2) {
          clearTimeout(timeout);
          resolve(receivedPackets);
        }
      }
    });
  });

  // Publish Normal Packet
  client.publish('kratos/ps1/telemetry', JSON.stringify({
    timestamp: new Date().toISOString(),
    source: 'test_runner',
    digital_twin: { fault_zone: 2 },
    telemetry: {
      vibration_g: 0.55,
      current_amps: 12.2,
      temperature_c: 35.5
    }
  }));

  // Wait 100ms then publish Degraded Packet
  setTimeout(() => {
    client.publish('kratos/ps1/telemetry', JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'test_runner',
      digital_twin: { fault_zone: 5 },
      telemetry: {
        vibration_g: 3.5,
        current_amps: 22.1,
        temperature_c: 82.0
      }
    }));
  }, 200);

  const packets = await packetPromise;
  console.log('4. Validating Received Socket.IO Enriched Telemetry...');
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    console.log('   Packet [' + (i+1) + '] Zone ' + p.digital_twin?.fault_zone + ':');
    console.log('     Sensor: vib=' + p.telemetry?.vibration_g + 'g, curr=' + p.telemetry?.current_amps + 'A, temp=' + p.telemetry?.temperature_c + 'C');
    console.log('     AI Prediction: status=' + p.ai?.status + ', confidence=' + p.ai?.confidence + '%, rul_days=' + p.ai?.rul_days + 'd, ai_available=' + p.ai?.ai_available);

    if (!p.ai || p.ai.ai_available !== true) {
      throw new Error('Packet ' + (i+1) + ' missing valid AI enrichment!');
    }
  }

  console.log('5. Cleaning up test clients...');
  client.end();
  sock.close();

  console.log('=== ALL END-TO-END TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
