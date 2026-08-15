const STORAGE_KEY = "campusCareAppointments";
const THEME_KEY = "campusCareTheme";
const USERS_KEY = "campusCareUsers";
const CURRENT_USER_KEY = "campusCareCurrentUser";
let latestAppointmentSlip = null;
let currentHistoryFilter = "all";

const clinicServices = [
  {
    id: "general-consultation",
    name: "General Consultation",
    hours: "Mon - Fri, 8:00 AM - 4:00 PM",
    doctors: [
      { id: "dr-amina-bello", name: "Dr. Amina Bello", role: "General Practitioner", room: "Room 1", available: true },
      { id: "dr-daniel-okafor", name: "Dr. Daniel Okafor", role: "Student Health Physician", room: "Room 2", available: true }
    ]
  },
  {
    id: "dental-care",
    name: "Dental Care",
    hours: "Tue - Thu, 9:00 AM - 2:00 PM",
    doctors: [
      { id: "dr-maryam-sani", name: "Dr. Maryam Sani", role: "Dental Officer", room: "Dental Suite", available: true },
      { id: "dr-peter-ade", name: "Dr. Peter Ade", role: "Oral Health Consultant", room: "Dental Suite", available: false }
    ]
  },
  {
    id: "eye-care",
    name: "Eye Care",
    hours: "Mon - Wed, 10:00 AM - 3:00 PM",
    doctors: [
      { id: "dr-ifeoma-nwosu", name: "Dr. Ifeoma Nwosu", role: "Optometrist", room: "Vision Room", available: true },
      { id: "dr-samuel-ibrahim", name: "Dr. Samuel Ibrahim", role: "Eye Care Specialist", room: "Vision Room", available: true }
    ]
  },
  {
    id: "emergency-support",
    name: "Emergency Support",
    hours: "Daily, 24/7 Support",
    doctors: [
      { id: "nurse-grace-ali", name: "Nurse Grace Ali", role: "Emergency Support Lead", room: "Emergency Desk", available: true },
      { id: "dr-victor-essien", name: "Dr. Victor Essien", role: "Urgent Care Doctor", room: "Emergency Desk", available: false }
    ]
  }
];

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char];
  });
}

function getServiceByName(name) {
  return clinicServices.find(function (service) {
    return service.name === name || service.id === name;
  }) || clinicServices[0];
}

function getDoctorById(service, doctorId) {
  return service.doctors.find(function (doctor) {
    return doctor.id === doctorId || doctor.name === doctorId;
  }) || service.doctors[0];
}

function getAllDoctors() {
  return clinicServices.flatMap(function (service) {
    return service.doctors.map(function (doctor) {
      return {
        id: doctor.id,
        name: doctor.name,
        role: doctor.role,
        room: doctor.room,
        available: doctor.available !== false,
        service: service.name,
        serviceId: service.id,
        hours: service.hours
      };
    });
  });
}

function normalizeAppointment(appointment) {
  const service = getServiceByName(appointment.service || appointment.department);
  const doctor = getDoctorById(service, appointment.doctorId || appointment.doctor);

  return {
    id: appointment.id,
    fullName: appointment.fullName || appointment.patientName || "Student Patient",
    email: appointment.email || "Not provided",
    phone: appointment.phone || "Not provided",
    service: service.name,
    serviceId: service.id,
    department: service.name,
    doctorId: doctor.id,
    doctor: doctor.name,
    doctorRole: doctor.role,
    doctorRoom: doctor.room,
    appointmentDate: appointment.appointmentDate || appointment.date || "",
    appointmentTime: appointment.appointmentTime || appointment.time || "",
    reason: appointment.reason || "Not provided",
    status: appointment.status || "Pending",
    createdAt: appointment.createdAt || new Date().toISOString(),
    updatedAt: appointment.updatedAt || appointment.createdAt || new Date().toISOString()
  };
}

function getAppointments() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  return saved.map(normalizeAppointment);
}

function saveAppointments(appointments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments.map(normalizeAppointment)));
}

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)) || null;
}

function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
    fullName: user.fullName,
    email: user.email
  }));
}

function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

function getFirstName(fullName) {
  return String(fullName || "Student").trim().split(/\s+/)[0] || "Student";
}

function generateAppointmentId() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replaceAll("-", "");
  const existingIds = getAppointments().map(function (appointment) { return appointment.id; });
  let appointmentId = "";

  do {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    appointmentId = "CC-" + datePart + "-" + randomPart;
  } while (existingIds.includes(appointmentId));

  return appointmentId;
}

