# MediMate integrated build notes

## What's integrated

- ESP32 firmware now uses the tested GPIOs: reeds C1/C2/C3 on 25/26/27, RTC on I²C 21/22, OLED on separate I²C 18/19, and MAX98357A I²S on 32/33/23.
- Replaced placeholder `tone()` calls on a status LED with the 15 prerecorded voice prompts using the same IMA ADPCM playback path from the working prompt test.
- Corrected reed-switch debounce so noisy transitions are debounced without resetting the timer every loop.
- The device speaks reminders, the correct C1/C2/C3 prompt, the correct wrong-compartment warning for all six due/open combinations, and the compartment-close acknowledgement.
- Device requests use the project's existing `/api/device-api/...` Express routes, device ID header, and hashed-token verification.
- Schedule sync includes start date, optional end date, and selected days of week; the firmware preserves the local completion flag across a config refresh.
- Website API base URL and Socket.IO target can be configured for separate frontend/backend hosting with Vite environment variables.
- Website wiring reference is aligned to the verified hardware.
- Closed-lid events are labelled separately from medication access events.

## Before powering the device

1. Configure `firmware/medimate_esp32/config.h`; no real Wi-Fi credentials or device secret are included in this source package.
2. Generate the real device token in the signed-in website and copy it into the local config file.
3. For local testing, set the backend URL to your computer's LAN IPv4 address, not localhost.
4. If using a deployed HTTPS API, add the trusted CA certificate to `BACKEND_ROOT_CA` before uploading.
5. Review the wiring map in `docs/esp32_integration.md` and keep the MAX98357A speaker isolated from ESP32 GND.

## Important behaviour definition

The system records compartment access only. It must not claim that a patient ingested medicine based solely on a lid reed switch.

## Source package hygiene

A `.env` file was present in the uploaded project archive. It has intentionally been excluded from the integrated source ZIP. If it contained real secrets, rotate them and keep `.env` out of source control. The source package also excludes `node_modules` and generated `dist` files; use `npm install` in each app folder to restore dependencies.
