#include <BH1750.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <time.h>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy secrets.example.h to secrets.h and enter your Wi-Fi and API settings."
#endif

// Example pin map for a classic ESP32 DevKit board. Change these to match
// the board and sensor modules you actually use.
constexpr uint8_t SOIL_MOISTURE_PIN = 34;
constexpr uint8_t WATER_LEVEL_PIN = 35;
constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;

constexpr uint32_t SAMPLE_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr uint32_t HTTP_TIMEOUT_MS = 5000;

// Calibrate these raw ADC values for your own probes before using the
// percentages for farm decisions. ESP32 ADC readings are board dependent.
constexpr int SOIL_DRY_RAW = 3200;
constexpr int SOIL_WET_RAW = 1400;
constexpr int WATER_EMPTY_RAW = 400;
constexpr int WATER_FULL_RAW = 3200;

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;

uint32_t lastSampleMillis = 0;
bool firstSample = true;
bool lightSensorReady = false;

bool connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.printf("Connecting to Wi-Fi: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED
         && millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi unavailable; will retry at the next sample.");
    return false;
  }

  Serial.print("Connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

float soilMoisturePercent(int rawValue) {
  const float span = static_cast<float>(SOIL_DRY_RAW - SOIL_WET_RAW);
  if (span == 0.0f) {
    return NAN;
  }

  const float percent = 100.0f * (SOIL_DRY_RAW - rawValue) / span;
  return constrain(percent, 0.0f, 100.0f);
}

float waterLevelPercent(int rawValue) {
  const float span = static_cast<float>(WATER_FULL_RAW - WATER_EMPTY_RAW);
  if (span == 0.0f) {
    return NAN;
  }

  const float percent = 100.0f * (rawValue - WATER_EMPTY_RAW) / span;
  return constrain(percent, 0.0f, 100.0f);
}

bool utcTimestamp(char* output, size_t outputSize) {
  const time_t now = time(nullptr);
  // Ignore timestamps until NTP has set the clock after boot.
  if (now < 1700000000) {
    return false;
  }

  struct tm utcTime;
  if (gmtime_r(&now, &utcTime) == nullptr) {
    return false;
  }

  return strftime(output, outputSize, "%Y-%m-%dT%H:%M:%SZ", &utcTime) > 0;
}

void sendReading(
  float soilPercent,
  float temperatureCelsius,
  float humidityPercent,
  float lightLux,
  float waterPercent,
  const char* timestamp
) {
  String payload;
  payload.reserve(220);
  payload = "{\"timestamp\":\"";
  payload += timestamp;
  payload += "\",\"soil_moisture_percent\":";
  payload += String(soilPercent, 1);
  payload += ",\"temperature_celsius\":";
  payload += String(temperatureCelsius, 1);
  payload += ",\"humidity_percent\":";
  payload += String(humidityPercent, 1);
  payload += ",\"light_lux\":";
  payload += String(lightLux, 1);
  payload += ",\"water_level_percent\":";
  payload += String(waterPercent, 1);
  payload += "}";

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(client, API_URL)) {
    Serial.println("Could not start the HTTP connection; will retry later.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  const int responseCode = http.POST(payload);

  if (responseCode > 0) {
    Serial.printf("Sent reading. API response: %d\n", responseCode);
  } else {
    Serial.printf(
      "Could not send reading: %s\n",
      HTTPClient::errorToString(responseCode).c_str()
    );
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  lightSensorReady = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!lightSensorReady) {
    Serial.println("BH1750 was not detected. Check SDA, SCL, power, and ground.");
  }

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  connectToWiFi();

  Serial.println("Smart farming ESP32 sensor node started.");
  Serial.println("Pump control is not connected; irrigation remains simulated by the API.");
}

void loop() {
  if (!firstSample && millis() - lastSampleMillis < SAMPLE_INTERVAL_MS) {
    delay(20);
    return;
  }

  firstSample = false;
  lastSampleMillis = millis();

  if (!connectToWiFi()) {
    return;
  }

  if (!lightSensorReady) {
    Serial.println("Skipping sample because the BH1750 is unavailable.");
    return;
  }

  const int soilRaw = analogRead(SOIL_MOISTURE_PIN);
  const int waterRaw = analogRead(WATER_LEVEL_PIN);
  const float soilPercent = soilMoisturePercent(soilRaw);
  const float waterPercent = waterLevelPercent(waterRaw);
  const float temperatureCelsius = dht.readTemperature();
  const float humidityPercent = dht.readHumidity();
  const float lightLux = lightMeter.readLightLevel();

  if (!isfinite(soilPercent)
      || !isfinite(waterPercent)
      || !isfinite(temperatureCelsius)
      || !isfinite(humidityPercent)
      || !isfinite(lightLux)
      || temperatureCelsius < -50.0f
      || temperatureCelsius > 100.0f
      || humidityPercent < 0.0f
      || humidityPercent > 100.0f
      || lightLux < 0.0f) {
    Serial.println("A sensor value is invalid. Check the wiring and sensor power.");
    return;
  }

  char timestamp[25];
  if (!utcTimestamp(timestamp, sizeof(timestamp))) {
    Serial.println("Waiting for network time before sending readings.");
    return;
  }

  Serial.printf(
    "Soil %.1f%%, temperature %.1f C, humidity %.1f%%, light %.1f lux, water %.1f%%\n",
    soilPercent,
    temperatureCelsius,
    humidityPercent,
    lightLux,
    waterPercent
  );

  sendReading(
    soilPercent,
    temperatureCelsius,
    humidityPercent,
    lightLux,
    waterPercent,
    timestamp
  );
}