function formatDate(dateValue) {
  const date = new Date(dateValue + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dateValue || "Not set";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(timeValue) {
  const date = new Date("2026-01-01T" + timeValue);
  if (Number.isNaN(date.getTime())) return timeValue || "Not set";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getAppointmentDateTime(appointment) {
  return new Date(appointment.appointmentDate + "T" + appointment.appointmentTime);
}

function getDisplayStatus(appointment) {
  if (appointment.status === "Cancelled") return "Cancelled";
  if (appointment.status === "Completed") return "Completed";

  const appointmentDateTime = getAppointmentDateTime(appointment);
  if (!Number.isNaN(appointmentDateTime.getTime()) && appointmentDateTime < new Date()) {
    return "Completed";
  }

  return appointment.status || "Pending";
}

function getStatusClass(status) {
  return "status-" + String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
}

function showAlert(target, type, message) {
  target.innerHTML = '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' + message + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>';
}

function renderAuthNav() {
  const authNav = document.getElementById("authNav");
  if (!authNav) return;

  const currentUser = getCurrentUser();
  if (currentUser) {
    hideAuthGate();
    authNav.innerHTML = '<span class="nav-welcome">Hi, ' + escapeHtml(getFirstName(currentUser.fullName)) + '</span><button class="nav-link logout-link" type="button" id="logoutBtn">Logout</button>';
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        clearCurrentUser();
        renderAuthNav();
      });
    }
    return;
  }

  authNav.innerHTML = "";
  showAuthGate();
}

function ensureAuthGate() {
  if (document.getElementById("authGate") || document.body.classList.contains("auth-page")) return;

  document.body.insertAdjacentHTML("beforeend",
    '<div class="auth-gate" id="authGate" aria-live="polite">' +
    '<div class="auth-backdrop"></div>' +
    '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">' +
    '<div class="auth-tabs" role="tablist">' +
    '<button class="auth-tab active" type="button" data-auth-panel="loginPanel">Login</button>' +
    '<button class="auth-tab" type="button" data-auth-panel="registerPanel">Register</button>' +
    '</div>' +
    '<div id="authAlert" class="mb-4" aria-live="polite"></div>' +
    '<section class="auth-panel active" id="loginPanel">' +
    '<span class="section-kicker">Welcome back</span><h2 id="authModalTitle">Login to CampusCare</h2>' +
    '<form id="loginForm" novalidate>' +
    '<div class="mb-3"><label for="loginEmail" class="form-label">Email</label><input type="email" class="form-control" id="loginEmail" autocomplete="email" required><div class="invalid-feedback">Please enter your email.</div></div>' +
    '<div class="mb-4"><label for="loginPassword" class="form-label">Password</label><input type="password" class="form-control" id="loginPassword" autocomplete="current-password" required><div class="invalid-feedback">Please enter your password.</div></div>' +
    '<button type="submit" class="btn btn-primary btn-lg w-100">Login</button>' +
    '</form>' +
    '<p class="auth-switch mb-0">New to CampusCare? <button type="button" data-auth-panel="registerPanel">Create an account</button></p>' +
    '</section>' +
    '<section class="auth-panel" id="registerPanel">' +
    '<span class="section-kicker">Create account</span><h2>Register</h2>' +
    '<form id="registerForm" novalidate>' +
    '<div class="mb-3"><label for="registerName" class="form-label">Full Name</label><input type="text" class="form-control" id="registerName" autocomplete="name" required><div class="invalid-feedback">Please enter your full name.</div></div>' +
    '<div class="mb-3"><label for="registerEmail" class="form-label">Email</label><input type="email" class="form-control" id="registerEmail" autocomplete="email" required><div class="invalid-feedback">Please enter a valid email.</div></div>' +
    '<div class="mb-3"><label for="registerPassword" class="form-label">Password</label><input type="password" class="form-control" id="registerPassword" autocomplete="new-password" minlength="6" required><div class="invalid-feedback">Password must be at least 6 characters.</div></div>' +
    '<div class="mb-4"><label for="confirmPassword" class="form-label">Confirm Password</label><input type="password" class="form-control" id="confirmPassword" autocomplete="new-password" minlength="6" required><div class="invalid-feedback">Please confirm your password.</div></div>' +
    '<button type="submit" class="btn btn-primary btn-lg w-100">Register</button>' +
    '</form>' +
    '<p class="auth-switch mb-0">Already registered? <button type="button" data-auth-panel="loginPanel">Login instead</button></p>' +
    '</section>' +
    '</div>' +
    '</div>');

  setupAuthPanelSwitching();
}

