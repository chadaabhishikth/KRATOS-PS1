/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KRATOS-PS1 — ESP32 EDGE FIRMWARE (locked v2 contract)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Publishes the EXACT KRATOS v2 JSON the Ghost generator uses, so the
 *  dashboard / engine don't care which source is talking (see "source").
 *
 *  Wired & live on the board:
 *    vibration_g     ADXL345 (I2C) — SDA→GPIO21, SCL→GPIO22, VCC 3.3V, GND
 *                    (SDO→GND = 7-bit addr 0x53)
 *    current_amps    ACS712 (analog, GPIO34) — OUT→GPIO34, +/− in series
 *                    with the drive line, VCC→5V (calibrate ACS_ZERO_MV)
 *    temperature_c   ESP32 internal sensor (demo stand-in for the DS18B20 —
 *                    wire the real one on GPIO35 and swap the read)
 *
 *  Not wired yet → demo constants (same values the Ghost pumps), so the
 *  contract stays complete for the frontend:
 *    distance_mm 500 (VL53L0X) · magnetic_flux_ut 120 (SS49E) ·
 *    speed_rpm 1450 (A3144) · digital_twin.fault_zone 3 · rul_days 42
 *    vision_cam: edge does not run YOLOv8 (server-side AI) → baseline
 *
 *  Libraries (Arduino IDE): esp32 boards package + PubSubClient (ONLY one).
 *  The ADXL345 is driven with raw I2C on purpose — no version headaches.
 *  Flashing: Tools → "ESP32 Dev Module" → COM port → Upload. Serial @115200.
 * ─────────────────────────────────────────────────────────────────────────────
 */
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>

// ════════════════════════════════════════════════════════════
//  EDIT BEFORE FLASHING
// ════════════════════════════════════════════════════════════
const char* WIFI_SSID = "YOUR_WIFI_SSID";     // same network as the laptop
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* MQTT_HOST = "LAPTOP_IP";          // e.g. "192.168.1.42"
const int   MQTT_PORT = 1883;
// ════════════════════════════════════════════════════════════

const char* TOPIC_TELEMETRY = "kratos/ps1/telemetry";
const char* TOPIC_STATUS    = "kratos/ps1/status";

// ── pins & tuning ───────────────────────────────────────────
#define ADXL_ADDR 0x53
#define SDA_PIN   21
#define SCL_PIN   22
#define ACS_PIN   34     // ADC1_CH3

const long  PUBLISH_MS    = 500;  // = Ghost rate, dashboard expects ~2 Hz
const int   SAMPLES       = 32;   // samples per vibration burst
const long  SAMPLE_GAP_MS = 4;

// demo constants until the sensors are wired (match the Ghost)
const float DISTANCE_MM      = 500.0f;
const float MAGNETIC_FLUX_UT = 120.0f;
const float SPEED_RPM        = 1450.0f;
const int   FAULT_ZONE       = 3;   // 1-6; AI engine assigns in full system
const int   RUL_DAYS         = 42;  // 42 = HEALTHY (green) in the UI

WiFiClient net;
PubSubClient mqtt(net);
unsigned long lastPub = 0;

// ── ADXL345 via raw I2C ─────────────────────────────────────
void adxlWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(ADXL_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}
int16_t adxlRead16(uint8_t reg) {
  Wire.beginTransmission(ADXL_ADDR);
  Wire.write(reg);
  Wire.endTransmission();
  Wire.requestFrom(ADXL_ADDR, (int)2);
  int16_t raw = (int16_t)(Wire.read() | (Wire.read() << 8));
  return raw / 16;  // 10-bit mode → 1 mg/LSB
}
void setupAdxl() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(50);
  adxlWrite(0x2D, 0x00);  // standby for config
  delay(10);
  adxlWrite(0x31, 0x10);  // ±16 g, 10-bit
  adxlWrite(0x2B, 0x08);  // ~1.6 kHz bandwidth
  adxlWrite(0x2D, 0x08);  // link + measure
}

