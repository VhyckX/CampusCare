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

Book an appointment from the Appointment page, copy the generated appointment ID, then use it with the booking email on the Status page to view backend appointment details. Older browser-saved demo appointments remain labelled separately where available. You can also filter appointment history, cancel pending appointments, delete cancelled appointments, search doctors, and switch between light and dark mode.

For local frontend-to-backend development, `js/script.js` uses this API base URL by default:

```text
http://127.0.0.1:5000/api
```

For a later deployment, define `window.CAMPUSCARE_API_BASE_URL` before loading `js/script.js`. Do not put credentials in frontend code.

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
MONGODB_DB_NAME=campuscare
DNS_SERVERS=
CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
```

Do not commit `backend/.env`. It is ignored by Git.

For normal startup without watch mode:

```powershell
cd backend
npm start
```

The backend reads `PORT`, `MONGODB_URI`, optional `MONGODB_DB_NAME`, optional `DNS_SERVERS`, and optional `CORS_ORIGINS` from `backend/.env`. `PORT` defaults to `5000`, and MongoDB uses the database name `campuscare` unless `MONGODB_DB_NAME` is set.

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

## Demo Catalog Seed

CampusCare includes a prepared seed command for the same demo services and doctors shown on the frontend. Run it only when you intentionally want to add the demo catalog to MongoDB Atlas:

```powershell
cd backend
npm run seed:catalog
```

The seed command:

- Loads `backend/.env`.
- Applies optional `DNS_SERVERS` if configured.
- Connects to MongoDB using the existing Mongoose setup.
- Inserts only missing services and doctors by their stable identifiers.
- Skips existing records so reruns do not duplicate records or overwrite edits.
- Does not create appointments, users, authentication records, or dashboards.
- Does not clear collections.

It prepares four services and eight doctors: General Consultation, Dental Care, Eye Care, Emergency Support, and their matching demo doctors from the frontend catalog.

## Book Appointment API

`POST /api/appointments` creates one appointment request. The backend validates the service, doctor, clinic hours, date/time, and patient fields before saving.

Request body:

```json
{
  "fullName": "Ada Student",
  "email": "ada.student@example.com",
  "phone": "+234 801-234-5678",
  "reason": "Routine consultation",
  "serviceIdentifier": "general-consultation",
  "doctorIdentifier": "dr-amina-bello",
  "appointmentDate": "2026-10-15",
  "appointmentTime": "09:00"
}
```

Successful response:

```json
{
  "success": true,
  "message": "Appointment booked successfully.",
  "data": {
    "appointmentRef": "CC-20260910-1234",
    "fullName": "Ada Student",
    "email": "ada.student@example.com",
    "phone": "+234 801-234-5678",
    "serviceIdentifier": "general-consultation",
    "serviceName": "General Consultation",
    "doctorIdentifier": "dr-amina-bello",
    "doctorName": "Dr. Amina Bello",
    "doctorRole": "General Practitioner",
    "doctorRoom": "Room 1",
    "appointmentDate": "2026-10-15",
    "appointmentTime": "09:00",
    "scheduledAt": "2026-10-15T08:00:00.000Z",
    "timezone": "Africa/Lagos",
    "reason": "Routine consultation",
    "status": "Pending",
    "createdAt": "2026-09-10T12:00:00.000Z",
    "updatedAt": "2026-09-10T12:00:00.000Z"
  }
}
```

The client must send Lagos clinic date/time as `appointmentDate` (`YYYY-MM-DD`) and `appointmentTime` (`HH:mm`, 24-hour format). The server derives `scheduledAt`, generates the appointment reference, and always starts the appointment as `Pending`.

Slot protection is handled by a MongoDB unique partial index on doctor and scheduled time for active appointment statuses. This blocks simultaneous bookings for the same doctor and slot while still allowing a cancelled slot to be booked again later. The booking endpoint also converts duplicate-key conflicts into a `409` response.

## Appointment Lookup API

`POST /api/appointments/lookup` checks one appointment status using the appointment reference and booking email. This is a limited guest lookup for students; it is not verified identity, staff authorization, login, or admin access.

Request body:

```json
{
  "appointmentRef": "CC-20260910-1234",
  "email": "ada.student@example.com"
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "appointmentRef": "CC-20260910-1234",
    "status": "Pending",
    "serviceName": "General Consultation",
    "doctorName": "Dr. Amina Bello",
    "doctorRole": "General Practitioner",
    "doctorRoom": "Room 1",
    "appointmentDate": "2026-10-15",
    "appointmentTime": "09:00",
    "timezone": "Africa/Lagos"
  }
}
```

Unknown references and mismatched booking emails return the same generic `404` message. Lookup responses use `Cache-Control: no-store`, return only public appointment status fields, and do not expose patient name, email, phone, reason, or internal database fields. Lookup attempts are rate-limited in memory to reduce repeated guessing.

## Appointment Cancellation API

`POST /api/appointments/cancel` cancels one guest appointment using the same appointment reference and booking email. This is still limited guest access, not verified identity, staff authorization, login, or permission to make other status changes.

Request body:

```json
{
  "appointmentRef": "CC-20260910-1234",
  "email": "ada.student@example.com"
}
```

Successful response:

```json
{
  "success": true,
  "message": "Appointment cancelled successfully.",
  "data": {
    "appointmentRef": "CC-20260910-1234",
    "status": "Cancelled",
    "serviceName": "General Consultation",
    "doctorName": "Dr. Amina Bello",
    "doctorRole": "General Practitioner",
    "doctorRoom": "Room 1",
    "appointmentDate": "2026-10-15",
    "appointmentTime": "09:00",
    "timezone": "Africa/Lagos"
  }
}
```

Cancellation is allowed only for future `Pending` or `Confirmed` appointments. Already-cancelled appointments return a successful `Cancelled` response so repeated clicks are safe. Completed appointments and past active appointments return `409`. Unknown references and mismatched booking emails return the same generic `404`. Responses use `Cache-Control: no-store`, return only the same limited public fields as lookup, and attempts are rate-limited in memory.

The cancellation update is atomic: MongoDB only changes the status when the same record still matches the reference, booking email, future scheduled time, and cancellable status. The existing partial unique slot index only protects `Pending` and `Confirmed` appointments, so setting a record to `Cancelled` releases that doctor/time slot for reuse.

### Latest Lookup Test Results

The lookup flow was tested with fictional fixtures in `campuscare_test` on separate local test ports:

- Real browser lookup returned HTTP `200`: Passed
- Stored Pending status displayed unchanged: Passed
- Wrong email returned generic `404`: Passed
- Unknown reference returned the same generic `404`: Passed
- Invalid lookup input returned `400`: Passed
- Rate limiting returned `429`: Passed
- Past Pending and past Confirmed statuses stayed unchanged: Passed
- Unavailable API showed a network error and preserved inputs: Passed
- Test fixtures were cleaned up: Passed

### Latest Cancellation Test Results

The cancellation API was tested with fictional fixtures in `campuscare_test` on separate local test ports:

- Database assertion before writes: Passed
- Partial unique slot index exists for active statuses only: Passed
- Future Pending cancellation returned `200` and persisted `Cancelled`: Passed
- Repeated cancellation returned idempotent `200`: Passed
- Wrong email and unknown reference returned generic `404`: Passed
- Completed and past active appointments returned `409`: Passed
- Concurrent state-change protection preserved the newer stored status: Passed
- Cancelled slot reuse returned `201`: Passed
- Cancel rate limiting returned `429`: Passed

Frontend cancellation behavior was also checked in the browser with a mocked local API:

- Dismissing the confirmation sent no cancel request, left status as `Pending`, and kept the button enabled: Passed
- API failure kept the displayed result as `Pending`, showed an error, and kept the button enabled: Passed

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
- `backend/server.js` - Loads `backend/.env`, applies optional DNS settings, connects to MongoDB, reads `PORT` and optional `MONGODB_DB_NAME`, starts the server, and handles shutdown.
- `backend/config/db.js` - Connects to MongoDB Atlas using Mongoose and closes the database connection during shutdown.
- `backend/config/dns.js` - Reads optional comma-separated DNS server IP addresses and applies them before the database connection.
- `backend/models/service.model.js` - Defines clinic services using a stable service identifier, display name, and structured opening-days/hours rules.
- `backend/models/doctor.model.js` - Defines doctors with a stable doctor identifier, role, room, availability flag, and service reference.
- `backend/models/appointment.model.js` - Defines appointment records with a unique appointment reference, patient contact details, service/doctor references, Lagos clinic date/time, status, and timestamps.
- `backend/seed/catalog.seed.js` - Prepares the demo service/doctor catalog seed command without creating appointments or users.
- `backend/routes/catalog.routes.js` and `backend/controllers/catalog.controller.js` - Provide read-only services/doctors catalog APIs.
- `backend/routes/appointment.routes.js` and `backend/controllers/appointment.controller.js` - Create bookings, look up appointment status, and cancel eligible guest appointments through the backend API.
- `backend/routes/health.routes.js` - Defines the `/api/health` route.
- `backend/controllers/health.controller.js` - Sends the health-check JSON response.
- `backend/.env.example` - Shows the required environment variable format.

## Backend Date/Time Convention

CampusCare appointment forms use the Nigerian clinic's local calendar date and time. Backend appointments keep:

- `appointmentDate` as `YYYY-MM-DD` in `Africa/Lagos`.
- `appointmentTime` as `HH:mm` in 24-hour `Africa/Lagos` clinic time.
- `scheduledAt` as the matching UTC `Date` value for database sorting and future API queries.

Appointment status is stored separately and must not be changed automatically just because `scheduledAt` is in the past.

No login system, CDN Bootstrap, frontend framework, staff status updates, dashboard backend, or PDF slip generation is included yet.