function switchAuthPanel(panelId) {
  document.querySelectorAll(".auth-panel").forEach(function (panel) {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.querySelectorAll("[data-auth-panel]").forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-auth-panel") === panelId);
  });

  const authAlert = document.getElementById("authAlert");
  if (authAlert) authAlert.innerHTML = "";
}

function setupAuthPanelSwitching() {
  document.querySelectorAll("[data-auth-panel]").forEach(function (button) {
    button.addEventListener("click", function () {
      switchAuthPanel(button.getAttribute("data-auth-panel"));
    });
  });
}

function showAuthGate() {
  ensureAuthGate();
  const authGate = document.getElementById("authGate");
  if (!authGate) return;

  setupRegisterForm();
  setupLoginForm();
  authGate.classList.add("active");
  document.body.classList.add("auth-locked");
}

function hideAuthGate() {
  const authGate = document.getElementById("authGate");
  if (authGate) {
    authGate.classList.remove("active");
  }
  document.body.classList.remove("auth-locked");
}

function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  const alertBox = document.getElementById("authAlert");
  if (!form || !alertBox) return;
  if (form.dataset.authReady === "true") return;
  form.dataset.authReady = "true";

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const fullName = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      showAlert(alertBox, "warning", "Please complete all required fields correctly.");
      return;
    }

    if (password.length < 6) {
      showAlert(alertBox, "warning", "Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertBox, "warning", "Passwords do not match.");
      return;
    }

    const users = getUsers();
    if (users.some(function (user) { return user.email.toLowerCase() === email; })) {
      showAlert(alertBox, "warning", "An account with this email already exists. Please login instead.");
      return;
    }

    users.push({ fullName: fullName, email: email, password: password });
    saveUsers(users);
    form.reset();
    form.classList.remove("was-validated");
    showAlert(alertBox, "success", "<strong>Registration successful!</strong><br>You can now proceed to login.");
    setTimeout(function () { switchAuthPanel("loginPanel"); }, 700);
  });
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  const alertBox = document.getElementById("authAlert");
  if (!form || !alertBox) return;
  if (form.dataset.authReady === "true") return;
  form.dataset.authReady = "true";

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      showAlert(alertBox, "warning", "Please enter your email and password.");
      return;
    }

    const user = getUsers().find(function (item) {
      return item.email.toLowerCase() === email && item.password === password;
    });

    if (!user) {
      showAlert(alertBox, "danger", "Login failed. Please check your details and try again.");
      return;
    }

    setCurrentUser(user);
    showAlert(alertBox, "success", "Welcome back, " + escapeHtml(getFirstName(user.fullName)) + ".");
    setTimeout(function () {
      hideAuthGate();
      renderAuthNav();
    }, 800);
  });
}

function setMinimumAppointmentDate() {
  const dateInput = document.getElementById("appointmentDate");
  if (dateInput) {
    dateInput.min = new Date().toISOString().slice(0, 10);
  }
}

function populateDoctorSelect() {
  const departmentSelect = document.getElementById("department");
  const doctorSelect = document.getElementById("doctor");
  const doctorHelper = document.getElementById("doctorHelper");
  if (!departmentSelect || !doctorSelect) return;

  const selectedService = getServiceByName(departmentSelect.value);
  doctorSelect.innerHTML = '<option value="">Select doctor</option>' + selectedService.doctors.map(function (doctor) {
    return '<option value="' + doctor.id + '">' + doctor.name + ' - ' + doctor.role + '</option>';
  }).join("");

  doctorSelect.disabled = !departmentSelect.value;
  if (doctorHelper) {
    doctorHelper.textContent = departmentSelect.value ? selectedService.hours : "Doctors are matched to the selected clinic department.";
  }
}

function setupDoctorSelection() {
  const departmentSelect = document.getElementById("department");
  if (!departmentSelect) return;

  populateDoctorSelect();
  departmentSelect.addEventListener("change", populateDoctorSelect);
}

function applyAppointmentPrefill() {
  const departmentSelect = document.getElementById("department");
  const doctorSelect = document.getElementById("doctor");
  if (!departmentSelect || !doctorSelect) return;

  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get("service");
  const doctorId = params.get("doctor");
  if (!serviceId) return;

  const service = getServiceByName(serviceId);
  departmentSelect.value = service.name;
  populateDoctorSelect();

  if (doctorId && service.doctors.some(function (doctor) { return doctor.id === doctorId; })) {
    doctorSelect.value = doctorId;
  }
}

