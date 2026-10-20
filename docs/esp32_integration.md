# MediMate ESP32 Hardware Integration

This guide reflects the wiring confirmed on the current prototype. Use the current pin assignments below; older GPIO 13/14/27 and I2S 26/25/33 diagrams are obsolete for this unit.

## Confirmed pin map

| Part | Module pin | ESP32 pin | Notes |
|---|---|---:|---|
| Compartment C1 | KY-025 `D0` | GPIO 25 | Module output: LOW = open, HIGH = closed on this unit. Power the module with 3.3 V and GND; leave `A0` unused. |
| Compartment C2 | bare reed switch | GPIO 26 | Switch between GPIO 26 and GND; `INPUT_PULLUP`; LOW = closed, HIGH = open. |
| Compartment C3 | bare reed switch | GPIO 27 | Switch between GPIO 27 and GND; `INPUT_PULLUP`; LOW = closed, HIGH = open. |
| DS3231 RTC | SDA / SCL | GPIO 21 / GPIO 22 | Uses the default I²C bus (`Wire`). |
| SSD1306 OLED | SDA / SCL | GPIO 18 / GPIO 19 | Uses I²C bus 1, separate from the RTC to avoid the earlier bus issue. Address `0x3C`. |
| MAX98357A | BCLK | GPIO 32 | I²S clock |
| MAX98357A | LRC / WS | GPIO 33 | I²S word select |
| MAX98357A | DIN | GPIO 23 | I²S data |
| MAX98357A | VIN / GND | Board-rated supply / common GND | Use a supply allowed by your exact breakout board. Keep a common ground with ESP32. |
| MAX98357A | SD / EN | Logic HIGH / 3.3 V (if exposed) | Do not hold low; that can shut the amplifier down. |
| Speaker | SPK+ / SPK− | Across the two speaker terminals | **Do not connect either speaker terminal to ESP32 GND.** |

No status LED, DFPlayer, SD card, or PSRAM is required. The 15 voice prompts are compressed as IMA ADPCM and embedded in `medimate_prompts.h` in flash memory.

## Arduino IDE libraries

Install these through Library Manager:

- Adafruit SSD1306
- Adafruit GFX Library
- RTClib by Adafruit
- ArduinoJson (version 6 or 7)

`ESP_I2S.h` ships with ESP32 Arduino Core 3.x. Select `ESP32 Dev Module`. Because this sketch embeds all 15 prerecorded messages, retain the **Huge APP** partition scheme if your board/IDE provides it. The audio assets are roughly 804 KiB of binary payload before compiled firmware overhead.

## Connect the firmware to the website

1. Start the backend (`server/`) and confirm `http://localhost:5000/api/health` returns healthy.
2. Start the frontend (`client/`) and sign in.
3. Open **Device & ESP32** and select **Generate ESP32 Token**. Copy the displayed device ID and token immediately; the raw token is only displayed once.
4. Edit `firmware/medimate_esp32/config.h`:
   - `WIFI_SSID` and `WIFI_PASSWORD`: the device's 2.4 GHz Wi-Fi credentials.
   - `BACKEND_BASE_URL`: for local same-Wi-Fi testing, `http://<computer-LAN-IP>:5000` (not `localhost`).
   - `DEVICE_ID` and `DEVICE_TOKEN`: from the website.
5. Keep `BACKEND_ROOT_CA` blank for local HTTP testing only. For a deployed HTTPS backend, paste the verified CA certificate for the backend host into this value; the firmware intentionally refuses HTTPS if the CA is missing.
6. Keep `medimate_esp32.ino`, `config.h`, and `medimate_prompts.h` in the same Arduino sketch folder, compile, and upload.
7. Open Serial Monitor at 115200 baud. Look for Wi-Fi connection, backend schedule sync, and heartbeat acknowledgement.
8. Add medicines from the website, assign each to a distinct compartment, and verify that the device loads the schedules.

The API paths in this project are `/api/device-api/config`, `/api/device-api/events`, and `/api/device-api/heartbeat`. The firmware authenticates using `X-Device-Id` and `Authorization: Bearer <device-token>`; it never connects directly to MongoDB.

## Reminder and event behaviour

- DS3231 local time triggers reminders; the firmware uses `Asia/Kolkata` / UTC+05:30 for this prototype and syncs the RTC from the backend's UTC timestamp when connected.
- Reminders repeat at the configured interval until C1/C2/C3 for that due medicine opens or the reminder window ends.
- Opening the wrong compartment while a dose is due selects the matching prerecorded warning clip.
- Opening the correct compartment records **compartment access**, not proof that a tablet was swallowed.
- Lid-open and lid-close events are sent to the backend. If Wi-Fi is down, up to 20 events are buffered in RAM and retried on reconnection. This buffer is not persistent across power loss.
- The dashboard gets updates via the backend's Socket.IO event processor and can display device online/offline state from heartbeat activity.

## Local network note

The ESP32 and the computer running the backend must be on the same LAN for local HTTP testing. Find the computer's LAN IPv4 address (for example with `ipconfig` on Windows) and set it in `BACKEND_BASE_URL`. Do not use `http://localhost:5000` inside ESP32 firmware because `localhost` would mean the ESP32 itself.
