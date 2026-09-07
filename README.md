# CampusCare

CampusCare is a student clinic appointment frontend project built for a SIWES presentation. It demonstrates a clean healthcare website using HTML5, CSS3, local Bootstrap 5 files, vanilla JavaScript, and browser localStorage.

## Pages

- `index.html` - Home page with hero section, statistics, service preview, how it works, and contact section.
- `services.html` - Clinic service cards, opening hours, doctor cards, doctor search, and availability filters.
- `appointment.html` - Appointment booking form with validation, doctor selection, local history filters, generated appointment ID, cancellation, cancelled appointment deletion, and appointment slip download.
- `status.html` - Appointment status tracking using the generated appointment ID saved in the browser.

## Technologies Used

- HTML5
- CSS3
- Bootstrap 5 local files from `css/bootstrap.min.css` and `js/bootstrap.min.js`
- Vanilla JavaScript in `js/script.js`
- Browser `localStorage` for appointment records and theme preference

## How to Use

Open `index.html` in a browser. Book an appointment from the Appointment page, copy the generated appointment ID, then use it on the Status page to view the saved appointment details. You can also filter appointment history, cancel pending appointments, delete cancelled appointments, search doctors, and switch between light and dark mode.

No login system, backend, database, CDN Bootstrap, framework, or external API is required.
