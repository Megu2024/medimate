/**
 * MediMate Smart Medicine Box — integrated firmware
 * ESP32 Arduino Core 3.x, DS3231, 0.96-inch SSD1306 OLED, 3 reed sensors,
 * MAX98357A I2S amplifier, compressed prerecorded prompts, and cloud API.
 *
 * Required libraries: Adafruit SSD1306, Adafruit GFX, RTClib, ArduinoJson 6/7.
 * I2S playback uses ESP_I2S.h supplied by the ESP32 Arduino core.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Preferences.h>
#include <ESP_I2S.h>
#include "RTClib.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include "config.h"
#include "medimate_prompts.h"

#define AUDIO_CHUNK 256

// ---------------------------- Hardware ----------------------------
RTC_DS3231 rtc;
TwoWire oledWire(1);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &oledWire, OLED_RESET);
I2SClass i2s;
WiFiClientSecure secureClient;
QueueHandle_t audioQueue = nullptr;
bool rtcReady = false;
bool oledReady = false;

// ---------------------------- Schedules ----------------------------
struct MedicineSchedule {
  String id;
  String name;
  String category;
  String scheduledTimeText;
  String deadlineTimeText;
  String startDate;
  String endDate;
  String frequency;
  int compartment = 0;
  int scheduledHour = 0;
  int scheduledMinute = 0;
  int deadlineHour = 0;
  int deadlineMinute = 0;
  int repeatIntervalMinutes = 5;
  bool dayEnabled[7] = {true, true, true, true, true, true, true}; // Sun..Sat
  bool isTakenToday = false; // This means the correct lid was opened, not ingestion confirmed.
  uint32_t lastReminderAtMs = 0;
};
MedicineSchedule cachedSchedules[MAX_SCHEDULES];
int activeScheduleCount = 0;
int activeReminderCompartment = 0;
int currentDateKey = -1;

// ---------------------------- Reed switch debounce ----------------------------
const int reedPins[3] = {PIN_REED_C1, PIN_REED_C2, PIN_REED_C3};
int rawReedState[3] = {HIGH, HIGH, HIGH};
int stableRawReedState[3] = {HIGH, HIGH, HIGH};
uint32_t reedChangedAtMs[3] = {0, 0, 0};
bool lidOpenState[3] = {false, false, false};

// ---------------------------- Offline event queue ----------------------------
struct DeviceEventItem {
  char eventId[37];
  char timestamp[32];
  int compartment;
  char lidState[8];
};
DeviceEventItem eventBuffer[MAX_BUFFERED_EVENTS];
int eventBufferHead = 0;
int eventBufferTail = 0;
int eventBufferCount = 0;

// ---------------------------- Timers / OLED message ----------------------------
uint32_t lastHeartbeatAtMs = 0;
uint32_t lastSyncAtMs = 0;
uint32_t lastWifiRetryAtMs = 0;
uint32_t lastOledRefreshAtMs = 0;
String transientTitle = "";
String transientLine1 = "";
String transientLine2 = "";
uint32_t transientUntilMs = 0;

// ---------------------------- IMA ADPCM decoder tables ----------------------------
static const int16_t STEP_TABLE[89] = {
  7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,
  50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,
  253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,
  1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,
  3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,
  10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,
  27086,29794,32767
};
static const int8_t INDEX_TABLE[16] = {
  -1,-1,-1,-1,2,4,6,8,-1,-1,-1,-1,2,4,6,8
};
static int16_t audioPcm[AUDIO_CHUNK];

int16_t decodeNibble(uint8_t code, int32_t &predictor, int &index) {
  const int step = STEP_TABLE[index];
  int diff = step >> 3;
  if (code & 1) diff += step >> 2;
  if (code & 2) diff += step >> 1;
  if (code & 4) diff += step;
  if (code & 8) predictor -= diff;
  else predictor += diff;
  if (predictor > 32767) predictor = 32767;
  if (predictor < -32768) predictor = -32768;
  index += INDEX_TABLE[code & 0x0F];
  if (index < 0) index = 0;
  if (index > 88) index = 88;
  return (int16_t)predictor;
}

void playPromptBlocking(MediMatePrompt id) {
  const MediMateAudioPrompt prompt = getMediMatePrompt(id);
  if (prompt.adpcm == nullptr || prompt.sampleCount == 0) {
    Serial.println("[Audio] Invalid prompt ID");
    return;
  }

  Serial.printf("[Audio] Playing %s\n", getMediMatePromptName(id));
  int32_t predictor = prompt.initialSample;
  int index = 0;
  uint32_t decodedSamples = 0;

  while (decodedSamples < prompt.sampleCount) {
    uint32_t count = prompt.sampleCount - decodedSamples;
    if (count > AUDIO_CHUNK) count = AUDIO_CHUNK;

    for (uint32_t i = 0; i < count; i++) {
      const uint32_t sampleIndex = decodedSamples + i;
      if (sampleIndex == 0) {
        audioPcm[i] = prompt.initialSample;
      } else {
        const uint32_t codeIndex = sampleIndex - 1;
        const uint8_t packed = pgm_read_byte(&prompt.adpcm[codeIndex / 2]);
        const uint8_t nibble = (codeIndex & 1) ? (packed >> 4) : (packed & 0x0F);
        audioPcm[i] = decodeNibble(nibble, predictor, index);
      }
    }

    const size_t bytes = count * sizeof(int16_t);
    size_t written = 0;
    while (written < bytes) {
      const size_t n = i2s.write((uint8_t *)audioPcm + written, bytes - written);
      if (n == 0) {
        Serial.println("[Audio] I2S write failed; ending this prompt");
        return;
      }
      written += n;
    }
    decodedSamples += count;
  }
}

void audioTask(void *parameter) {
  (void)parameter;
  uint8_t promptId = 0;
  for (;;) {
    if (xQueueReceive(audioQueue, &promptId, portMAX_DELAY) == pdTRUE) {
      playPromptBlocking((MediMatePrompt)promptId);
    }
  }
}

void queueAudioPrompt(MediMatePrompt id) {
  if (audioQueue == nullptr) return;
  const uint8_t promptId = (uint8_t)id;
  if (xQueueSend(audioQueue, &promptId, 0) != pdTRUE) {
    Serial.printf("[Audio] Prompt queue full; skipped %s\n", getMediMatePromptName(id));
  }
}

MediMatePrompt reminderPromptForCompartment(int c) {
  if (c == 1) return PROMPT_REMINDER_C1;
  if (c == 2) return PROMPT_REMINDER_C2;
  return PROMPT_REMINDER_C3;
}
MediMatePrompt correctPromptForCompartment(int c) {
  if (c == 1) return PROMPT_CORRECT_C1_OPENED;
  if (c == 2) return PROMPT_CORRECT_C2_OPENED;
  return PROMPT_CORRECT_C3_OPENED;
}
MediMatePrompt closedPromptForCompartment(int c) {
  if (c == 1) return PROMPT_C1_CLOSED_ACK;
  if (c == 2) return PROMPT_C2_CLOSED_ACK;
  return PROMPT_C3_CLOSED_ACK;
}
MediMatePrompt wrongPromptFor(int expected, int opened) {
  if (expected == 1 && opened == 2) return PROMPT_WRONG_DUE_C1_OPEN_C2;
  if (expected == 1 && opened == 3) return PROMPT_WRONG_DUE_C1_OPEN_C3;
  if (expected == 2 && opened == 1) return PROMPT_WRONG_DUE_C2_OPEN_C1;
  if (expected == 2 && opened == 3) return PROMPT_WRONG_DUE_C2_OPEN_C3;
  if (expected == 3 && opened == 1) return PROMPT_WRONG_DUE_C3_OPEN_C1;
  return PROMPT_WRONG_DUE_C3_OPEN_C2;
}

// ---------------------------- Network helpers ----------------------------
bool beginHttpRequest(HTTPClient &http, const String &url) {
  if (url.startsWith("https://")) {
    if (strlen(BACKEND_ROOT_CA) == 0) {
      Serial.println("[TLS] HTTPS selected but BACKEND_ROOT_CA is empty. Add the API host CA certificate in config.h.");
      return false;
    }
    secureClient.setCACert(BACKEND_ROOT_CA);
    return http.begin(secureClient, url);
  }
  return http.begin(url); // Local LAN HTTP for bench testing only.
}

void addDeviceHeaders(HTTPClient &http, bool jsonBody = false) {
  if (jsonBody) http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
}

String makeEventTimestamp(const DateTime &now) {
  char stamp[32];
  snprintf(stamp, sizeof(stamp), "%04d-%02d-%02dT%02d:%02d:%02d+05:30",
           now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
  return String(stamp);
}

String generateUUID() {
  const uint32_t a = esp_random();
  const uint32_t b = esp_random();
  const uint32_t c = esp_random();
  const uint32_t d = esp_random();
  char value[37];
  snprintf(value, sizeof(value), "%08lx-%04lx-4%03lx-%04lx-%04lx%08lx",
           (unsigned long)a, (unsigned long)((b >> 16) & 0xFFFF),
           (unsigned long)(b & 0x0FFF), (unsigned long)(((c >> 16) & 0x3FFF) | 0x8000),
           (unsigned long)(c & 0xFFFF), (unsigned long)d);
  return String(value);
}

void showTransient(const String &title, const String &line1, const String &line2, uint32_t durationMs = 3500) {
  transientTitle = title;
  transientLine1 = line1;
  transientLine2 = line2;
  transientUntilMs = millis() + durationMs;
}

// ---------------------------- RTC + date/time ----------------------------
void syncRtcFromServerUtc(const char *serverUtc) {
  if (!rtcReady || serverUtc == nullptr || !*serverUtc) return;
  int year, month, day, hour, minute, second;
  if (sscanf(serverUtc, "%d-%d-%dT%d:%d:%d", &year, &month, &day, &hour, &minute, &second) != 6) return;
  DateTime utc(year, month, day, hour, minute, second);
  DateTime local = utc + TimeSpan(0, 5, 30, 0); // Asia/Kolkata
  DateTime current = rtc.now();
  const int32_t difference = (int32_t)local.unixtime() - (int32_t)current.unixtime();
  if (difference > 10 || difference < -10) {
    rtc.adjust(local);
    Serial.printf("[RTC] Clock synchronized from backend; local time is %04d-%02d-%02d %02d:%02d:%02d\n",
                  local.year(), local.month(), local.day(), local.hour(), local.minute(), local.second());
  }
}

int dateKey(const DateTime &now) {
  return now.year() * 10000 + now.month() * 100 + now.day();
}
String dateText(const DateTime &now) {
  char value[11];
  snprintf(value, sizeof(value), "%04d-%02d-%02d", now.year(), now.month(), now.day());
  return String(value);
}

const char *WEEKDAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

void saveScheduleCacheToNvs() {
  if (!rtcReady) return;
  StaticJsonDocument<4096> doc;
  const DateTime now = rtc.now();
  doc["dateKey"] = dateKey(now);
  doc["savedAt"] = dateText(now);
  JsonArray meds = doc.createNestedArray("medicines");
  for (int i = 0; i < activeScheduleCount; i++) {
    const MedicineSchedule &s = cachedSchedules[i];
    JsonObject med = meds.createNestedObject();
    med["id"] = s.id;
    med["name"] = s.name;
    med["category"] = s.category;
    med["compartment"] = s.compartment;
    med["scheduledTime"] = s.scheduledTimeText;
    med["deadlineTime"] = s.deadlineTimeText;
    med["repeatIntervalMinutes"] = s.repeatIntervalMinutes;
    med["startDate"] = s.startDate;
    med["endDate"] = s.endDate;
    med["frequency"] = s.frequency;
    med["takenToday"] = s.isTakenToday;
    JsonArray days = med.createNestedArray("daysOfWeek");
    for (int d = 0; d < 7; d++) if (s.dayEnabled[d]) days.add(WEEKDAY_NAMES[d]);
  }

  String payload;
  if (serializeJson(doc, payload) == 0) {
    Serial.println("[NVS] Could not serialize schedule cache");
    return;
  }
  Preferences prefs;
  if (!prefs.begin("medimate", false)) {
    Serial.println("[NVS] Could not open schedule cache for writing");
    return;
  }
  const size_t written = prefs.putString(NVS_SCHEDULE_CACHE_KEY, payload);
  prefs.end();
  if (written == 0) Serial.println("[NVS] Schedule cache write failed");
}

void loadScheduleCacheFromNvs() {
  if (!rtcReady) return;
  Preferences prefs;
  if (!prefs.begin("medimate", true)) return;
  const String payload = prefs.getString(NVS_SCHEDULE_CACHE_KEY, "");
  prefs.end();
  if (payload.length() == 0) {
    Serial.println("[NVS] No saved schedule cache; configure the box online once");
    return;
  }

  DynamicJsonDocument doc(4096);
  const DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.printf("[NVS] Saved schedule cache is invalid: %s\n", error.c_str());
    return;
  }
  const int savedDateKey = doc["dateKey"] | -1;
  const int todayKey = dateKey(rtc.now());
  int loaded = 0;
  JsonArray meds = doc["medicines"].as<JsonArray>();
  for (JsonObject med : meds) {
    if (loaded >= MAX_SCHEDULES) break;
    MedicineSchedule s;
    s.id = med["id"] | "";
    s.name = med["name"] | "Medicine";
    s.category = med["category"] | "";
    s.compartment = med["compartment"] | 0;
    s.scheduledTimeText = med["scheduledTime"] | "08:00";
    s.deadlineTimeText = med["deadlineTime"] | "08:30";
    s.repeatIntervalMinutes = med["repeatIntervalMinutes"] | 5;
    s.startDate = med["startDate"] | "";
    s.endDate = med["endDate"] | "";
    s.frequency = med["frequency"] | "daily";
    if (sscanf(s.scheduledTimeText.c_str(), "%d:%d", &s.scheduledHour, &s.scheduledMinute) != 2) continue;
    if (sscanf(s.deadlineTimeText.c_str(), "%d:%d", &s.deadlineHour, &s.deadlineMinute) != 2) continue;
    for (int d = 0; d < 7; d++) s.dayEnabled[d] = (s.frequency != "specific_days");
    JsonArray days = med["daysOfWeek"].as<JsonArray>();
    for (JsonVariant dayVariant : days) {
      const String day = dayVariant.as<String>();
      for (int d = 0; d < 7; d++) if (day == WEEKDAY_NAMES[d]) s.dayEnabled[d] = true;
    }
    s.isTakenToday = (savedDateKey == todayKey) && (med["takenToday"] | false);
    s.lastReminderAtMs = 0; // millis() does not survive reboot.
    if (s.compartment >= 1 && s.compartment <= 3) cachedSchedules[loaded++] = s;
  }
  activeScheduleCount = loaded;
  Serial.printf("[NVS] Loaded %d cached medicine schedule(s) for offline reminders\n", activeScheduleCount);
}

bool scheduleAppliesToday(const MedicineSchedule &s, const DateTime &now) {
  const String today = dateText(now);
  if (s.startDate.length() && today < s.startDate) return false;
  if (s.endDate.length() && today > s.endDate) return false;
  if (s.frequency == "specific_days") {
    const int weekday = now.dayOfTheWeek(); // RTClib: 0=Sunday
    if (weekday < 0 || weekday > 6 || !s.dayEnabled[weekday]) return false;
  }
  return true;
}

bool isWithinReminderWindow(int nowMins, int startMins, int endMins) {
  if (endMins > startMins) return nowMins >= startMins && nowMins <= endMins;
  if (endMins < startMins) return nowMins >= startMins || nowMins <= endMins;
  return nowMins == startMins;
}

int findActiveDueCompartment(const DateTime &now, uint32_t nowMs, bool enqueueReminder) {
  if (!rtcReady) return 0;
  const int nowMins = now.hour() * 60 + now.minute();
  int selectedIndex = -1;
  int greatestElapsed = -1;

  for (int i = 0; i < activeScheduleCount; i++) {
    MedicineSchedule &s = cachedSchedules[i];
    if (s.isTakenToday || !scheduleAppliesToday(s, now)) continue;
    const int start = s.scheduledHour * 60 + s.scheduledMinute;
    const int end = s.deadlineHour * 60 + s.deadlineMinute;
    if (!isWithinReminderWindow(nowMins, start, end)) continue;

    int elapsed = nowMins - start;
    if (elapsed < 0) elapsed += 1440;
    if (elapsed > greatestElapsed) {
      greatestElapsed = elapsed;
      selectedIndex = i;
    }
  }

  if (selectedIndex < 0) return 0;
  MedicineSchedule &active = cachedSchedules[selectedIndex];
  if (enqueueReminder) {
    const uint32_t intervalMs = (uint32_t)max(1, active.repeatIntervalMinutes) * 60000UL;
    if (active.lastReminderAtMs == 0 || nowMs - active.lastReminderAtMs >= intervalMs) {
      active.lastReminderAtMs = nowMs;
      queueAudioPrompt(reminderPromptForCompartment(active.compartment));
      showTransient("MEDICINE DUE", active.name, String("Open C") + active.compartment, 5000);
    }
  }
  return active.compartment;
}

// ---------------------------- Reed sensor logic ----------------------------
bool rawStateMeansOpen(int index, int rawState) {
  if (index == 0 && C1_MODULE_INVERTED) return rawState == LOW;
  return rawState == HIGH;
}

// ---------------------------- Offline event buffering ----------------------------
void bufferEvent(const char *eventId, const char *timestamp, int compartment, const char *lidState) {
  if (eventBufferCount >= MAX_BUFFERED_EVENTS) {
    Serial.println("[EventBuffer] Full; event could not be queued. Reconnect network promptly.");
    return;
  }
  DeviceEventItem &item = eventBuffer[eventBufferHead];
  snprintf(item.eventId, sizeof(item.eventId), "%s", eventId);
  snprintf(item.timestamp, sizeof(item.timestamp), "%s", timestamp);
  item.compartment = compartment;
  snprintf(item.lidState, sizeof(item.lidState), "%s", lidState);
  eventBufferHead = (eventBufferHead + 1) % MAX_BUFFERED_EVENTS;
  eventBufferCount++;
  Serial.printf("[EventBuffer] Stored %s (%d queued)\n", eventId, eventBufferCount);
}

void uploadEvent(const char *eventId, const char *timestamp, int compartment, const char *lidState) {
  if (WiFi.status() != WL_CONNECTED) {
    bufferEvent(eventId, timestamp, compartment, lidState);
    return;
  }

  HTTPClient http;
  const String url = String(BACKEND_BASE_URL) + "/api/device-api/events";
  if (!beginHttpRequest(http, url)) {
    bufferEvent(eventId, timestamp, compartment, lidState);
    return;
  }
  addDeviceHeaders(http, true);
  StaticJsonDocument<384> doc;
  doc["eventId"] = eventId;
  doc["timestamp"] = timestamp;
  doc["compartment"] = compartment;
  doc["lidState"] = lidState;
  String body;
  serializeJson(doc, body);
  const int code = http.POST(body);
  if (code >= 200 && code < 300) {
    Serial.printf("[Cloud] Event uploaded: C%d %s\n", compartment, lidState);
  } else {
    Serial.printf("[Cloud] Event upload failed (%d); buffering\n", code);
    bufferEvent(eventId, timestamp, compartment, lidState);
  }
  http.end();
}

void flushBufferedEvents() {
  if (eventBufferCount == 0 || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  const String url = String(BACKEND_BASE_URL) + "/api/device-api/events";
  if (!beginHttpRequest(http, url)) return;
  addDeviceHeaders(http, true);
  DynamicJsonDocument doc(4096);
  JsonArray events = doc.createNestedArray("events");
  const int count = eventBufferCount;
  for (int i = 0; i < count; i++) {
    const int index = (eventBufferTail + i) % MAX_BUFFERED_EVENTS;
    JsonObject e = events.createNestedObject();
    e["eventId"] = eventBuffer[index].eventId;
    e["timestamp"] = eventBuffer[index].timestamp;
    e["compartment"] = eventBuffer[index].compartment;
    e["lidState"] = eventBuffer[index].lidState;
    e["isBuffered"] = true;
  }
  String body;
  serializeJson(doc, body);
  const int code = http.POST(body);
  if (code >= 200 && code < 300) {
    eventBufferTail = (eventBufferTail + count) % MAX_BUFFERED_EVENTS;
    eventBufferCount -= count;
    Serial.printf("[EventBuffer] Uploaded queued events; remaining %d\n", eventBufferCount);
  } else {
    Serial.printf("[EventBuffer] Batch upload failed (%d); keeping queue\n", code);
  }
  http.end();
}

// ---------------------------- Cloud API ----------------------------
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  const String url = String(BACKEND_BASE_URL) + "/api/device-api/heartbeat";
  if (!beginHttpRequest(http, url)) return;
  addDeviceHeaders(http, true);
  StaticJsonDocument<256> doc;
  doc["firmwareVersion"] = "2.0.0-integrated";
  doc["wifiRssi"] = WiFi.RSSI();
  doc["ipAddress"] = WiFi.localIP().toString();
  String body;
  serializeJson(doc, body);
  const int code = http.POST(body);
  if (code >= 200 && code < 300) Serial.println("[Cloud] Heartbeat acknowledged");
  else Serial.printf("[Cloud] Heartbeat failed: HTTP %d\n", code);
  http.end();
}

void fetchSchedules() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  const String url = String(BACKEND_BASE_URL) + "/api/device-api/config";
  if (!beginHttpRequest(http, url)) return;
  addDeviceHeaders(http, false);
  const int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("[Cloud] Schedule sync failed: HTTP %d\n", code);
    http.end();
    return;
  }

  const String payload = http.getString();
  DynamicJsonDocument doc(6144);
  const DeserializationError error = deserializeJson(doc, payload);
  if (error || !doc["success"].as<bool>()) {
    Serial.printf("[Cloud] Invalid configuration JSON: %s\n", error ? error.c_str() : "success=false");
    http.end();
    return;
  }

  syncRtcFromServerUtc(doc["serverUtc"] | "");

  MedicineSchedule previous[MAX_SCHEDULES];
  const int previousCount = activeScheduleCount;
  for (int i = 0; i < previousCount; i++) previous[i] = cachedSchedules[i];

  int loaded = 0;
  JsonArray medicines = doc["medicines"].as<JsonArray>();
  for (JsonObject med : medicines) {
    if (loaded >= MAX_SCHEDULES) break;
    MedicineSchedule s;
    s.id = med["id"] | "";
    s.name = med["name"] | "Medicine";
    s.category = med["category"] | "";
    s.compartment = med["compartment"] | 0;
    s.scheduledTimeText = med["scheduledTime"] | "08:00";
    s.deadlineTimeText = med["deadlineTime"] | "08:30";
    s.repeatIntervalMinutes = med["repeatIntervalMinutes"] | 5;
    s.startDate = med["startDate"] | "";
    s.endDate = med["endDate"] | "";
    s.frequency = med["frequency"] | "daily";
    if (sscanf(s.scheduledTimeText.c_str(), "%d:%d", &s.scheduledHour, &s.scheduledMinute) != 2) continue;
    if (sscanf(s.deadlineTimeText.c_str(), "%d:%d", &s.deadlineHour, &s.deadlineMinute) != 2) continue;
    for (int d = 0; d < 7; d++) s.dayEnabled[d] = (s.frequency != "specific_days");
    JsonArray days = med["daysOfWeek"].as<JsonArray>();
    for (JsonVariant dayVariant : days) {
      const String day = dayVariant.as<String>();
      if (day == "Sun") s.dayEnabled[0] = true;
      else if (day == "Mon") s.dayEnabled[1] = true;
      else if (day == "Tue") s.dayEnabled[2] = true;
      else if (day == "Wed") s.dayEnabled[3] = true;
      else if (day == "Thu") s.dayEnabled[4] = true;
      else if (day == "Fri") s.dayEnabled[5] = true;
      else if (day == "Sat") s.dayEnabled[6] = true;
    }

    for (int old = 0; old < previousCount; old++) {
      if (previous[old].id == s.id && s.id.length()) {
        s.isTakenToday = previous[old].isTakenToday;
        s.lastReminderAtMs = previous[old].lastReminderAtMs;
        break;
      }
    }
    if (s.compartment >= 1 && s.compartment <= 3) {
      cachedSchedules[loaded] = s;
      Serial.printf("[Config] C%d: %s at %s until %s (%s, repeat %d min)\n",
                    s.compartment, s.name.c_str(), s.scheduledTimeText.c_str(),
                    s.deadlineTimeText.c_str(), s.frequency.c_str(), s.repeatIntervalMinutes);
      loaded++;
    }
  }
  activeScheduleCount = loaded;
  saveScheduleCacheToNvs();
  Serial.printf("[Cloud] Loaded %d medicine schedule(s)\n", activeScheduleCount);
  http.end();
}

void attemptWifiReconnect(uint32_t nowMs) {
  if (WiFi.status() == WL_CONNECTED) return;
  if (nowMs - lastWifiRetryAtMs < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiRetryAtMs = nowMs;
  Serial.println("[Wi-Fi] Attempting reconnection...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ---------------------------- UI ----------------------------
void renderDisplay(const DateTime &now) {
  if (!oledReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("MediMate ");
  display.print(WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(18, 14);
  display.printf("%02d:%02d:%02d", now.hour(), now.minute(), now.second());
  display.setTextSize(1);

  if (millis() < transientUntilMs) {
    display.setCursor(0, 38);
    display.print(transientTitle.substring(0, 21));
    display.setCursor(0, 48);
    display.print(transientLine1.substring(0, 21));
    display.setCursor(0, 57);
    display.print(transientLine2.substring(0, 21));
  } else if (activeReminderCompartment > 0) {
    display.setCursor(0, 39);
    display.printf("MEDICINE DUE: C%d", activeReminderCompartment);
    display.setCursor(0, 52);
    display.print("Please open correct box");
  } else {
    display.setCursor(0, 38);
    display.printf("Schedules: %d", activeScheduleCount);
    display.setCursor(0, 50);
    display.printf("C1:%s C2:%s C3:%s",
                   lidOpenState[0] ? "OPEN" : "CLOSED",
                   lidOpenState[1] ? "OPEN" : "CLOSED",
                   lidOpenState[2] ? "OPEN" : "CLOSED");
  }
  display.display();
}

// ---------------------------- Event processing ----------------------------
void handleLidTransition(int compartment, bool isOpen, const DateTime &now) {
  const String eventId = generateUUID();
  const String timestamp = makeEventTimestamp(now);
  const int index = compartment - 1;

  if (isOpen) {
    Serial.printf("[Sensor] C%d OPENED\n", compartment);
    if (activeReminderCompartment > 0 && compartment == activeReminderCompartment) {
      queueAudioPrompt(correctPromptForCompartment(compartment));
      showTransient("CORRECT COMPARTMENT", String("C") + compartment + " opened", "Follow prescription", 5000);
      for (int i = 0; i < activeScheduleCount; i++) {
        if (cachedSchedules[i].compartment == compartment) {
          cachedSchedules[i].isTakenToday = true; // Lid-open confirmation only.
          saveScheduleCacheToNvs();
          break;
        }
      }
      activeReminderCompartment = 0;
    } else if (activeReminderCompartment > 0 && compartment != activeReminderCompartment) {
      queueAudioPrompt(wrongPromptFor(activeReminderCompartment, compartment));
      showTransient("WRONG COMPARTMENT", String("Opened C") + compartment,
                    String("Please open C") + activeReminderCompartment, 6000);
    } else {
      showTransient("COMPARTMENT OPEN", String("C") + compartment + " opened", "No dose currently due", 3000);
    }
    lidOpenState[index] = true;
    uploadEvent(eventId.c_str(), timestamp.c_str(), compartment, "open");
  } else {
    Serial.printf("[Sensor] C%d CLOSED\n", compartment);
    lidOpenState[index] = false;
    queueAudioPrompt(closedPromptForCompartment(compartment));
    showTransient("COMPARTMENT CLOSED", String("C") + compartment + " closed", "Stay healthy", 3000);
    uploadEvent(eventId.c_str(), timestamp.c_str(), compartment, "closed");
  }
}

// ---------------------------- Setup / main loop ----------------------------
void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n=== MediMate Integrated Firmware v2.0.0 ===");

  pinMode(PIN_REED_C1, INPUT); // KY-025 module D0; LOW means open on this assembled unit.
  pinMode(PIN_REED_C2, INPUT_PULLUP);
  pinMode(PIN_REED_C3, INPUT_PULLUP);

  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL, 100000);
  oledWire.begin(PIN_OLED_SDA, PIN_OLED_SCL, 100000);

  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS, true, false)) {
    oledReady = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 18);
    display.println("MediMate Smart Box");
    display.println("Starting integrated");
    display.println("firmware...");
    display.display();
  } else {
    Serial.println("[OLED] Initialization failed; continuing without display");
  }

  rtcReady = rtc.begin();
  if (!rtcReady) {
    Serial.println("[RTC] DS3231 not detected. Local reminders will be disabled until it is available.");
  } else if (rtc.lostPower()) {
    Serial.println("[RTC] Lost power; setting to firmware build time. Backend sync will correct it when online.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  if (rtcReady) {
    currentDateKey = dateKey(rtc.now());
    loadScheduleCacheFromNvs();
  }

  // Initialize the I2S amplifier using the pins previously confirmed to work.
  i2s.setPins(I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
  if (!i2s.begin(I2S_MODE_STD, AUDIO_SAMPLE_RATE, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("[Audio] I2S initialization failed. Check MAX98357A BCLK/LRC/DIN/GND/power/SD.");
  } else {
    audioQueue = xQueueCreate(8, sizeof(uint8_t));
    if (audioQueue) {
      const BaseType_t taskResult = xTaskCreatePinnedToCore(
        audioTask, "MediMateAudio", 6144, nullptr, 1, nullptr, 0
      );
      if (taskResult == pdPASS) {
        Serial.println("[Audio] I2S ready; compressed voice prompt task started");
      } else {
        vQueueDelete(audioQueue);
        audioQueue = nullptr;
        Serial.println("[Audio] Could not start voice prompt task; check free heap");
      }
    } else {
      Serial.println("[Audio] Could not allocate prompt queue");
    }
  }

  // Seed debounce state so a lid already open at boot does not create a false transition.
  delay(20);
  for (int i = 0; i < 3; i++) {
    rawReedState[i] = digitalRead(reedPins[i]);
    stableRawReedState[i] = rawReedState[i];
    lidOpenState[i] = rawStateMeansOpen(i, stableRawReedState[i]);
    reedChangedAtMs[i] = millis();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[Wi-Fi] Connecting to %s", WIFI_SSID);
  const uint32_t connectStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - connectStart < 12000) {
    delay(300);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected; IP=%s RSSI=%d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    fetchSchedules(); // also syncs RTC from backend UTC where possible
    sendHeartbeat();
    flushBufferedEvents();
  } else {
    Serial.println("\n[Wi-Fi] Not connected. Local RTC reminders will continue from cached configuration after it is available.");
  }

  lastHeartbeatAtMs = millis();
  lastSyncAtMs = millis();
  lastWifiRetryAtMs = millis();
}

void loop() {
  const uint32_t nowMs = millis();
  attemptWifiReconnect(nowMs);

  DateTime now = rtcReady ? rtc.now() : DateTime(F(__DATE__), F(__TIME__));
  if (rtcReady) {
    const int key = dateKey(now);
    if (key != currentDateKey) {
      currentDateKey = key;
      for (int i = 0; i < activeScheduleCount; i++) {
        cachedSchedules[i].isTakenToday = false;
        cachedSchedules[i].lastReminderAtMs = 0;
      }
      Serial.println("[Schedule] New local date; reset daily compartment-open flags");
      saveScheduleCacheToNvs();
    }
    activeReminderCompartment = findActiveDueCompartment(now, nowMs, true);
  } else {
    activeReminderCompartment = 0;
  }

  // Correctly debounced lid transitions. The raw pin and stable pin states are separate.
  for (int i = 0; i < 3; i++) {
    const int reading = digitalRead(reedPins[i]);
    if (reading != rawReedState[i]) {
      rawReedState[i] = reading;
      reedChangedAtMs[i] = nowMs;
    }
    if ((nowMs - reedChangedAtMs[i]) >= REED_DEBOUNCE_MS && reading != stableRawReedState[i]) {
      stableRawReedState[i] = reading;
      const bool isOpen = rawStateMeansOpen(i, stableRawReedState[i]);
      handleLidTransition(i + 1, isOpen, now);
    }
  }

  if (WiFi.status() == WL_CONNECTED && nowMs - lastHeartbeatAtMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAtMs = nowMs;
    sendHeartbeat();
    flushBufferedEvents();
  }
  if (WiFi.status() == WL_CONNECTED && nowMs - lastSyncAtMs >= SCHEDULE_SYNC_INTERVAL_MS) {
    lastSyncAtMs = nowMs;
    fetchSchedules();
    flushBufferedEvents();
  }
  if (nowMs - lastOledRefreshAtMs >= OLED_REFRESH_INTERVAL_MS) {
    lastOledRefreshAtMs = nowMs;
    renderDisplay(now);
  }
  delay(5);
}