function hasDuplicateAppointment(newAppointment) {
  return getAppointments().some(function (appointment) {
    const status = getDisplayStatus(appointment);
    return appointment.doctorId === newAppointment.doctorId &&
      appointment.appointmentDate === newAppointment.appointmentDate &&
      appointment.appointmentTime === newAppointment.appointmentTime &&
      status !== "Cancelled" &&
      status !== "Completed";
  });
}

function validateAppointmentDateTime(dateValue, timeValue, service) {
  const appointmentDateTime = new Date(dateValue + "T" + timeValue);
  if (Number.isNaN(appointmentDateTime.getTime())) {
    return "Please select a valid appointment date and time.";
  }

  if (appointmentDateTime <= new Date()) {
    return "Please choose a future appointment date and time.";
  }

  if (service && service.id !== "emergency-support") {
    const day = appointmentDateTime.getDay();
    const hour = Number(timeValue.split(":")[0]) + Number(timeValue.split(":")[1] || 0) / 60;
    const rules = {
      "general-consultation": { days: [1, 2, 3, 4, 5], start: 8, end: 16 },
      "dental-care": { days: [2, 3, 4], start: 9, end: 14 },
      "eye-care": { days: [1, 2, 3], start: 10, end: 15 }
    };
    const rule = rules[service.id];

    if (rule && (!rule.days.includes(day) || hour < rule.start || hour >= rule.end)) {
      return service.name + " appointments are available during: " + service.hours + ".";
    }
  }

  return "";
}

function renderAppointmentSlip(appointment) {
  const status = getDisplayStatus(appointment);
  return '<article class="appointment-slip" id="appointmentSlip">' +
    '<div class="slip-header">' +
    '<div><span class="section-kicker mb-1">Appointment Slip</span><h2>CampusCare Clinic Document</h2><p>Present this slip when you visit the campus clinic.</p></div>' +
    '<span class="badge rounded-pill badge-status ' + getStatusClass(status) + '">' + status + '</span>' +
    '</div>' +
    '<div class="slip-code"><span>Appointment Number</span><strong>' + escapeHtml(appointment.id) + '</strong></div>' +
    '<dl class="slip-details">' +
    '<dt>Full Name</dt><dd>' + escapeHtml(appointment.fullName) + '</dd>' +
    '<dt>Email</dt><dd>' + escapeHtml(appointment.email) + '</dd>' +
    '<dt>Phone Number</dt><dd>' + escapeHtml(appointment.phone) + '</dd>' +
    '<dt>Service</dt><dd>' + escapeHtml(appointment.service) + '</dd>' +
    '<dt>Doctor</dt><dd>' + escapeHtml(appointment.doctor) + ' <span class="text-muted">(' + escapeHtml(appointment.doctorRole) + ')</span></dd>' +
    '<dt>Date</dt><dd>' + formatDate(appointment.appointmentDate) + '</dd>' +
    '<dt>Time</dt><dd>' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Status</dt><dd>' + status + '</dd>' +
    '</dl>' +
    '<div class="slip-footer-note">CampusCare Student Clinic | Main Campus Clinic Desk | support@campuscare.local</div>' +
    '<div class="slip-actions">' +
    '<button type="button" class="btn btn-outline-primary" data-copy-id="' + escapeHtml(appointment.id) + '">Copy Appointment ID</button>' +
    '<button type="button" class="btn btn-primary" id="downloadSlipBtn">Download Appointment Slip</button>' +
    '</div>' +
    '</article>';
}

