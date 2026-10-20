# Frontend / API configuration

Local development defaults to `/api` and the Vite proxy in `vite.config.js` forwards API and Socket.IO requests to `http://localhost:5000`.

For a separately hosted frontend and backend, configure these build-time variables before building:

- `VITE_API_BASE_URL=https://YOUR_BACKEND_HOST/api`
- `VITE_SOCKET_URL=https://YOUR_BACKEND_HOST`

Use the backend host origin (without `/api`) for `VITE_SOCKET_URL`. These values are public endpoint URLs, not secrets. Never put MongoDB credentials, JWT secrets, or the ESP32 device token in the frontend environment.
