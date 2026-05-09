/*
 * Solar Tracker Proto — Seeed XIAO ESP32-C3 + 0.96" OLED (SSD1306 I2C)
 *
 * Output for this experiment: OLED text (ON/OFF + link status), not a GPIO LED.
 *
 * Cmd:  devices/<DEVICE_ID>/cmd  JSON { "state": true|false OR "on"|"off", optional validFor / duration_sec }
 * Tel:  devices/<DEVICE_ID>/telemetry  JSON includes "status":"on"|"off"
 *
 * Libraries (Library Manager): Adafruit SSD1306, Adafruit GFX, ArduinoJson v6, PubSubClient
 *
 * Wiring (typical 4-pin I2C OLED): VCC→3V3, GND→GND, SDA→D4 (GPIO6), SCL→D5 (GPIO7)
 */
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_wifi.h>
#include <time.h>

const char *WIFI_SSID = "X.factory2.4G";
const char *WIFI_PASS = "make0314";

static const IPAddress MQTT_IP(192, 168, 100, 50);
const uint16_t MQTT_PORT = 1883;

/** Must match Node-RED / Vercel device_id */
const char *DEVICE_ID = "xiao-esp32c3";

/** XIAO ESP32-C3: D4 = GPIO6 (SDA), D5 = GPIO7 (SCL) — change if you wired differently */
static const uint8_t OLED_SDA = 6;
static const uint8_t OLED_SCL = 7;
static const uint8_t OLED_ADDR = 0x3C;

#define SCREEN_W 128
#define SCREEN_H 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, OLED_RESET);

const unsigned long TELEMETRY_MS = 10000;
const int WIFI_POST_CONNECT_DELAY_MS = 1000;
const int MQTT_TCP_TRIES = 8;
const int MQTT_SESSION_TRIES = 8;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

char topicTelemetry[64];
char topicCmd[64];

bool relayOn = false;
unsigned long paidUntilMillis = 0;
time_t paidUntilUnix = 0;
unsigned long lastPub = 0;

static bool parseStateFromJson(JsonVariantConst v, bool *onOut) {
  if (v.isNull())
    return false;
  if (v.is<bool>()) {
    *onOut = v.as<bool>();
    return true;
  }
  if (v.is<const char *>()) {
    const char *st = v.as<const char *>();
    if (!strcmp(st, "off")) {
      *onOut = false;
      return true;
    }
    if (!strcmp(st, "on")) {
      *onOut = true;
      return true;
    }
  }
  return false;
}

void refreshOled() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("Solar Tracker Proto"));

  display.print(F("ID "));
  display.println(DEVICE_ID);

  const char *wifiSt = (WiFi.status() == WL_CONNECTED) ? "WiFi OK" : "WiFi --";
  display.println(wifiSt);

  display.print(F("MQTT "));
  display.println(mqtt.connected() ? F("OK") : F("--"));

  display.drawLine(0, 34, SCREEN_W, 34, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 38);
  display.println(relayOn ? F("ON") : F("OFF"));

  display.display();
}

void applyRelay(bool on) {
  relayOn = on;
  if (!on) {
    paidUntilMillis = 0;
    paidUntilUnix = 0;
  }
  Serial.printf("Output (OLED) %s\n", on ? "ON" : "OFF");
  refreshOled();
}

void enforcePaidWindow() {
  bool expire = false;
  if (relayOn && paidUntilMillis != 0 && (long)(millis() - paidUntilMillis) >= 0)
    expire = true;
  if (relayOn && paidUntilUnix != 0) {
    time_t now = time(nullptr);
    if (now > 1700000000 && now > paidUntilUnix)
      expire = true;
  }
  if (expire) {
    applyRelay(false);
    Serial.println(F("Timed window expired -> OFF"));
  }
}

void handleCmdJson(const char *json) {
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    Serial.printf("cmd JSON error: %s\n", err.c_str());
    return;
  }

  bool wantOn = false;
  if (!parseStateFromJson(doc["state"], &wantOn)) {
    Serial.println(F("cmd: no state (need bool or \"on\"/\"off\")"));
    return;
  }

  if (!wantOn) {
    applyRelay(false);
    return;
  }

  applyRelay(true);
  paidUntilMillis = 0;
  paidUntilUnix = 0;

  unsigned long windowSec = 0;
  if (!doc["validFor"].isNull())
    windowSec = doc["validFor"].as<unsigned long>();
  else if (!doc["duration_sec"].isNull())
    windowSec = doc["duration_sec"].as<unsigned long>();
  if (windowSec != 0) {
    paidUntilMillis = millis() + windowSec * 1000UL;
    Serial.printf("Timed window %lu s\n", windowSec);
  }

  if (!doc["validUntil"].isNull()) {
    paidUntilUnix = (time_t)doc["validUntil"].as<long>();
    Serial.printf("Window validUntil unix %ld\n", (long)paidUntilUnix);
  }
}