function appointmentSlipHtml(appointment) {
  const status = getDisplayStatus(appointment);
  return '<!doctype html>' +
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>CampusCare Appointment Slip</title>' +
    '<style>' +
    'body{margin:0;background:#f8fafc;color:#1f2937;font-family:Arial,sans-serif;line-height:1.6;padding:32px}' +
    '.slip{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);max-width:780px;margin:auto;overflow:hidden;padding:28px}' +
    '.top{border-bottom:1px dashed #cbd5e1;display:flex;justify-content:space-between;gap:20px;padding-bottom:18px}' +
    'h1{color:#0057b8;font-size:28px;margin:0 0 6px}.muted{color:#64748b;margin:0}.badge{background:rgba(0,169,157,.15);border-radius:999px;color:#007b73;font-weight:700;height:max-content;padding:8px 14px}' +
    '.code{background:linear-gradient(135deg,rgba(0,87,184,.1),rgba(0,169,157,.12));border-radius:14px;margin:22px 0;padding:16px}.code span{color:#64748b;display:block;font-weight:700}.code strong{color:#0057b8;display:block;font-size:24px;letter-spacing:.04em}' +
    'dl{display:grid;gap:12px 18px;grid-template-columns:190px 1fr;margin:0}dt{color:#64748b;font-weight:700}dd{font-weight:700;margin:0}.footer{border-top:1px dashed #cbd5e1;color:#64748b;margin-top:22px;padding-top:16px}' +
    '@media(max-width:600px){body{padding:16px}.top{display:block}.badge{display:inline-block;margin-top:12px}dl{grid-template-columns:1fr}}' +
    '</style></head><body>' +
    '<article class="slip"><div class="top"><div><h1>CampusCare Appointment Slip</h1><p class="muted">CampusCare Student Clinic Appointment Document</p></div><span class="badge">' + status + '</span></div>' +
    '<div class="code"><span>Appointment Number</span><strong>' + escapeHtml(appointment.id) + '</strong></div>' +
    '<dl>' +
    '<dt>Full Name</dt><dd>' + escapeHtml(appointment.fullName) + '</dd>' +
    '<dt>Email</dt><dd>' + escapeHtml(appointment.email) + '</dd>' +
    '<dt>Phone Number</dt><dd>' + escapeHtml(appointment.phone) + '</dd>' +
    '<dt>Service</dt><dd>' + escapeHtml(appointment.service) + '</dd>' +
    '<dt>Doctor</dt><dd>' + escapeHtml(appointment.doctor) + ' - ' + escapeHtml(appointment.doctorRole) + '</dd>' +
    '<dt>Date</dt><dd>' + formatDate(appointment.appointmentDate) + '</dd>' +
    '<dt>Time</dt><dd>' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Status</dt><dd>' + status + '</dd>' +
    '</dl><p class="footer">CampusCare Student Clinic | Main Campus Clinic Desk | Generated locally in your browser.</p></article>' +
    '</body></html>';
}

function downloadAppointmentSlip(appointment) {
  const slip = appointment || latestAppointmentSlip;
  if (!slip) return;
  const blob = new Blob([appointmentSlipHtml(slip)], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = slip.id + "-appointment-slip.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function copyAppointmentId(appointmentId) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(appointmentId);
  }
}

function setupSlipActions(container) {
  const area = container || document;
  const downloadButton = area.querySelector("#downloadSlipBtn");
  if (downloadButton) {
    downloadButton.addEventListener("click", function () { downloadAppointmentSlip(); });
  }

  area.querySelectorAll("[data-copy-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      copyAppointmentId(button.getAttribute("data-copy-id"));
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = "Copy Appointment ID"; }, 1600);
    });
  });
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
    const service = getServiceByName(formData.get("department"));
    const doctor = getDoctorById(service, formData.get("doctor"));
    const validationMessage = validateAppointmentDateTime(formData.get("appointmentDate"), formData.get("appointmentTime"), service);

    if (validationMessage) {
      showAlert(alertBox, "warning", validationMessage);
      return;
    }

    const appointment = normalizeAppointment({
      id: generateAppointmentId(),
      fullName: formData.get("fullName").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
      service: service.name,
      department: service.name,
      serviceId: service.id,
      doctorId: doctor.id,
      doctor: doctor.name,
      doctorRole: doctor.role,
      doctorRoom: doctor.room,
      appointmentDate: formData.get("appointmentDate"),
      appointmentTime: formData.get("appointmentTime"),
      reason: formData.get("reason").trim(),
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (hasDuplicateAppointment(appointment)) {
      showAlert(alertBox, "warning", "That doctor already has an active appointment at the selected date and time. Please choose another time or doctor.");
      return;
    }

    const appointments = getAppointments();
    appointments.push(appointment);
    saveAppointments(appointments);
    latestAppointmentSlip = appointment;

    form.reset();
    form.classList.remove("was-validated");
    populateDoctorSelect();
    showAlert(alertBox, "success", "<strong>&#10003; Appointment booked successfully!</strong><br>Your Appointment ID: <strong>" + appointment.id + "</strong><br>Please save this ID. You will need it to check your appointment status later.");

    if (slipArea) {
      slipArea.innerHTML = renderAppointmentSlip(appointment);
      setupSlipActions(slipArea);
      slipArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    renderAppointmentHistory();
  });
}

