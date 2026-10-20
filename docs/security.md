# MediMate Security & Privacy Architecture

Healthcare and IoT applications require stringent security standards. This document outlines the protection mechanisms built into MediMate.

---

## 1. Authentication & Session Management
- **Passwords**: Salted and hashed using `bcrypt` (10 rounds). Plaintext passwords are never logged, stored, or returned.
- **JWT**: Caregiver requests use signed JSON Web Tokens (`HS256`) with configurable expiration (`7d`).
- **Account Isolation**: Every protected route filters data strictly by `req.user._id` and `req.patient._id`. Modifying route parameters cannot access another patient's data.

---

## 2. IoT Hardware Authentication
- The ESP32 does **not** share user JWT credentials.
- Devices communicate via a unique `X-Device-Id` and a secret device token (`deviceTokenHash` verified via bcrypt).
- Only paired devices can upload events or sync schedules.
- If a hardware box is lost or replaced, credentials can be revoked immediately from the Caregiver Web Portal.

---

## 3. Gemini API Key Security
- Users can provide their own Google Gemini API key in Settings.
- **Encryption**: Keys are encrypted server-side using **AES-256-GCM** before being written to MongoDB (`select: false`).
- **Zero Frontend Exposure**: Keys are never sent to the browser or stored in `localStorage`.
- **Masking**: The frontend only sees masked indicators (`AIza••••••••1234`).
- **Sanitized Logging**: API keys and medical report contents are never logged to console or files.

---

## 4. Medical Report Privacy
- Uploaded medical files are saved in private server directories (`/uploads`) outside public asset folders.
- Files are named using random UUIDs to prevent directory traversal and filename sniffing.
- Deleting a report unlinks the file from disk and deletes all associated AI analyses permanently.

---

## 5. Network Security & Rate Limiting
- `helmet` middleware configures secure HTTP response headers.
- `express-rate-limit` prevents brute-force login and registration attacks.
- CORS is configured to allow only verified client origins in production.
