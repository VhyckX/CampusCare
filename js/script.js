const STORAGE_KEY = "campusCareAppointments";
const THEME_KEY = "campusCareTheme";
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

function hasScheduledTimePassed(appointment) {
  const appointmentDateTime = getAppointmentDateTime(appointment);
  return !Number.isNaN(appointmentDateTime.getTime()) && appointmentDateTime < new Date();
}

function getDisplayStatus(appointment) {
  if (appointment.status === "Cancelled") return "Cancelled";
  if (appointment.status === "Completed") return "Completed";
  return appointment.status || "Pending";
}

function getStatusClass(status) {
  return "status-" + String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
}

function showAlert(target, type, message) {
  target.innerHTML = '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' + message + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>';
}

function setMinimumAppointmentDate() {
  const dateInput = document.getElementById("appointmentDate");
  if (dateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    dateInput.min = year + "-" + month + "-" + day;
  }
}

function populateDoctorSelect() {
  const departmentSelect = document.getElementById("department");
  const doctorSelect = document.getElementById("doctor");
  const doctorHelper = document.getElementById("doctorHelper");
  if (!departmentSelect || !doctorSelect) return;

  const selectedService = getServiceByName(departmentSelect.value);
  const availableDoctors = selectedService.doctors.filter(function (doctor) {
    return doctor.available !== false;
  });

  doctorSelect.innerHTML = '<option value="">Select doctor</option>' + availableDoctors.map(function (doctor) {
    return '<option value="' + doctor.id + '">' + doctor.name + ' - ' + doctor.role + '</option>';
  }).join("");

  doctorSelect.disabled = !departmentSelect.value || !availableDoctors.length;
  if (doctorHelper) {
    doctorHelper.textContent = departmentSelect.value ?
      (availableDoctors.length ? selectedService.hours : "No available doctors for this clinic department right now.") :
      "Doctors are matched to the selected clinic department.";
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
  const doctorHelper = document.getElementById("doctorHelper");
  if (!departmentSelect || !doctorSelect) return;

  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get("service");
  const doctorId = params.get("doctor");
  if (!serviceId) return;

  const service = getServiceByName(serviceId);
  departmentSelect.value = service.name;
  populateDoctorSelect();

  if (doctorId && service.doctors.some(function (doctor) { return doctor.id === doctorId && doctor.available !== false; })) {
    doctorSelect.value = doctorId;
  } else if (doctorId && doctorHelper) {
    doctorHelper.textContent = "That doctor is currently unavailable. Please choose an available doctor.";
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

function validatePhoneNumber(phone) {
  const value = String(phone || "").trim();
  const digitsOnly = value.replace(/[\s-]/g, "").replace(/^\+/, "");

  if (!/^\+?[0-9][0-9\s-]*$/.test(value)) {
    return "Please enter a valid phone number using digits, spaces, hyphens, and an optional leading +.";
  }

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return "Please enter a valid phone number with 7 to 15 digits.";
  }

  return "";
}

function getPassedTimeNote(appointment) {
  const status = getDisplayStatus(appointment);
  if (!hasScheduledTimePassed(appointment) || status === "Completed" || status === "Cancelled") {
    return "";
  }
  return '<div class="time-passed-note">Scheduled time has passed.</div>';
}

function renderAppointmentSlip(appointment) {
  const status = getDisplayStatus(appointment);
  const passedNote = getPassedTimeNote(appointment);
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
    passedNote +
    '<div class="slip-footer-note">CampusCare Student Clinic | Main Campus Clinic Desk | support@campuscare.local</div>' +
    '<div class="slip-actions">' +
    '<button type="button" class="btn btn-outline-primary" data-copy-id="' + escapeHtml(appointment.id) + '">Copy Appointment ID</button>' +
    '<button type="button" class="btn btn-primary" id="downloadSlipBtn">Download Appointment Slip</button>' +
    '</div>' +
    '</article>';
}

function appointmentSlipHtml(appointment) {
  const status = getDisplayStatus(appointment);
  const passedNote = getPassedTimeNote(appointment) ? '<p class="note">Scheduled time has passed.</p>' : '';
  return '<!doctype html>' +
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>CampusCare Appointment Slip</title>' +
    '<style>' +
    'body{margin:0;background:#f8fafc;color:#1f2937;font-family:Arial,sans-serif;line-height:1.6;padding:32px}' +
    '.slip{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);max-width:780px;margin:auto;overflow:hidden;padding:28px}' +
    '.top{border-bottom:1px dashed #cbd5e1;display:flex;justify-content:space-between;gap:20px;padding-bottom:18px}' +
    'h1{color:#0057b8;font-size:28px;margin:0 0 6px}.muted{color:#64748b;margin:0}.badge{background:rgba(0,169,157,.15);border-radius:999px;color:#007b73;font-weight:700;height:max-content;padding:8px 14px}' +
    '.code{background:linear-gradient(135deg,rgba(0,87,184,.1),rgba(0,169,157,.12));border-radius:14px;margin:22px 0;padding:16px}.code span{color:#64748b;display:block;font-weight:700}.code strong{color:#0057b8;display:block;font-size:24px;letter-spacing:.04em}' +
    'dl{display:grid;gap:12px 18px;grid-template-columns:190px 1fr;margin:0}dt{color:#64748b;font-weight:700}dd{font-weight:700;margin:0}.note{background:rgba(250,204,21,.16);border:1px solid rgba(250,204,21,.35);border-radius:12px;color:#854d0e;font-weight:700;margin:18px 0 0;padding:12px}.footer{border-top:1px dashed #cbd5e1;color:#64748b;margin-top:22px;padding-top:16px}' +
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
    '</dl>' + passedNote + '<p class="footer">CampusCare Student Clinic | Main Campus Clinic Desk | Generated locally in your browser.</p></article>' +
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

    const formData = new FormData(form);
    const fullName = formData.get("fullName").trim();
    const email = formData.get("email").trim();
    const phone = formData.get("phone").trim();
    const reason = formData.get("reason").trim();
    const phoneMessage = validatePhoneNumber(phone);

    if (!fullName) {
      showAlert(alertBox, "warning", "Please enter your full name.");
      return;
    }

    if (!reason) {
      showAlert(alertBox, "warning", "Please enter your reason for visit.");
      return;
    }

    if (!phone) {
      showAlert(alertBox, "warning", "Please enter your phone number.");
      return;
    }

    if (phoneMessage) {
      showAlert(alertBox, "warning", phoneMessage);
      return;
    }

    const service = getServiceByName(formData.get("department"));
    const dateValue = formData.get("appointmentDate");
    const timeValue = formData.get("appointmentTime");
    const validationMessage = dateValue && timeValue ? validateAppointmentDateTime(dateValue, timeValue, service) : "";

    if (validationMessage) {
      showAlert(alertBox, "warning", validationMessage);
      return;
    }

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      if (slipArea) slipArea.innerHTML = "";
      showAlert(alertBox, "warning", "Please complete all required fields before submitting.");
      return;
    }

    const selectedDoctorId = formData.get("doctor");
    const doctor = service.doctors.find(function (doctor) {
      return doctor.id === selectedDoctorId || doctor.name === selectedDoctorId;
    });

    if (!doctor) {
      showAlert(alertBox, "warning", "Please choose an available doctor for this service.");
      return;
    }

    if (doctor.available === false) {
      showAlert(alertBox, "warning", doctor.name + " is currently unavailable. Please choose an available doctor.");
      return;
    }

    const appointment = normalizeAppointment({
      id: generateAppointmentId(),
      fullName: fullName,
      email: email,
      phone: phone,
      service: service.name,
      department: service.name,
      serviceId: service.id,
      doctorId: doctor.id,
      doctor: doctor.name,
      doctorRole: doctor.role,
      doctorRoom: doctor.room,
      appointmentDate: dateValue,
      appointmentTime: timeValue,
      reason: reason,
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
  const passedNote = getPassedTimeNote(appointment);
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
    passedNote +
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
  const passedNote = getPassedTimeNote(appointment);
  return '<article class="history-card">' +
    '<div class="history-card-top"><div><strong>' + escapeHtml(appointment.service) + '</strong><span>' + escapeHtml(appointment.id) + '</span></div><span class="badge rounded-pill badge-status ' + getStatusClass(status) + '">' + status + '</span></div>' +
    '<p class="mb-2">' + escapeHtml(appointment.doctor) + ' - ' + formatDate(appointment.appointmentDate) + ' - ' + formatTime(appointment.appointmentTime) + '</p>' +
    passedNote +
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
        return (status === "Pending" || status === "Confirmed") &&
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
    { title: "Upcoming", filter: function (appointment) {
      const status = getDisplayStatus(appointment);
      const appointmentDateTime = getAppointmentDateTime(appointment);
      return status === "Confirmed" &&
        !Number.isNaN(appointmentDateTime.getTime()) &&
        appointmentDateTime >= new Date();
    } },
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
    const bookingAction = doctor.available ?
      '<a class="btn btn-primary btn-sm" href="' + bookingUrl + '">Book Appointment</a>' :
      '<button class="btn btn-outline-secondary btn-sm" type="button" disabled aria-disabled="true">Book Appointment</button>';
    return '<article class="clinic-doctor-card">' +
      '<div class="doctor-card-top"><div><h3>' + escapeHtml(doctor.name) + '</h3><p>' + escapeHtml(doctor.role) + '</p></div><span class="availability-pill ' + availabilityClass + '">' + availabilityText + '</span></div>' +
      '<strong class="doctor-meta">' + escapeHtml(doctor.service) + '</strong>' +
      '<span class="doctor-meta">' + escapeHtml(doctor.hours) + ' - ' + escapeHtml(doctor.room) + '</span>' +
      '<div class="doctor-actions"><button class="btn btn-outline-primary btn-sm" type="button" data-doctor-profile="' + escapeHtml(doctor.id) + '">View Profile</button>' + bookingAction + '</div>' +
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
