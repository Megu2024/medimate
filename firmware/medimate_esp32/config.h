/**
 * MediMate integrated ESP32 configuration.
 * Set Wi-Fi, backend URL, device ID, and token before uploading.
 * Do not commit real credentials to a public repository.
 */
#ifndef MEDIMATE_CONFIG_H
#define MEDIMATE_CONFIG_H

// Wi-Fi at the medicine box's location (2.4 GHz network).
#define WIFI_SSID       "Redmi 10"
#define WIFI_PASSWORD   "megu2006"

// Local testing: http://YOUR_COMPUTER_LAN_IP:5000
// Cloud deployment: https://YOUR_BACKEND_HOST (configure BACKEND_ROOT_CA below).
#define BACKEND_BASE_URL "http://10.174.81.119:5000"
#define DEVICE_ID        "MEDIMATE-3530"
#define DEVICE_TOKEN     "51986cb6afc36007a29d7a2babff1286"

// For HTTPS deployments, paste the PEM root/intermediate CA trusted for your API host.
// Leave empty for local HTTP testing only. The firmware refuses HTTPS without a CA.
static const char BACKEND_ROOT_CA[] PROGMEM = "";

// Verified physical wiring for this prototype.
// C1 is the KY-025-style module D0 output: LOW=open, HIGH=closed.
// C2/C3 are bare reed switches to GND using INPUT_PULLUP: HIGH=open, LOW=closed.
#define PIN_REED_C1       25
#define PIN_REED_C2       26
#define PIN_REED_C3       27
#define C1_MODULE_INVERTED 1

// DS3231 uses the default I2C controller (Wire).
#define PIN_RTC_SDA       21
#define PIN_RTC_SCL       22

// OLED uses the second I2C controller to avoid the previously observed bus conflict.
#define PIN_OLED_SDA      18
#define PIN_OLED_SCL      19
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64
#define OLED_RESET        -1
#define OLED_I2C_ADDRESS  0x3C

// MAX98357A I2S amplifier, verified working tone pinout.
#define I2S_BCLK_PIN      32
#define I2S_LRC_PIN       33
#define I2S_DIN_PIN       23
#define AUDIO_SAMPLE_RATE 16000UL

#define REED_DEBOUNCE_MS  50UL
#define HEARTBEAT_INTERVAL_MS 60000UL
#define SCHEDULE_SYNC_INTERVAL_MS 300000UL
#define WIFI_RETRY_INTERVAL_MS 10000UL
#define OLED_REFRESH_INTERVAL_MS 1000UL
#define MAX_SCHEDULES 3
#define MAX_BUFFERED_EVENTS 20
#define NVS_SCHEDULE_CACHE_KEY "schedules"

// Device and patient are configured in Asia/Kolkata; DS3231 stores local India time.
#define RTC_UTC_OFFSET_SECONDS (5L * 60L * 60L + 30L * 60L)
#define PATIENT_TIMEZONE       "Asia/Kolkata"

#endif
