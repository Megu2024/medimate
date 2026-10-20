# MediMate Smart Medicine Box — Cloud Deployment Guide

This guide explains how to deploy MediMate to production cloud infrastructure so the caregiver's phone and home ESP32 box can communicate over the internet from anywhere in the world.

---

## 1. MongoDB Atlas Setup

1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a Free or Shared Cluster (M0 tier is sufficient).
3. **Database Access**: Create a dedicated database user (e.g. `medimate_app`) with read/write privileges.
4. **Network Access**: Add IP Access entries:
   - For cloud providers with dynamic IPs (like Render or Railway), add `0.0.0.0/0` with secure password authentication.
5. **Connection String**: Under *Database* -> *Connect* -> *Drivers*, copy the URI:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/medimate?retryWrites=true&w=majority
   ```

---

## 2. Backend Deployment (e.g., Render / Railway)

1. Connect your repository to **Render** as a **Web Service**.
2. Root Directory: `server`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. **Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://user:pass@cluster0.mongodb.net/medimate?retryWrites=true&w=majority
   JWT_SECRET=generate_a_minimum_32_char_secure_random_string
   JWT_EXPIRES_IN=7d
   ENCRYPTION_KEY=your_64_char_hex_key_for_aes256
   CLIENT_URL=https://your-medimate-app.vercel.app
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE_MB=10
   # Optional: Twilio credentials for live SMS
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=
   ```
6. The deployed backend will receive a public HTTPS URL (e.g., `https://medimate-backend.onrender.com`).

---

## 3. Frontend Deployment (e.g., Vercel / Netlify)

1. Connect repository to **Vercel**.
2. Root Directory: `client`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Configure `vite.config.js` or proxy redirect: In production, client API calls point to your public backend URL.
6. The client is now accessible securely over HTTPS on mobile phones, tablets, and desktop browsers.

---

## 4. Connecting the ESP32 to the Deployed Backend

In `firmware/medimate_esp32/config.h`:
```cpp
#define BACKEND_BASE_URL "https://medimate-backend.onrender.com"
#define DEVICE_ID        "MEDIMATE-XXXX"
#define DEVICE_TOKEN     "YOUR_GENERATED_DEVICE_TOKEN"
```
Once flashed, the ESP32 communicates securely with your cloud backend via HTTPS from home, while you monitor doses from your office or anywhere else.
