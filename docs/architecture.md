# MediMate Smart Medicine Box — Architecture Specification

## 1. System Overview

MediMate connects an IoT smart medicine box (ESP32), a cloud backend (Node.js/Express/MongoDB), and a caregiver web application (React/Tailwind) into a synchronized healthcare system.

```
+-------------------------------------------------------------+
|                      PHYSICAL SMART BOX                     |
|                                                             |
|   +-------------------+              +------------------+   |
|   | 3x Reed Switches  |              | DS3231 RTC Clock |   |
|   +---------+---------+              +--------+---------+   |
|             |                                 |             |
|             +--------------> ESP32 <----------+             |
|                                |                            |
|             +------------------+------------------+         |
|             |                                     |         |
|   +---------v---------+                 +---------v-----+   |
|   | 0.96" OLED Screen |                 | Audio Speaker |   |
|   +-------------------+                 +---------------+   |
+-------------------------------------------------------------+
                                |
                   HTTPS REST (Auth: Token)
                                |
+-------------------------------v-----------------------------+
|                      CLOUD BACKEND API                      |
|                                                             |
|   +-----------------------------------------------------+   |
|   | Express REST Controllers & Device Auth Middleware   |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|   +--------------------------v--------------------------+   |
|   | Event Processor & Deduplication Engine (UUID check) |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|   +--------------------------v--------------------------+   |
|   | Missed-Dose Cron Scheduler (Idempotent 1-min loop)  |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|   +--------------------------+--------------------------+   |
|   | Multilingual Gemini AI Report Analysis Pipeline     |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|   +--------------------------+--------------------------+   |
|   | Notification Dispatcher (Twilio SMS / Web Push)     |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|   +--------------------------v--------------------------+   |
|   | Socket.IO Real-Time Server                          |   |
|   +-----------------------------------------------------+   |
|                              |                              |
|                      MongoDB Atlas DB                       |
+-------------------------------------------------------------+
                                ^
                                | WebSocket & HTTPS
+-------------------------------+-----------------------------+
|                   CAREGIVER WEB APPLICATION                 |
|                                                             |
|   +-------------------+   +-----------------------------+   |
|   | Live Dashboard    |   | 3 Compartment Status Cards  |   |
|   +-------------------+   +-----------------------------+   |
|   | Medicine Schedule |   | Multilingual AI Reports     |   |
|   +-------------------+   +-----------------------------+   |
|   | Device Pairing    |   | Caregiver Profile & Patient |   |
|   +-------------------+   +-----------------------------+   |
+-------------------------------------------------------------+
```

---

## 2. Core Subsystems

### A. 3-Compartment Allocation Rule
- Exactly 3 physical compartments exist.
- Concurrency-safe unique compound index in MongoDB: `{ deviceId: 1, compartment: 1 }` where `{ isActive: true }`.
- When adding a medicine, only vacant compartments are selectable.
- Deactivating a medicine frees its compartment while preserving all historical dose logs.

### B. Autonomous Local Reminder Engine (DS3231 RTC)
- DS3231 RTC maintains accurate local time on the ESP32.
- Reminders trigger locally even if the home Wi-Fi is disconnected.
- If a lid transition occurs offline, the event is stamped with the RTC timestamp and queued in local buffer.
- On Wi-Fi reconnection, events are uploaded in batch. The cloud backend reconciles the dose instance based on original device timestamp.

### C. Missed-Dose Processing & Idempotency
- DoseInstance unique index: `{ medicineId: 1, date: 1 }`.
- Background scheduler checks for expired deadlines every minute.
- Evaluates: `deadlineUtc <= now` and `status !== 'accessed'` and `missedDoseProcessed == false`.
- Sends SMS and Browser Push notifications; sets `missedDoseProcessed = true`.
- Idempotency ensures repeated scheduler runs never dispatch duplicate alerts.

### D. Multilingual Gemini Medical Report Engine
- Caregiver can upload laboratory test reports (PDF, JPG, PNG).
- Caregiver private Gemini key is encrypted using AES-256-GCM.
- Formats structured 6-section breakdown in requested language (English, Tamil, Telugu, Hindi, Kannada, Malayalam, etc.).
- Never provides definitive clinical diagnoses or modifies medications; mandatory clinical disclaimer included.
