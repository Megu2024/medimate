# MediMate integrated ESP32 firmware

This sketch joins the confirmed hardware, prerecorded voice prompts, RTC-based reminders, local OLED status, and the MediMate website backend.

## Files in this folder

- `medimate_esp32.ino` — full firmware and REST client.
- `config.h` — Wi-Fi, API URL, device credentials, pin map, and timezone.
- `medimate_prompts.h` — compressed IMA ADPCM data for all 15 voice messages.

Keep all three files in the same Arduino sketch folder. The Arduino sketch folder must match the `.ino` basename (`medimate_esp32/medimate_esp32.ino`).

## Dependencies

Install Adafruit SSD1306, Adafruit GFX, RTClib, and ArduinoJson 6/7 through Arduino IDE Library Manager. Use ESP32 Arduino Core 3.x for `ESP_I2S.h`.

Set the board to `ESP32 Dev Module` and use the **Huge APP** partition scheme if available. There is no SD card or PSRAM dependency.

## Configure and upload

1. Run the Node/Express backend and React site; see the root project README.
2. Sign in to the site and go to **Device & ESP32** → **Generate ESP32 Token**.
3. In `config.h`, set `WIFI_SSID`, `WIFI_PASSWORD`, `BACKEND_BASE_URL`, `DEVICE_ID`, and `DEVICE_TOKEN`.
4. For local test, use `http://<computer-LAN-IP>:5000`; do not use `localhost`.
5. For deployed HTTPS, configure `BACKEND_ROOT_CA` with the trusted CA certificate for the chosen API host. HTTPS is rejected if it is not configured.
6. Upload and open Serial Monitor at 115200 baud.

## Hardware pins

- C1 KY-025 module `D0` → GPIO 25; LOW=open and HIGH=closed.
- C2 bare reed switch between GPIO 26 and GND; LOW=closed and HIGH=open.
- C3 bare reed switch between GPIO 27 and GND; LOW=closed and HIGH=open.
- DS3231: SDA GPIO 21, SCL GPIO 22.
- OLED: SDA GPIO 18, SCL GPIO 19 (separate I²C bus).
- MAX98357A: BCLK GPIO 32, LRC GPIO 33, DIN GPIO 23. Connect the speaker only across `SPK+` and `SPK−`; share GND and use board-rated amplifier power. Keep SD/EN HIGH if present.

See `../../docs/esp32_integration.md` for full wiring and cloud integration steps.

## Practical limitations

- Device timezone in this firmware is fixed to Asia/Kolkata (UTC+05:30). Adapt the timezone/offset logic if the patient's timezone changes.
- The reed switches only detect lid state. A correct-box event means that the correct lid was opened; it cannot prove the tablet was removed or swallowed.
- Offline events are held in RAM, limited to 20, and are lost if power is removed before upload.
- Use HTTP only on a trusted local network for bench testing. For deployment, configure HTTPS with a trusted CA certificate.
