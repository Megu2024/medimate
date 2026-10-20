# MediMate Integration — Start Here

This package connects the existing React website, Express/MongoDB backend, and ESP32 three-compartment medicine box. Read this file before uploading firmware.

## 1. Start the backend

1. Install a local MongoDB service or create a MongoDB Atlas database.
2. Open a terminal in `ES-Project/server` and run `npm install`.
3. Copy `ES-Project/.env.example` to `ES-Project/server/.env`.
4. Edit `server/.env`: set `MONGODB_URI`, a strong unique `JWT_SECRET`, and a new random 64-character hexadecimal `ENCRYPTION_KEY`. Configure optional Gemini/Twilio/VAPID values only if you use those features.
5. Run `npm run dev` from `server`.
6. Verify `http://localhost:5000/api/health` returns a healthy status.

## 2. Start the website

1. Open a second terminal in `ES-Project/client`.
2. Run `npm install`, then `npm run dev`.
3. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).
4. Register/sign in and configure the patient profile.
5. Open **Device & ESP32** and click **Generate ESP32 Token**. Copy the device ID and token immediately; the raw token is shown once.
6. Add a medicine in each compartment you need (C1, C2, C3). Avoid overlapping reminders during initial hardware testing.

## 3. Configure the ESP32

1. Install these Arduino IDE libraries: **Adafruit SSD1306**, **Adafruit GFX Library**, **RTClib by Adafruit**, and **ArduinoJson 6 or 7**. `ESP_I2S.h` is included with ESP32 Arduino Core 3.x.
2. Open `firmware/medimate_esp32/medimate_esp32.ino`. Keep `config.h` and `medimate_prompts.h` in the same sketch folder.
3. In `config.h`, enter your 2.4 GHz Wi-Fi SSID/password and the website-generated `DEVICE_ID`/`DEVICE_TOKEN`.
4. For a local bench test, set `BACKEND_BASE_URL` to `http://<PC-LAN-IPv4>:5000`. On Windows, find the PC IPv4 address with `ipconfig`. **Do not use `localhost` in the ESP32 setting.** The ESP32 and PC must be on the same LAN, and Windows Firewall must allow the Node server on the private network.
5. Keep `BACKEND_ROOT_CA` blank only for local HTTP testing on a trusted LAN. For a deployed HTTPS backend, set the correct trusted CA PEM in `config.h`; the firmware intentionally refuses an HTTPS connection without a CA.
6. Select **ESP32 Dev Module** and **Huge APP** partition (if available), then upload. Open Serial Monitor at **115200 baud**.

## 4. Verify the complete flow

- The serial log should show Wi-Fi connected, schedule sync, and heartbeat acknowledgement.
- The device page should report the ESP32 online after a heartbeat is received.
- Add/update medicines on the website and wait for a sync (or reboot the ESP32 after the configuration is saved).
- Test at a schedule time using the correct lid, the wrong lid, and the lid-close transition. Check the OLED, voice response, Dashboard, and History.

## Confirmed pin map

- C1 KY-025 D0: GPIO 25 (LOW = open on this assembly)
- C2 bare reed: GPIO 26 to GND with `INPUT_PULLUP` (HIGH = open)
- C3 bare reed: GPIO 27 to GND with `INPUT_PULLUP` (HIGH = open)
- DS3231: SDA GPIO 21, SCL GPIO 22
- OLED on separate I²C bus: SDA GPIO 18, SCL GPIO 19, address `0x3C`
- MAX98357A: BCLK GPIO 32, LRC GPIO 33, DIN GPIO 23
- Speaker: across `SPK+` and `SPK−` only. Share GND and use an amplifier supply allowed by your exact breakout board. Do not tie either speaker terminal to ESP32 GND.

## Important limitations

- A reed switch confirms a compartment lid opened or closed. It cannot confirm that a tablet was removed or swallowed; website events are described as compartment access.
- The current firmware buffers up to 20 events in RAM if the network is down. They survive short Wi-Fi outages, but buffered events are lost if power is removed before upload. The latest schedule cache is stored in ESP32 NVS.
- The current website supports daily schedules or selected weekdays with an optional start/end date, not arbitrary per-calendar-date selections.
- The prototype timezone is Asia/Kolkata (UTC+05:30).

## Secret hygiene

A `.env` file existed in the uploaded source archive and is intentionally **not** included in this output. If it contained real MongoDB, JWT, Gemini, Twilio, or other credentials, rotate any affected secrets. Never publish `server/.env` or put secrets in the React client.

## Validation note

All backend JavaScript files passed `node --check`, and a static check found no missing relative imports. A complete frontend build, server test run, and Arduino board compile were not completed in this environment; run those checks locally after `npm install` and compile/upload from Arduino IDE before relying on the system.
