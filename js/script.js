const STORAGE_KEY = "campusCareAppointments";
let latestAppointmentSlip = null;

function getAppointments() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveAppointments(appointments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

function generateAppointmentId() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return "CC-" + datePart + "-" + randomPart;
}

function setMinimumAppointmentDate() {
  const dateInput = document.getElementById("appointmentDate");
  if (dateInput) {
    dateInput.min = new Date().toISOString().slice(0, 10);
  }
}

function showAlert(target, type, message) {
  target.innerHTML = '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' + message + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>';
}

function formatDate(dateValue) {
  const date = new Date(dateValue + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(timeValue) {
  const date = new Date("2026-01-01T" + timeValue);
  if (Number.isNaN(date.getTime())) return timeValue;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function renderAppointmentSlip(appointment) {
  return '<article class="appointment-slip" id="appointmentSlip">' +
    '<div class="slip-header">' +
    '<div><span class="section-kicker mb-1">Appointment Slip</span><h2>CampusCare Clinic Receipt</h2><p>Present this slip when you visit the campus clinic.</p></div>' +
    '<span class="badge rounded-pill badge-status">' + appointment.status + '</span>' +
    '</div>' +
    '<div class="slip-code"><span>Appointment Number</span><strong>' + appointment.id + '</strong></div>' +
    '<dl class="slip-details">' +
    '<dt>Full Name</dt><dd>' + appointment.fullName + '</dd>' +
    '<dt>Email</dt><dd>' + appointment.email + '</dd>' +
    '<dt>Phone Number</dt><dd>' + appointment.phone + '</dd>' +
    '<dt>Department</dt><dd>' + appointment.department + '</dd>' +
    '<dt>Appointment Date</dt><dd>' + formatDate(appointment.appointmentDate) + '</dd>' +
    '<dt>Appointment Time</dt><dd>' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Status</dt><dd>' + appointment.status + '</dd>' +
    '</dl>' +
    '<div class="slip-actions">' +
    '<button type="button" class="btn btn-primary" id="downloadSlipBtn">Download Appointment Slip</button>' +
    '</div>' +
    '</article>';
}


function appointmentSlipHtml(appointment) {
  return '<!doctype html>' +
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>CampusCare Appointment Slip</title>' +
    '<style>' +
    'body{margin:0;background:#f8fafc;color:#1f2937;font-family:Arial,sans-serif;line-height:1.6;padding:32px}' +
    '.slip{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);max-width:760px;margin:auto;overflow:hidden;padding:28px}' +
    '.top{border-bottom:1px dashed #cbd5e1;display:flex;justify-content:space-between;gap:20px;padding-bottom:18px}' +
    'h1{color:#0057b8;font-size:28px;margin:0 0 6px}.muted{color:#64748b;margin:0}.badge{background:rgba(0,169,157,.15);border-radius:999px;color:#007b73;font-weight:700;height:max-content;padding:8px 14px}' +
    '.code{background:linear-gradient(135deg,rgba(0,87,184,.1),rgba(0,169,157,.12));border-radius:14px;margin:22px 0;padding:16px}.code span{color:#64748b;display:block;font-weight:700}.code strong{color:#0057b8;display:block;font-size:24px;letter-spacing:.04em}' +
    'dl{display:grid;gap:12px 18px;grid-template-columns:190px 1fr;margin:0}dt{color:#64748b;font-weight:700}dd{font-weight:700;margin:0}.footer{border-top:1px dashed #cbd5e1;color:#64748b;margin-top:22px;padding-top:16px}' +
    '@media(max-width:600px){body{padding:16px}.top{display:block}.badge{display:inline-block;margin-top:12px}dl{grid-template-columns:1fr}}' +
    '</style></head><body>' +
    '<article class="slip"><div class="top"><div><h1>CampusCare Appointment Slip</h1><p class="muted">Present this slip when you visit the campus clinic.</p></div><span class="badge">' + appointment.status + '</span></div>' +
    '<div class="code"><span>Appointment Number</span><strong>' + appointment.id + '</strong></div>' +
    '<dl>' +
    '<dt>Full Name</dt><dd>' + appointment.fullName + '</dd>' +
    '<dt>Email</dt><dd>' + appointment.email + '</dd>' +
    '<dt>Phone Number</dt><dd>' + appointment.phone + '</dd>' +
    '<dt>Department</dt><dd>' + appointment.department + '</dd>' +
    '<dt>Appointment Date</dt><dd>' + formatDate(appointment.appointmentDate) + '</dd>' +
    '<dt>Appointment Time</dt><dd>' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Status</dt><dd>' + appointment.status + '</dd>' +
    '</dl><p class="footer">Generated by CampusCare Student Clinic Appointment System.</p></article>' +
    '</body></html>';
}

function downloadAppointmentSlip() {
  if (!latestAppointmentSlip) return;
  const blob = new Blob([appointmentSlipHtml(latestAppointmentSlip)], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = latestAppointmentSlip.id + "-appointment-slip.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function setupSlipActions() {
  const downloadButton = document.getElementById("downloadSlipBtn");

  if (downloadButton) {
    downloadButton.addEventListener("click", downloadAppointmentSlip);
  }
}

function setupAppointmentForm() {
  const form = document.getElementById("appointmentForm");
  const alertBox = document.getElementById("formAlert");
  const slipArea = document.getElementById("appointmentSlipArea");
  if (!form || !alertBox) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      if (slipArea) slipArea.innerHTML = "";
      showAlert(alertBox, "warning", "Please complete all required fields before submitting.");
      return;
    }

    const formData = new FormData(form);
    const appointmentId = generateAppointmentId();
    const appointment = {
      id: appointmentId,
      fullName: formData.get("fullName").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
      department: formData.get("department"),
      appointmentDate: formData.get("appointmentDate"),
      appointmentTime: formData.get("appointmentTime"),
      reason: formData.get("reason").trim(),
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    const appointments = getAppointments();
    appointments.push(appointment);
    saveAppointments(appointments);
    latestAppointmentSlip = appointment;

    form.reset();
    form.classList.remove("was-validated");
    showAlert(alertBox, "success", "<strong>✓ Appointment booked successfully!</strong><br>Your Appointment ID: <strong>" + appointmentId + "</strong><br>Please save this ID. You will need it to check your appointment status later.");

    if (slipArea) {
      slipArea.innerHTML = renderAppointmentSlip(appointment);
      setupSlipActions();
      slipArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function renderAppointment(appointment) {
  return '<article class="appointment-summary"><div class="d-flex flex-column flex-sm-row justify-content-between gap-3 mb-4"><div><span class="section-kicker mb-1">Appointment found</span><h2 class="mb-0">' + appointment.fullName + '</h2></div><span class="badge rounded-pill badge-status align-self-start">' + appointment.status + '</span></div><dl><dt>Appointment ID</dt><dd>' + appointment.id + '</dd><dt>Patient Name</dt><dd>' + appointment.fullName + '</dd><dt>Clinic Department</dt><dd>' + appointment.department + '</dd><dt>Appointment Date</dt><dd>' + formatDate(appointment.appointmentDate) + '</dd><dt>Appointment Time</dt><dd>' + formatTime(appointment.appointmentTime) + '</dd><dt>Reason</dt><dd>' + appointment.reason + '</dd></dl></article>';
}

function setupStatusSearch() {
  const form = document.getElementById("statusForm");
  const input = document.getElementById("appointmentId");
  const result = document.getElementById("statusResult");
  if (!form || !input || !result) return;

  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("id");
  if (appointmentId) {
    input.value = appointmentId;
    setTimeout(function () { form.requestSubmit(); }, 0);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const searchId = input.value.trim().toUpperCase();
    const appointment = getAppointments().find(function (item) {
      return item.id.toUpperCase() === searchId;
    });

    if (!appointment) {
      result.innerHTML = '<div class="empty-state"><h2>No appointment found.</h2><p class="mb-0">Please check the appointment ID and try again. If you have not booked yet, create a new appointment first.</p></div>';
      return;
    }

    form.classList.remove("was-validated");
    result.innerHTML = renderAppointment(appointment);
  });
}


function applySavedTheme() {
  const savedTheme = localStorage.getItem("campusCareTheme");
  const useDarkMode = savedTheme === "dark";
  document.body.classList.toggle("dark-mode", useDarkMode);
  updateThemeToggle(useDarkMode);
}

function updateThemeToggle(useDarkMode) {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;

  const themeIcon = themeToggle.querySelector(".theme-icon");
  themeToggle.setAttribute("aria-label", useDarkMode ? "Switch to light mode" : "Switch to dark mode");
  themeToggle.setAttribute("title", useDarkMode ? "Switch to light mode" : "Switch to dark mode");

  if (themeIcon) {
    themeIcon.textContent = useDarkMode ? "☀" : "🌙";
  }
}

function setupThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;

  themeToggle.addEventListener("click", function () {
    const useDarkMode = !document.body.classList.contains("dark-mode");
    document.body.classList.toggle("dark-mode", useDarkMode);
    localStorage.setItem("campusCareTheme", useDarkMode ? "dark" : "light");
    updateThemeToggle(useDarkMode);
  });
}
document.addEventListener("DOMContentLoaded", function () {
  applySavedTheme();
  setupThemeToggle();
  setMinimumAppointmentDate();
  setupAppointmentForm();
  setupStatusSearch();
});







