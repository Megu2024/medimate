# MediMate Smart Medicine Box

> **An integrated IoT, Cloud, and Multilingual AI Medicine Management System for Caregivers.**

MediMate enables caregivers to remotely monitor a three-compartment physical medicine box for elderly family members. The system combines ESP32 microcontroller hardware, real-time cloud APIs, an autonomous RTC schedule engine, SMS/Push alerts, and Google Gemini AI medical report analysis.

---

## 🌟 Key Features

- **Physical 3-Compartment Smart Box**:
  - Three reed sensors detect lid-open/closed transitions with debouncing.
  - DS3231 RTC provides local reminders; a 0.96-inch OLED runs on a separate I²C bus from the RTC.
  - MAX98357A I²S amplifier plays 15 compressed prerecorded English voice prompts stored in firmware flash (no SD card or PSRAM).
  - Offline events are buffered in RAM and synchronized when Wi-Fi returns (the RAM queue does not survive power loss).
- **Strict 3-Compartment Allocation**:
  - Dynamically offers only available compartments (1, 2, or 3) during medicine scheduling.
  - Enforces database and server-level concurrency locks preventing duplicate active assignments.
- **Real-Time Caregiver Dashboard**:
  - Live visual status cards: **Green** (taken), **Amber** (due/pending), **Red** (missed), **Orange** (wrong compartment warning), and **Grey** (unassigned).
  - WebSockets (Socket.IO) push live updates to the caregiver's browser instantly when lids open.
- **Automated Patient Age Calculation**:
  - Derived dynamically from Date of Birth.
- **Missed-Dose Processing & Alerts**:
  - Server-side cron scheduler evaluates deadlines.
  - Dispatches SMS (Twilio gateway with fallback logging) and Browser Web Push notifications if deadline passes without access.
- **Multilingual Medical Report Analysis (Google Gemini AI)**:
  - Upload PDF, PNG, or JPG laboratory test reports.
  - Generates clear layman explanations across 9 languages (English, Tamil, Telugu, Hindi, Kannada, Malayalam, Bengali, Marathi, Gujarati).
  - Structured 6-section medical breakdown with clinical guidance and questions for doctors.
  - Encrypted AES-256-GCM private Gemini API key storage.

---

## 📁 Repository Structure

```
ES-Project/
├── client/                     # Vite + React + Tailwind CSS Web Application
│   ├── public/
│   │   └── sw.js              # Web Push Service Worker
│   ├── src/
│   │   ├── components/        # CompartmentCard, StatusBadge, MedicineModal, etc.
│   │   ├── context/           # AuthContext, SocketContext
│   │   ├── pages/             # Dashboard, Medicines, History, Reports, Settings, Profile
│   │   ├── services/          # api.js
│   │   └── App.jsx
│   └── package.json
├── server/                     # Node.js + Express + Mongoose Backend API & IoT Hub
│   ├── src/
│   │   ├── config/            # Database & environment configuration
│   │   ├── controllers/       # Auth, Patient, Medicine, DeviceApi, Reports, Settings
│   │   ├── models/            # Mongoose Schemas (User, Patient, Device, Medicine, Doses)
│   │   ├── routes/            # REST API endpoints
│   │   ├── services/          # Event processor, Scheduler, Notifications, Gemini AI
│   │   └── server.js
│   ├── tests/                 # Vitest automated integration test suite
│   └── package.json
├── firmware/
│   └── medimate_esp32/
│       ├── medimate_esp32.ino # Production C++ ESP32 firmware
│       ├── config.h           # Wi-Fi, Pins, and Cloud Token configuration
│       └── README.md          # Hardware BOM and Flashing manual
├── docs/                       # Technical Documentation
│   ├── architecture.md        # System architecture and state machine
│   ├── api.md                 # Complete REST API reference
│   ├── esp32_integration.md   # Wiring and audio integration guide
│   ├── deployment.md          # Cloud deployment guide (Atlas, Render, Vercel)
│   └── security.md            # Security, AES encryption, and privacy rules
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ or v24+)
- MongoDB (Local service or MongoDB Atlas URI)

### 1. Backend Setup
```bash
cd server
npm install
# Copy .env.example to .env and configure your variables
cp ../.env.example .env
npm run dev
```
The server will start at `http://localhost:5000` with MongoDB connected.

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Automated Tests
```bash
cd server
npm test
```
All 16 unit and integration tests will execute against an isolated test database.

---

## 🔌 ESP32 Hardware Quick Start

1. Open `firmware/medimate_esp32/medimate_esp32.ino` in Arduino IDE.
2. In `config.h`, set your Wi-Fi SSID and Password.
3. In the Web Portal, go to **Device & ESP32** -> Click **Generate ESP32 Token**.
4. Copy `DEVICE_ID` and `DEVICE_TOKEN` into `config.h`.
5. Confirm the wiring in [`docs/esp32_integration.md`](docs/esp32_integration.md), then flash to your ESP32 board.
6. Open Serial Monitor at 115200 baud and check that the backend acknowledges the heartbeat and returns active schedules.

---

## 🛡️ License

MediMate is developed for healthcare monitoring and caregiver support.


## Integrated build notes

**Start with [`START_HERE.md`](START_HERE.md)** for the exact backend, website, and ESP32 setup order.


See [`INTEGRATION_NOTES.md`](INTEGRATION_NOTES.md) for what changed in the supplied integrated package. The source ZIP intentionally omits `.env`, `node_modules`, and build output. Recreate `server/.env` from `.env.example` and configure your own credentials.