char cmdBuf[512];

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  (void)topic;
  if (length >= sizeof(cmdBuf))
    length = sizeof(cmdBuf) - 1;
  memcpy(cmdBuf, payload, length);
  cmdBuf[length] = '\0';
  handleCmdJson(cmdBuf);
}

void buildTopics() {
  snprintf(topicTelemetry, sizeof(topicTelemetry), "devices/%s/telemetry", DEVICE_ID);
  snprintf(topicCmd, sizeof(topicCmd), "devices/%s/cmd", DEVICE_ID);
}

bool tcpProbe(const IPAddress &ip, uint16_t port) {
  WiFiClient c;
  c.setTimeout(5000);
  bool ok = c.connect(ip, port);
  if (ok)
    c.stop();
  return ok;
}

bool tcpProbeWithRetries() {
  for (int i = 0; i < MQTT_TCP_TRIES; i++) {
    Serial.printf("TCP probe MQTT (%d/%d)... ", i + 1, MQTT_TCP_TRIES);
    if (tcpProbe(MQTT_IP, MQTT_PORT)) {
      Serial.println(F("OK"));
      return true;
    }
    Serial.println(F("FAIL"));
    delay(500 + (unsigned)i * 200);
    yield();
  }
  return false;
}

void startSntp() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print(F("SNTP "));
  for (int i = 0; i < 40; i++) {
    time_t now = time(nullptr);
    if (now > 1700000000) {
      Serial.printf("synced (%ld)\n", (long)now);
      return;
    }
    delay(250);
    yield();
  }
  Serial.println(F("no sync yet"));
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print(F("WiFi"));
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 60000UL) {
      Serial.println(F(" timeout"));
      refreshOled();
      return false;
    }
    delay(300);
    yield();
    Serial.print(F("."));
  }
  Serial.println();
  Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());

  delay(WIFI_POST_CONNECT_DELAY_MS);
  startSntp();
  refreshOled();
  return true;
}

void reconnectMqtt() {
  wifiClient.setTimeout(8000);
  mqtt.setServer(MQTT_IP, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(mqttCallback);

  for (int attempt = 0; attempt < MQTT_SESSION_TRIES && WiFi.status() == WL_CONNECTED &&
                       !mqtt.connected();
       attempt++) {

    if (!tcpProbeWithRetries()) {
      Serial.println(F("TCP probes exhausted"));
      delay(2000);
      yield();
      continue;
    }

    uint8_t mac[6];
    WiFi.macAddress(mac);
    char clientId[28];
    snprintf(clientId, sizeof(clientId), "xiao-%02x%02x%02x%02x%02x%02x", mac[0], mac[1], mac[2],
             mac[3], mac[4], mac[5]);

    Serial.printf("MQTT connect (%d/%d)... ", attempt + 1, MQTT_SESSION_TRIES);
    if (mqtt.connect(clientId)) {
      Serial.println(F("OK"));
      if (mqtt.subscribe(topicCmd))
        Serial.printf("Subscribed %s\n", topicCmd);
      else
        Serial.println(F("Subscribe failed"));
      refreshOled();
      return;
    }

    Serial.printf("fail rc=%d\n", mqtt.state());
    delay(1000 + attempt * 400);
    yield();
  }
  refreshOled();
}

void setup() {
  Serial.begin(115200);
  delay(400);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("SSD1306 allocation/init failed — check I2C wiring & address"));
    for (;;)
      delay(1000);
  }
  display.clearDisplay();
  display.display();

  applyRelay(false);
  buildTopics();

  if (!connectWifi())
    return;

  reconnectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("WiFi lost"));
    refreshOled();
    delay(1000);
    yield();
    paidUntilMillis = 0;
    paidUntilUnix = 0;
    connectWifi();
    reconnectMqtt();
    return;
  }

  if (!mqtt.connected())
    reconnectMqtt();

  mqtt.loop();
  enforcePaidWindow();

  unsigned long now = millis();
  if (now - lastPub < TELEMETRY_MS)
    return;
  lastPub = now;

  unsigned long relRemain = 0;
  if (relayOn && paidUntilMillis != 0) {
    long r = (long)(paidUntilMillis - millis());
    if (r > 0)
      relRemain = (unsigned long)r;
  }

  char payload[280];
  snprintf(payload, sizeof(payload),
           "{\"device\":\"%s\",\"status\":\"%s\",\"uptime_ms\":%lu,\"heap_free\":%u,"
           "\"paid_rel_ms\":%lu,\"paid_until_unix\":%ld}",
           DEVICE_ID, relayOn ? "on" : "off", now, (unsigned)ESP.getFreeHeap(), relRemain,
           (long)(paidUntilUnix ? paidUntilUnix : 0));

  if (!mqtt.publish(topicTelemetry, payload, false))
    Serial.println(F("telemetry publish failed"));

  refreshOled();
}
