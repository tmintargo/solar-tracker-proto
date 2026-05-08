/*
 * Solar Tracker Proto — ESP32 DevKit (built-in LED on GPIO2)
 *
 * Cmd:  devices/<DEVICE_ID>/cmd  JSON { "state":"on"|"off", optional validFor or duration_sec }
 * Tel:  devices/<DEVICE_ID>/telemetry  JSON includes "status":"on"|"off"
 *
 * Libraries: ArduinoJson v6, PubSubClient
 */
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <esp_wifi.h>
#include <time.h>

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

static const IPAddress MQTT_IP(192, 168, 100, 50);
const uint16_t MQTT_PORT = 1883;

const char *DEVICE_ID = "esp32-devkit";
#define RELAY_PIN 2

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

void applyRelay(bool on) {
  relayOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  if (!on) {
    paidUntilMillis = 0;
    paidUntilUnix = 0;
  }
  Serial.printf("LED/load %s\n", on ? "ON" : "OFF");
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
    Serial.println("Timed window expired -> OFF");
  }
}

void handleCmdJson(const char *json) {
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    Serial.printf("cmd JSON error: %s\n", err.c_str());
    return;
  }

  const char *st = doc["state"];
  if (!st) {
    Serial.println("cmd: no state");
    return;
  }

  if (strcmp(st, "off") == 0) {
    applyRelay(false);
    return;
  }

  if (strcmp(st, "on") != 0) {
    Serial.printf("cmd: unknown state %s\n", st);
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
      Serial.println("OK");
      return true;
    }
    Serial.println("FAIL");
    delay(500 + (unsigned)i * 200);
    yield();
  }
  return false;
}

void startSntp() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print("SNTP ");
  for (int i = 0; i < 40; i++) {
    time_t now = time(nullptr);
    if (now > 1700000000) {
      Serial.printf("synced (%ld)\n", (long)now);
      return;
    }
    delay(250);
    yield();
  }
  Serial.println("no sync yet");
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 60000UL) {
      Serial.println(" timeout");
      return false;
    }
    delay(300);
    yield();
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());

  delay(WIFI_POST_CONNECT_DELAY_MS);
  startSntp();
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
      Serial.println("TCP probes exhausted");
      delay(2000);
      yield();
      continue;
    }

    uint8_t mac[6];
    WiFi.macAddress(mac);
    char clientId[28];
    snprintf(clientId, sizeof(clientId), "esp32-%02x%02x%02x%02x%02x%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    Serial.printf("MQTT connect (%d/%d)... ", attempt + 1, MQTT_SESSION_TRIES);
    if (mqtt.connect(clientId)) {
      Serial.println("OK");
      if (mqtt.subscribe(topicCmd))
        Serial.printf("Subscribed %s\n", topicCmd);
      else
        Serial.println("Subscribe failed");
      return;
    }

    Serial.printf("fail rc=%d\n", mqtt.state());
    delay(1000 + attempt * 400);
    yield();
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(RELAY_PIN, OUTPUT);
  applyRelay(false);
  buildTopics();

  if (!connectWifi())
    return;

  reconnectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost");
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
           DEVICE_ID, relayOn ? "on" : "off", now, (unsigned)ESP.getFreeHeap(),
           relRemain, (long)(paidUntilUnix ? paidUntilUnix : 0));

  if (!mqtt.publish(topicTelemetry, payload, false))
    Serial.println("telemetry publish failed");
}