function renderStatusTracker(appointment) {
  const status = getDisplayStatus(appointment);
  return '<article class="tracking-card">' +
    '<div class="tracking-header"><div><span class="section-kicker mb-1">Appointment tracking</span><h2>' + escapeHtml(appointment.id) + '</h2><p>' + escapeHtml(appointment.service) + ' with ' + escapeHtml(appointment.doctor) + '</p></div><span class="badge rounded-pill badge-status ' + getStatusClass(status) + '">' + status + '</span></div>' +
    '<div class="tracking-progress ' + getStatusClass(status) + '"><span></span><span></span><span></span></div>' +
    '<dl class="slip-details tracking-details">' +
    '<dt>Patient</dt><dd>' + escapeHtml(appointment.fullName) + '</dd>' +
    '<dt>Email</dt><dd>' + escapeHtml(appointment.email) + '</dd>' +
    '<dt>Phone</dt><dd>' + escapeHtml(appointment.phone) + '</dd>' +
    '<dt>Service</dt><dd>' + escapeHtml(appointment.service) + '</dd>' +
    '<dt>Doctor</dt><dd>' + escapeHtml(appointment.doctor) + ' (' + escapeHtml(appointment.doctorRole) + ')</dd>' +
    '<dt>Date and Time</dt><dd>' + formatDate(appointment.appointmentDate) + ' at ' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Current Status</dt><dd>' + status + '</dd>' +
    '</dl>' +
    '<div class="slip-actions"><button type="button" class="btn btn-outline-primary" data-copy-id="' + escapeHtml(appointment.id) + '">Copy Appointment ID</button><a class="btn btn-primary" href="appointment.html">Book Another Appointment</a></div>' +
    '</article>';
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
      result.innerHTML = '<div class="empty-state"><h2>No appointment found.</h2><p class="mb-0">Please check the appointment ID and try again. Appointment records are stored locally in this browser.</p></div>';
      return;
    }

    form.classList.remove("was-validated");
    result.innerHTML = renderStatusTracker(appointment);
    setupSlipActions(result);
  });
}

function renderAppointmentCard(appointment) {
  const status = getDisplayStatus(appointment);
  const canCancel = status === "Pending" || status === "Confirmed";
  const canDelete = status === "Cancelled";
  return '<article class="history-card">' +
    '<div class="history-card-top"><div><strong>' + escapeHtml(appointment.service) + '</strong><span>' + escapeHtml(appointment.id) + '</span></div><span class="badge rounded-pill badge-status ' + getStatusClass(status) + '">' + status + '</span></div>' +
    '<p class="mb-2">' + escapeHtml(appointment.doctor) + ' - ' + formatDate(appointment.appointmentDate) + ' - ' + formatTime(appointment.appointmentTime) + '</p>' +
    '<div class="history-actions"><button class="btn btn-outline-primary btn-sm" type="button" data-copy-id="' + escapeHtml(appointment.id) + '">Copy Appointment ID</button><button class="btn btn-outline-primary btn-sm" type="button" data-download-id="' + escapeHtml(appointment.id) + '">Download Slip</button><a class="btn btn-outline-primary btn-sm" href="status.html?id=' + encodeURIComponent(appointment.id) + '">View Appointment</a>' +
    (canCancel ? '<button class="btn btn-sm btn-cancel" type="button" data-cancel-id="' + escapeHtml(appointment.id) + '">Cancel</button>' : '') +
    (canDelete ? '<button class="btn btn-sm btn-cancel" type="button" data-delete-id="' + escapeHtml(appointment.id) + '">Delete</button>' : '') + '</div>' +
    '</article>';
}

function getHistoryFilterConfig(filterName) {
  const filters = {
    all: {
      title: "All appointments",
      filter: function () { return true; }
    },
    upcoming: {
      title: "Upcoming",
      filter: function (appointment) {
        const status = getDisplayStatus(appointment);
        const appointmentDateTime = getAppointmentDateTime(appointment);
        return status !== "Completed" &&
          status !== "Cancelled" &&
          !Number.isNaN(appointmentDateTime.getTime()) &&
          appointmentDateTime >= new Date();
      }
    },
    pending: {
      title: "Pending / Awaiting confirmation",
      filter: function (appointment) { return getDisplayStatus(appointment) === "Pending"; }
    },
    active: {
      title: "Active appointments",
      filter: function (appointment) {
        const status = getDisplayStatus(appointment);
        return status === "Pending" || status === "Confirmed";
      }
    },
    completed: {
      title: "Completed",
      filter: function (appointment) { return getDisplayStatus(appointment) === "Completed"; }
    },
    cancelled: {
      title: "Cancelled",
      filter: function (appointment) { return getDisplayStatus(appointment) === "Cancelled"; }
    }
  };

  return filters[filterName] || filters.all;
}

