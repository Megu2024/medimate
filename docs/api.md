# MediMate REST API Reference

Base URL: `/api`

---

## 1. Authentication Endpoints

### Register Caregiver & Patient
- **URL**: `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "fullName": "Arun Kumar",
    "email": "arun@example.com",
    "password": "Password123!",
    "passwordConfirm": "Password123!",
    "patientName": "Kalyani Amma",
    "patientDob": "1955-08-15",
    "relationship": "Mother",
    "phoneNumber": "+919876543210"
  }
  ```
- **Response** (201 Created): Returns JWT token, user record, and patient profile with auto-calculated age.

### Login
- **URL**: `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "arun@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (200 OK): Returns JWT token and profiles.

### Current User Profile
- **URL**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <jwtToken>`

---

## 2. Medicine Management

### Get Available Compartments
- **URL**: `GET /api/medicines/available-compartments`
- **Headers**: `Authorization: Bearer <jwtToken>`
- **Response**:
  ```json
  {
    "success": true,
    "allCompartments": [1, 2, 3],
    "occupiedCompartments": [1, 2],
    "availableCompartments": [3],
    "isFull": false
  }
  ```

### Add Medicine
- **URL**: `POST /api/medicines`
- **Headers**: `Authorization: Bearer <jwtToken>`
- **Request Body**:
  ```json
  {
    "name": "Sugar Tablet",
    "category": "Sugar",
    "compartment": 1,
    "scheduledTime": "08:00",
    "repeatIntervalMinutes": 5,
    "deadlineTime": "08:30",
    "notes": "Take after breakfast"
  }
  ```

### Edit Medicine
- **URL**: `PATCH /api/medicines/:id`

### Deactivate Medicine
- **URL**: `DELETE /api/medicines/:id`
- **Description**: Deactivates medicine and frees compartment while preserving past dose history.

---

## 3. Dashboard & History

### Get Dashboard
- **URL**: `GET /api/dashboard`
- **Headers**: `Authorization: Bearer <jwtToken>`
- **Response**: Patient overview, device online status, summary counts, and the 3 compartment cards with visual statuses (`green`, `amber`, `red`, `orange`, `grey`).

### Get Filtered Dose History
- **URL**: `GET /api/dashboard/history?status=missed&startDate=2026-10-01&page=1`

---

## 4. Hardware REST Endpoints (ESP32)

All hardware endpoints require:
- Header: `X-Device-Id: MEDIMATE-XXXX`
- Header: `Authorization: Bearer <deviceToken>`

### Device Heartbeat
- **URL**: `POST /api/device-api/heartbeat`
- **Request Body**:
  ```json
  {
    "firmwareVersion": "1.0.0",
    "wifiRssi": -55,
    "ipAddress": "192.168.1.150"
  }
  ```

### Fetch Device Configuration & Schedules
- **URL**: `GET /api/device-api/config`
- **Response**:
  ```json
  {
    "success": true,
    "deviceId": "MEDIMATE-1042",
    "patientName": "Kalyani Amma",
    "timezone": "Asia/Kolkata",
    "medicines": [
      {
        "id": "67b3f9...",
        "name": "Sugar Tablet",
        "category": "Sugar",
        "compartment": 1,
        "scheduledTime": "08:00",
        "repeatIntervalMinutes": 5,
        "deadlineTime": "08:30"
      }
    ]
  }
  ```

### Ingest Reed Switch Events
- **URL**: `POST /api/device-api/events`
- **Request Body**:
  ```json
  {
    "eventId": "e9b28a1c-34d1-4f12-9c98-123456789abc",
    "timestamp": "2026-10-17T08:04:12Z",
    "compartment": 1,
    "lidState": "open"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "results": [
      {
        "eventId": "e9b28a1c-34d1-4f12-9c98-123456789abc",
        "status": "accepted",
        "eventType": "normal_access",
        "feedback": {
          "audioPrompt": "You have opened Compartment 1 for your scheduled medicine...",
          "oledSymbol": "CHECK",
          "oledText": "Comp 1 Taken!"
        }
      }
    ]
  }
  ```

---

## 5. Medical Reports & Gemini AI

### Upload Medical Report
- **URL**: `POST /api/reports`
- **Body**: `multipart/form-data` with field `report` (PDF, PNG, JPG, WEBP).

### Analyze Report with Gemini
- **URL**: `POST /api/reports/:id/analyze`
- **Request Body**:
  ```json
  {
    "language": "Tamil"
  }
  ```
- **Response**: 6-section structured JSON in requested language.
