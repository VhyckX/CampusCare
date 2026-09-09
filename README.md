# CampusCare

CampusCare is a student clinic appointment project built for a SIWES presentation. The frontend demonstrates a clean healthcare website using HTML5, CSS3, local Bootstrap 5 files, vanilla JavaScript, and browser localStorage. Phase 1 of the backend adds a small Node.js/Express API foundation connected to MongoDB Atlas through Mongoose.

## Pages

- `index.html` - Home page with hero section, statistics, service preview, how it works, and contact section.
- `services.html` - Clinic service cards, opening hours, doctor cards, doctor search, and availability filters.
- `appointment.html` - Appointment booking form with validation, doctor selection, local history filters, generated appointment ID, cancellation, cancelled appointment deletion, and appointment slip download.
- `status.html` - Appointment status tracking using the generated appointment ID saved in the browser.

## Technologies Used

### Frontend

- HTML5
- CSS3
- Bootstrap 5 local files from `css/bootstrap.min.css` and `js/bootstrap.min.js`
- Vanilla JavaScript in `js/script.js`
- Browser `localStorage` for appointment records and theme preference

### Backend

- Node.js
- Express
- dotenv
- Mongoose
- MongoDB Atlas connection
- ES modules

## Frontend Preview

Open `index.html` directly in a browser, or start a simple local preview server from the project root:

```powershell
python -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500/index.html
```

Book an appointment from the Appointment page, copy the generated appointment ID, then use it on the Status page to view the saved appointment details. You can also filter appointment history, cancel pending appointments, delete cancelled appointments, search doctors, and switch between light and dark mode.

## Backend Setup

Run these commands from the project root on Windows:

```powershell
cd backend
npm install
Copy-Item .env.example .env
notepad .env
npm run dev
```

Inside `backend/.env`, set your real MongoDB Atlas connection string:

```text
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
DNS_SERVERS=
```

Do not commit `backend/.env`. It is ignored by Git.

For normal startup without watch mode:

```powershell
cd backend
npm start
```

The backend reads `PORT`, `MONGODB_URI`, and optional `DNS_SERVERS` from `backend/.env`. `PORT` defaults to `5000`, and MongoDB uses the database name `campuscare`.

Check the health endpoint in a second terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "CampusCare API is running"
}
```

This health endpoint only confirms that the Express server is running. The server connects to MongoDB before it starts listening, but this endpoint does not create, read, update, or delete database records.

## MongoDB Atlas Notes

- Use a MongoDB Atlas URI in `MONGODB_URI`.
- If your Atlas username or password contains special characters like `@`, `#`, `%`, `/`, `?`, `:`, or spaces, percent-encode them in the URI.
- Example: `@` becomes `%40`.
- Do not change your password just for the project. Encode the special characters in the URI instead.
- If startup fails, check that `MONGODB_URI` exists in `backend/.env`, the Atlas username/password are correct, your IP address is allowed in Atlas Network Access, and the database user has permission to connect.

## Optional DNS Troubleshooting

On some local networks, the system DNS resolver may fail to resolve MongoDB Atlas SRV records. If that happens, you can privately add DNS server IP addresses to `backend/.env`:

```text
DNS_SERVERS=your_dns_server_ip
```

For multiple DNS servers, separate them with commas:

```text
DNS_SERVERS=your_first_dns_ip,your_second_dns_ip
```

Only use this as a local troubleshooting setting. A DNS server address provided by your network may change when you move to another Wi-Fi, hotspot, router, or campus network. Do not hardcode DNS addresses in the application code.

## Backend Files

- `backend/package.json` - Defines the backend project, ES module mode, dependencies, and start/dev scripts.
- `backend/package-lock.json` - Locks installed backend dependency versions after `npm install`.
- `backend/app.js` - Creates the Express app, enables JSON parsing, mounts routes, and handles 404/errors.
- `backend/server.js` - Loads `backend/.env`, applies optional DNS settings, connects to MongoDB, reads `PORT`, starts the server, and handles shutdown.
- `backend/config/db.js` - Connects to MongoDB Atlas using Mongoose and closes the database connection during shutdown.
- `backend/config/dns.js` - Reads optional comma-separated DNS server IP addresses and applies them before the database connection.
- `backend/routes/health.routes.js` - Defines the `/api/health` route.
- `backend/controllers/health.controller.js` - Sends the health-check JSON response.
- `backend/.env.example` - Shows the required environment variable format.

No login system, CDN Bootstrap, frontend framework, CORS, appointment API, models, database records, or dashboard backend is included yet.