function renderAppointmentHistory() {
  const historyArea = document.getElementById("appointmentHistory");
  if (!historyArea) return;

  const appointments = getAppointments().sort(function (a, b) {
    return getAppointmentDateTime(a) - getAppointmentDateTime(b);
  });

  if (!appointments.length) {
    historyArea.innerHTML = '<div class="empty-state text-center"><h3>No saved appointments yet.</h3><p class="mb-0">After you book an appointment, it will appear here for quick access.</p></div>';
    return;
  }

  if (currentHistoryFilter !== "all") {
    const filterConfig = getHistoryFilterConfig(currentHistoryFilter);
    const filteredAppointments = appointments.filter(filterConfig.filter);
    historyArea.innerHTML = '<section class="history-group"><div class="history-group-title"><h3>' + filterConfig.title + '</h3><span>' + filteredAppointments.length + '</span></div>' +
      (filteredAppointments.length ? '<div class="history-grid">' + filteredAppointments.map(renderAppointmentCard).join("") + '</div>' : '<div class="empty-state compact-empty">No appointments in this group.</div>') +
      '</section>';
    setupHistoryActions(historyArea);
    return;
  }

  const groups = [
    { title: "Pending / Awaiting confirmation", filter: function (appointment) { return getDisplayStatus(appointment) === "Pending"; } },
    { title: "Upcoming", filter: function (appointment) { return getDisplayStatus(appointment) === "Confirmed"; } },
    { title: "Completed", filter: function (appointment) { return getDisplayStatus(appointment) === "Completed"; } },
    { title: "Cancelled", filter: function (appointment) { return getDisplayStatus(appointment) === "Cancelled"; } }
  ];

  historyArea.innerHTML = groups.map(function (group) {
    const items = appointments.filter(group.filter);
    return '<section class="history-group"><div class="history-group-title"><h3>' + group.title + '</h3><span>' + items.length + '</span></div>' +
      (items.length ? '<div class="history-grid">' + items.map(renderAppointmentCard).join("") + '</div>' : '<div class="empty-state compact-empty">No appointments in this group.</div>') +
      '</section>';
  }).join("");

  setupHistoryActions(historyArea);
}

function setupHistoryActions(historyArea) {
  historyArea.querySelectorAll("[data-download-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      const appointment = getAppointments().find(function (item) { return item.id === button.getAttribute("data-download-id"); });
      if (appointment) downloadAppointmentSlip(appointment);
    });
  });

  historyArea.querySelectorAll("[data-cancel-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      const appointmentId = button.getAttribute("data-cancel-id");
      if (!window.confirm("Cancel this appointment? The record will stay in your history with Cancelled status.")) {
        return;
      }
      const appointments = getAppointments().map(function (appointment) {
        if (appointment.id === appointmentId) {
          appointment.status = "Cancelled";
          appointment.updatedAt = new Date().toISOString();
        }
        return appointment;
      });
      saveAppointments(appointments);
      renderAppointmentHistory();
    });
  });

  historyArea.querySelectorAll("[data-delete-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      const appointmentId = button.getAttribute("data-delete-id");
      if (!window.confirm("Delete this cancelled appointment? This action cannot be undone.")) {
        return;
      }
      const appointments = getAppointments().filter(function (appointment) {
        return appointment.id !== appointmentId || getDisplayStatus(appointment) !== "Cancelled";
      });
      saveAppointments(appointments);
      renderAppointmentHistory();
    });
  });

  setupSlipActions(historyArea);
}

function setupHistoryFilters() {
  const filterButtons = document.querySelectorAll("[data-history-filter]");
  if (!filterButtons.length) return;

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      currentHistoryFilter = button.getAttribute("data-history-filter") || "all";
      filterButtons.forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
      renderAppointmentHistory();
    });
  });
}