// One vibration burst → RMS in g (what the UI shows as vibration_g)
float sampleVibrationRms() {
  float sumSq = 0;
  for (int i = 0; i < SAMPLES; i++) {
    int16_t x = adxlRead16(0x32);
    int16_t y = adxlRead16(0x34);
    int16_t z = adxlRead16(0x36);
    float mag = sqrt((float)x * x + (float)y * y + (float)z * z) / 1000.0f;
    sumSq += mag * mag;
    delay(SAMPLE_GAP_MS);
  }
  return sqrt(sumSq / SAMPLES);
}

// ── ACS712 (analog) ─────────────────────────────────────────
// ACS712-05B: 100 mV/A, output centred at VCC/2 (2.5 V on 5 V supply).
// CALIBRATE: no load → note the mv reading and set ACS_ZERO_MV to it.
const float ACS_ZERO_MV = 2500.0f;
float readCurrentA() {
  uint16_t raw = analogRead(ACS_PIN);
  float volts = raw * 3.3f / 4095.0f;
  return (volts * 1000.0f - ACS_ZERO_MV) / 100.0f;
}

// ── time: NTP if the venue Wi-Fi has internet, else SIH date ─
String isoTimestamp() {
  static char buf[24];
  time_t now = time(nullptr);
  if (now > 1735689600) { // > 2025-01-01 ⇒ SNTP actually synced
    struct tm t;
    gmtime_r(&now, &t);
    strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%SZ", &t);
    return String(buf);
  }
  return "2026-09-08T00:00:00Z";  // UI FIX 3: demo clock guard
}

// ── MQTT ────────────────────────────────────────────────────
void mqttReconnect() {
  static unsigned long last = 0;
  if (millis() - last < 3000) return;
  last = millis();

  if (mqtt.connect("kratos-esp32")) {
    Serial.println("[KRATOS] MQTT online → " String(TOPIC_TELEMETRY).c_str());
    mqtt.publish(TOPIC_STATUS, "{\"source\":\"esp32\",\"state\":\"online\"}");
  } else {
    Serial.print("[KRATOS] MQTT connect failed, rc=");
    Serial.println(mqtt.state());
  }
}

void publishTelemetry() {
  float vib = sampleVibrationRms();
  float temp = readTemperature();   // chip temp — swap for DS18B20 when wired
  float amps = readCurrentA();

  String json = String("{\"timestamp\":\"") + isoTimestamp() + "\"" +
    ",\"source\":\"esp32\"" +
    ",\"digital_twin\":{\"fault_zone\":" + String(FAULT_ZONE) + "}" +
    ",\"rul_days\":" + String(RUL_DAYS) +
    ",\"telemetry\":{\"vibration_g\":" + String(vib, 2) +
    ",\"current_amps\":" + String(amps, 1) +
    ",\"temperature_c\":" + String(temp, 1) +
    ",\"distance_mm\":" + String(DISTANCE_MM, 1) +
    ",\"magnetic_flux_ut\":" + String(MAGNETIC_FLUX_UT, 1) +
    ",\"speed_rpm\":" + String(SPEED_RPM, 1) + "}" +
    // YOLOv8 runs server-side in the full system — edge sends the baseline
    ",\"vision_cam\":{\"anomaly_detected\":false,\"issue_type\":\"None\",\"confidence\":0.0}}";

  mqtt.publish(TOPIC_TELEMETRY, json.c_str());
  Serial.println("[KRATOS] " + json);
}

// ── lifecycle ───────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[KRATOS-PS1] boot (v2 contract)");
  setupAdxl();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 60) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[KRATOS] Wi-Fi OK — IP " + WiFi.localIP().toString());
    Serial.println("[KRATOS] Frontend binds: io('http://" + WiFi.localIP().toString() + ":3000')");
    configTime(0, 0, "pool.ntp.org");  // UTC; silently no-ops on isolated Wi-Fi
  } else {
    Serial.println("\n[KRATOS] Wi-Fi failed — retrying in loop");
  }

  mqtt.setClient(net);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastTry = 0;
    if (millis() - lastTry > 5000) {
      lastTry = millis();
      Serial.println("[KRATOS] Wi-Fi retry");
      WiFi.disconnect();
      WiFi.reconnect();
    }
    delay(100);
    return;
  }

  if (!mqtt.connected()) mqttReconnect();

  if (millis() - lastPub >= PUBLISH_MS) {
    lastPub = millis();
    publishTelemetry();
  }
}