function renderServiceDoctors() {
  document.querySelectorAll("[data-service-doctors]").forEach(function (container) {
    const service = getServiceByName(container.getAttribute("data-service-doctors"));
    container.innerHTML = '<h3>Available doctors</h3>' + service.doctors.map(function (doctor) {
      return '<div class="doctor-row"><strong>' + escapeHtml(doctor.name) + '</strong><span>' + escapeHtml(doctor.role) + ' - ' + escapeHtml(doctor.room) + '</span></div>';
    }).join("");
  });
}

function renderDoctorsSection() {
  const doctorsGrid = document.getElementById("doctorsGrid");
  if (!doctorsGrid) return;

  const searchInput = document.getElementById("doctorSearch");
  const availabilityFilter = document.getElementById("doctorAvailabilityFilter");
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const availabilityValue = availabilityFilter ? availabilityFilter.value : "all";
  const doctors = getAllDoctors().filter(function (doctor) {
    const matchesSearch = !searchTerm ||
      doctor.name.toLowerCase().includes(searchTerm) ||
      doctor.role.toLowerCase().includes(searchTerm) ||
      doctor.service.toLowerCase().includes(searchTerm);
    const matchesAvailability = availabilityValue === "all" ||
      (availabilityValue === "available" && doctor.available) ||
      (availabilityValue === "unavailable" && !doctor.available);
    return matchesSearch && matchesAvailability;
  });

  if (!doctors.length) {
    doctorsGrid.innerHTML = '<div class="empty-state text-center doctors-empty"><h3>No doctors found.</h3><p class="mb-0">Try another search term or availability filter.</p></div>';
    return;
  }

  doctorsGrid.innerHTML = doctors.map(function (doctor) {
    const bookingUrl = "appointment.html?service=" + encodeURIComponent(doctor.serviceId) + "&doctor=" + encodeURIComponent(doctor.id);
    const availabilityText = doctor.available ? "Available" : "Unavailable";
    const availabilityClass = doctor.available ? "available" : "unavailable";
    return '<article class="clinic-doctor-card">' +
      '<div class="doctor-card-top"><div><h3>' + escapeHtml(doctor.name) + '</h3><p>' + escapeHtml(doctor.role) + '</p></div><span class="availability-pill ' + availabilityClass + '">' + availabilityText + '</span></div>' +
      '<strong class="doctor-meta">' + escapeHtml(doctor.service) + '</strong>' +
      '<span class="doctor-meta">' + escapeHtml(doctor.hours) + ' - ' + escapeHtml(doctor.room) + '</span>' +
      '<div class="doctor-actions"><button class="btn btn-outline-primary btn-sm" type="button" data-doctor-profile="' + escapeHtml(doctor.id) + '">View Profile</button><a class="btn btn-primary btn-sm" href="' + bookingUrl + '">Book Appointment</a></div>' +
      '</article>';
  }).join("");

  doctorsGrid.querySelectorAll("[data-doctor-profile]").forEach(function (button) {
    button.addEventListener("click", function () {
      const doctor = getAllDoctors().find(function (item) { return item.id === button.getAttribute("data-doctor-profile"); });
      if (!doctor) return;
      window.alert(doctor.name + "\n" + doctor.role + "\nService: " + doctor.service + "\nAvailability: " + (doctor.available ? "Available" : "Unavailable") + "\nWorking hours: " + doctor.hours + "\nLocation: " + doctor.room);
    });
  });
}

function setupDoctorFilters() {
  const searchInput = document.getElementById("doctorSearch");
  const availabilityFilter = document.getElementById("doctorAvailabilityFilter");
  if (searchInput) {
    searchInput.addEventListener("input", renderDoctorsSection);
  }
  if (availabilityFilter) {
    availabilityFilter.addEventListener("change", renderDoctorsSection);
  }
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
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
    themeIcon.innerHTML = useDarkMode ? "&#9728;" : "&#127769;";
  }
}

function setupThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;

  themeToggle.addEventListener("click", function () {
    const useDarkMode = !document.body.classList.contains("dark-mode");
    document.body.classList.toggle("dark-mode", useDarkMode);
    localStorage.setItem(THEME_KEY, useDarkMode ? "dark" : "light");
    updateThemeToggle(useDarkMode);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  applySavedTheme();
  setupThemeToggle();
  renderAuthNav();
  setupRegisterForm();
  setupLoginForm();
  setMinimumAppointmentDate();
  setupDoctorSelection();
  applyAppointmentPrefill();
  setupAppointmentForm();
  setupStatusSearch();
  setupHistoryFilters();
  renderAppointmentHistory();
  renderServiceDoctors();
  setupDoctorFilters();
  renderDoctorsSection();
});
