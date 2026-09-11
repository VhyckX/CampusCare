const STORAGE_KEY = "campusCareAppointments";
const THEME_KEY = "campusCareTheme";
const API_BASE_URL = (window.CAMPUSCARE_API_BASE_URL || "http://127.0.0.1:5000/api").replace(/\/$/, "");
let latestAppointmentSlip = null;
let currentHistoryFilter = "all";
let isAppointmentSubmitting = false;
let isStatusLookupSubmitting = false;
let isBackendCancelSubmitting = false;
let statusLookupSequence = 0;
let currentBackendLookupContext = null;

const fallbackClinicServices = [
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

let clinicServices = fallbackClinicServices.slice();
const catalogState = {
  loading: false,
  loaded: false,
  error: ""
};

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char];
  });
}

function findServiceByName(name) {
  return clinicServices.find(function (service) {
    return service.name === name || service.id === name;
  });
}

function getServiceByName(name) {
  return findServiceByName(name) || clinicServices[0] || fallbackClinicServices[0];
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

function isAppointmentRecord(value) {
  return value && typeof value === "object" && typeof value.id === "string" && value.id.trim();
}

function readStoredAppointmentData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { appointments: [], damagedRecords: [], canSave: true, error: "" };
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return {
        appointments: [],
        damagedRecords: [],
        canSave: false,
        error: "Saved appointment data is not in the expected format."
      };
    }

    return {
      appointments: parsed.filter(isAppointmentRecord),
      damagedRecords: parsed.filter(function (record) { return !isAppointmentRecord(record); }),
      canSave: true,
      error: ""
    };
  } catch (error) {
    return {
      appointments: [],
      damagedRecords: [],
      canSave: false,
      error: "Saved appointment data could not be read."
    };
  }
}

function getAppointments() {
  const stored = readStoredAppointmentData();
  return stored.appointments.map(normalizeAppointment);
}

function saveAppointments(appointments) {
  const stored = readStoredAppointmentData();
  if (!stored.canSave) {
    throw new Error(stored.error || "Appointment storage is unavailable.");
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments.map(normalizeAppointment).concat(stored.damagedRecords)));
}

function getAppointmentStorageWarning() {
  const stored = readStoredAppointmentData();
  return stored.canSave ? "" : stored.error;
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

function showStaticAlert(target, type, message) {
  if (!target) return;
  target.innerHTML = '<div class="alert alert-' + type + '" role="alert">' + message + '</div>';
}

async function fetchApi(path, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function () { controller.abort(); }, 10000);
  const requestOptions = Object.assign({}, options || {}, { signal: controller.signal });
  let response;
  let payload = null;

  try {
    response = await fetch(API_BASE_URL + path, requestOptions);
    payload = await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    const networkError = new Error("The CampusCare API is unavailable or taking too long to respond.");
    networkError.status = 0;
    throw networkError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : "The CampusCare API request failed.";
    const apiError = new Error(message);
    apiError.status = response.status;
    throw apiError;
  }

  return payload;
}

function mapServiceFromApi(service) {
  return {
    id: service.serviceIdentifier,
    name: service.name,
    hours: service.displayHours,
    openingHours: service.openingHours || [],
    doctors: []
  };
}

function attachDoctorsToServices(services, doctors) {
  const serviceMap = new Map(services.map(function (service) {
    service.doctors = [];
    return [service.id, service];
  }));

  doctors.forEach(function (doctor) {
    const service = serviceMap.get(doctor.serviceIdentifier);
    if (!service) return;

    service.doctors.push({
      id: doctor.doctorIdentifier,
      name: doctor.name,
      role: doctor.role,
      room: doctor.room,
      available: doctor.available !== false
    });
  });

  return services;
}

async function loadCatalog() {
  catalogState.loading = true;
  catalogState.error = "";

  try {
    const responses = await Promise.all([
      fetchApi("/services"),
      fetchApi("/doctors")
    ]);

    const services = Array.isArray(responses[0].data) ? responses[0].data.map(mapServiceFromApi) : [];
    const doctors = Array.isArray(responses[1].data) ? responses[1].data : [];
    clinicServices = attachDoctorsToServices(services, doctors);
    catalogState.loaded = true;
  } catch (error) {
    catalogState.error = "CampusCare catalog could not be loaded. Please make sure the backend API is running.";
    catalogState.loaded = false;
  } finally {
    catalogState.loading = false;
  }
}

function normalizeApiAppointment(appointment) {
  return {
    id: appointment.appointmentRef,
    fullName: appointment.fullName,
    email: appointment.email,
    phone: appointment.phone,
    service: appointment.serviceName,
    serviceId: appointment.serviceIdentifier,
    department: appointment.serviceName,
    doctorId: appointment.doctorIdentifier,
    doctor: appointment.doctorName,
    doctorRole: appointment.doctorRole,
    doctorRoom: appointment.doctorRoom,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    reason: appointment.reason,
    status: appointment.status || "Pending",
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
}

function getApiErrorMessage(error) {
  if (error && error.status === 409) {
    return error.message || "That appointment slot is no longer available. Please choose another doctor or time.";
  }

  if (error && error.status === 400) {
    return error.message || "Please check the appointment details and try again.";
  }

  if (error && error.status === 404) {
    return error.message || "The selected service or doctor could not be found.";
  }

  return "CampusCare could not submit the appointment. Please check that the backend API is running and try again.";
}

function getLookupErrorMessage(error) {
  if (error && error.status === 400) {
    return error.message || "Please enter a valid appointment reference and booking email.";
  }

  if (error && error.status === 404) {
    return error.message || "No appointment was found for those details.";
  }

  if (error && error.status === 429) {
    return error.message || "Too many lookup attempts. Please wait before trying again.";
  }

  return "CampusCare could not check the appointment right now. Please make sure the backend API is running and try again.";
}

function getCancelErrorMessage(error) {
  if (error && error.status === 400) {
    return error.message || "Please check the appointment reference and booking email.";
  }

  if (error && error.status === 404) {
    return error.message || "No appointment was found for those details.";
  }

  if (error && error.status === 409) {
    return error.message || "This appointment can no longer be cancelled.";
  }

  if (error && error.status === 429) {
    return error.message || "Too many attempts. Please wait before trying again.";
  }

  return "CampusCare could not cancel the appointment right now. Please make sure the backend API is running and try again.";
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

function populateDepartmentSelect() {
  const departmentSelect = document.getElementById("department");
  if (!departmentSelect) return;

  const selectedValue = departmentSelect.value;
  const options = clinicServices.map(function (service) {
    const selected = selectedValue === service.id || selectedValue === service.name ? " selected" : "";
    return '<option value="' + escapeHtml(service.id) + '"' + selected + '>' + escapeHtml(service.name) + '</option>';
  }).join("");

  departmentSelect.innerHTML = '<option value="">Select department</option>' + options;
  departmentSelect.disabled = !catalogState.loaded || catalogState.loading || Boolean(catalogState.error);
}

function populateDoctorSelect() {
  const departmentSelect = document.getElementById("department");
  const doctorSelect = document.getElementById("doctor");
  const doctorHelper = document.getElementById("doctorHelper");
  if (!departmentSelect || !doctorSelect) return;

  if (catalogState.loading) {
    doctorSelect.innerHTML = '<option value="">Loading doctors...</option>';
    doctorSelect.disabled = true;
    if (doctorHelper) doctorHelper.textContent = "Loading clinic services from the CampusCare API.";
    return;
  }

  if (!catalogState.loaded || catalogState.error) {
    doctorSelect.innerHTML = '<option value="">Doctors unavailable</option>';
    doctorSelect.disabled = true;
    if (doctorHelper) doctorHelper.textContent = catalogState.error || "Clinic catalog is unavailable. Booking is paused.";
    return;
  }

  const selectedService = findServiceByName(departmentSelect.value);
  if (!selectedService) {
    doctorSelect.innerHTML = '<option value="">Select a service first</option>';
    doctorSelect.disabled = true;
    if (doctorHelper) doctorHelper.textContent = "Doctors are matched to the selected clinic department.";
    return;
  }

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

  populateDepartmentSelect();
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

  const service = findServiceByName(serviceId);
  if (!service) {
    if (doctorHelper) {
      doctorHelper.textContent = "The requested clinic department could not be found in the current catalog.";
    }
    return;
  }

  departmentSelect.value = service.id;
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
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    return Promise.reject(new Error("Clipboard copying is unavailable."));
  }

  return navigator.clipboard.writeText(appointmentId);
}

function setupSlipActions(container) {
  const area = container || document;
  const downloadButton = area.querySelector("#downloadSlipBtn");
  if (downloadButton) {
    downloadButton.addEventListener("click", function () { downloadAppointmentSlip(); });
  }

  area.querySelectorAll("[data-copy-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      const appointmentId = button.getAttribute("data-copy-id");
      const originalText = button.textContent;
      copyAppointmentId(appointmentId).then(function () {
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = originalText; }, 1600);
      }).catch(function () {
        window.alert("Copying is unavailable in this browser. Please copy this appointment ID manually: " + appointmentId);
      });
    });
  });
}

function setAppointmentSubmitting(form, isSubmitting) {
  isAppointmentSubmitting = isSubmitting;
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;

  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting Appointment..." : "Submit Appointment";
}

function setupAppointmentForm() {
  const form = document.getElementById("appointmentForm");
  const alertBox = document.getElementById("formAlert");
  const slipArea = document.getElementById("appointmentSlipArea");
  if (!form || !alertBox) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (isAppointmentSubmitting) return;

    if (!catalogState.loaded || catalogState.error) {
      showAlert(alertBox, "warning", "Clinic services are not available yet. Please make sure the backend API is running before booking.");
      return;
    }

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

    const service = findServiceByName(formData.get("department"));
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
    const doctor = service && service.doctors.find(function (doctor) {
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

    try {
      setAppointmentSubmitting(form, true);
      const payload = {
        fullName: fullName,
        email: email,
        phone: phone,
        reason: reason,
        serviceIdentifier: service.id,
        doctorIdentifier: doctor.id,
        appointmentDate: dateValue,
        appointmentTime: timeValue
      };
      const response = await fetchApi("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response || response.success !== true || !response.data) {
        throw new Error("CampusCare did not return the saved appointment details.");
      }

      const appointment = normalizeApiAppointment(response.data);
      latestAppointmentSlip = appointment;

      form.reset();
      form.classList.remove("was-validated");
      populateDepartmentSelect();
      populateDoctorSelect();
      showAlert(alertBox, "success", "<strong>&#10003; Appointment booked successfully!</strong><br>Your Appointment ID: <strong>" + appointment.id + "</strong><br>Please save this ID. Backend status lookup will be connected in the next task.");

      if (slipArea) {
        slipArea.innerHTML = renderAppointmentSlip(appointment);
        setupSlipActions(slipArea);
        slipArea.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      showAlert(alertBox, error.status === 409 ? "warning" : "danger", getApiErrorMessage(error));
    } finally {
      setAppointmentSubmitting(form, false);
    }
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

function isBackendAppointmentCancellable(appointment) {
  const status = appointment.status || "Pending";
  return (status === "Pending" || status === "Confirmed") && !hasScheduledTimePassed({
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: status
  });
}

function renderBackendStatusTracker(appointment, lookupContext) {
  const status = appointment.status || "Pending";
  const passedNote = getPassedTimeNote({
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: status
  });
  const cancelButton = lookupContext && isBackendAppointmentCancellable(appointment)
    ? '<button type="button" class="btn btn-cancel" data-backend-cancel-ref="' + escapeHtml(lookupContext.appointmentRef) + '">Cancel Appointment</button>'
    : "";

  return '<article class="tracking-card">' +
    '<div class="tracking-header"><div><span class="section-kicker mb-1">Backend appointment tracking</span><h2>' + escapeHtml(appointment.appointmentRef) + '</h2><p>' + escapeHtml(appointment.serviceName) + ' with ' + escapeHtml(appointment.doctorName) + '</p></div><span class="badge rounded-pill badge-status ' + getStatusClass(status) + '">' + escapeHtml(status) + '</span></div>' +
    '<div class="tracking-progress ' + getStatusClass(status) + '"><span></span><span></span><span></span></div>' +
    '<dl class="slip-details tracking-details">' +
    '<dt>Service</dt><dd>' + escapeHtml(appointment.serviceName) + '</dd>' +
    '<dt>Doctor</dt><dd>' + escapeHtml(appointment.doctorName) + (appointment.doctorRole ? ' (' + escapeHtml(appointment.doctorRole) + ')' : '') + '</dd>' +
    '<dt>Clinic Room</dt><dd>' + escapeHtml(appointment.doctorRoom || "Not set") + '</dd>' +
    '<dt>Date and Time</dt><dd>' + formatDate(appointment.appointmentDate) + ' at ' + formatTime(appointment.appointmentTime) + '</dd>' +
    '<dt>Current Status</dt><dd>' + escapeHtml(status) + '</dd>' +
    '</dl>' +
    passedNote +
    '<div id="backendStatusActionAlert"></div>' +
    '<div class="slip-actions"><button type="button" class="btn btn-outline-primary" data-copy-id="' + escapeHtml(appointment.appointmentRef) + '">Copy Appointment ID</button>' + cancelButton + '<a class="btn btn-primary" href="appointment.html">Book Another Appointment</a></div>' +
    '</article>';
}

function renderOlderDemoStatusTracker(appointment) {
  return '<div class="mt-4"><div class="alert alert-info mb-3" role="alert"><strong>Older demo booking.</strong> This record was saved in this browser before backend status lookup was connected.</div>' +
    renderStatusTracker(appointment) +
    '</div>';
}

function setStatusLookupSubmitting(form, isSubmitting) {
  isStatusLookupSubmitting = isSubmitting;
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;

  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Checking..." : "Search";
}

function setupBackendCancelAction(result, lookupContext) {
  const cancelButton = result.querySelector("[data-backend-cancel-ref]");
  if (!cancelButton || !lookupContext) return;

  cancelButton.addEventListener("click", async function () {
    if (isBackendCancelSubmitting) return;

    if (!window.confirm("Cancel this appointment?")) {
      return;
    }

    if (currentBackendLookupContext !== lookupContext) {
      return;
    }

    const originalText = cancelButton.textContent;
    const actionAlert = result.querySelector("#backendStatusActionAlert");
    if (actionAlert) actionAlert.innerHTML = "";
    isBackendCancelSubmitting = true;
    cancelButton.disabled = true;
    cancelButton.textContent = "Cancelling...";

    try {
      const response = await fetchApi("/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentRef: lookupContext.appointmentRef,
          email: lookupContext.email
        })
      });

      if (currentBackendLookupContext !== lookupContext) {
        return;
      }

      if (!response || response.success !== true || !response.data) {
        throw new Error("CampusCare did not return the cancelled appointment details.");
      }

      currentBackendLookupContext = {
        appointmentRef: response.data.appointmentRef,
        email: lookupContext.email,
        sequence: lookupContext.sequence
      };
      result.innerHTML = renderBackendStatusTracker(response.data, currentBackendLookupContext);
      setupSlipActions(result);
      setupBackendCancelAction(result, currentBackendLookupContext);
    } catch (error) {
      if (currentBackendLookupContext !== lookupContext) {
        return;
      }

      if (actionAlert) {
        actionAlert.innerHTML = '<div class="alert alert-danger" role="alert">' + escapeHtml(getCancelErrorMessage(error)) + '</div>';
      }
      cancelButton.disabled = false;
      cancelButton.textContent = originalText;
    } finally {
      isBackendCancelSubmitting = false;
    }
  });
}

function setupStatusSearch() {
  const form = document.getElementById("statusForm");
  const input = document.getElementById("appointmentId");
  const emailInput = document.getElementById("lookupEmail");
  const result = document.getElementById("statusResult");
  if (!form || !input || !emailInput || !result) return;

  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("id");
  if (appointmentId) {
    input.value = appointmentId;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (isStatusLookupSubmitting) return;

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const searchId = input.value.trim().toUpperCase();
    const bookingEmail = emailInput.value.trim().toLowerCase();
    const lookupSequence = statusLookupSequence + 1;
    statusLookupSequence = lookupSequence;
    currentBackendLookupContext = null;

    if (!searchId || searchId.length > 40 || !/^CC-\d{8}-\d{4,}$/.test(searchId)) {
      result.innerHTML = '<div class="empty-state"><h2>Check the reference.</h2><p class="mb-0">Please enter a valid appointment reference such as CC-20260716-1234.</p></div>';
      return;
    }

    if (!bookingEmail || bookingEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingEmail)) {
      result.innerHTML = '<div class="empty-state"><h2>Check the email.</h2><p class="mb-0">Please enter the email address used during booking.</p></div>';
      return;
    }

    result.innerHTML = '<div class="empty-state"><h2>Checking appointment.</h2><p class="mb-0">Please wait while CampusCare checks the backend appointment record.</p></div>';
    setStatusLookupSubmitting(form, true);

    try {
      const response = await fetchApi("/appointments/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentRef: searchId,
          email: bookingEmail
        })
      });

      if (!response || response.success !== true || !response.data) {
        throw new Error("CampusCare did not return appointment status details.");
      }

      if (lookupSequence !== statusLookupSequence) {
        return;
      }

      currentBackendLookupContext = {
        appointmentRef: response.data.appointmentRef,
        email: bookingEmail,
        sequence: lookupSequence
      };
      form.classList.remove("was-validated");
      result.innerHTML = renderBackendStatusTracker(response.data, currentBackendLookupContext);
      setupSlipActions(result);
      setupBackendCancelAction(result, currentBackendLookupContext);
    } catch (error) {
      if (lookupSequence !== statusLookupSequence) {
        return;
      }

      const message = getLookupErrorMessage(error);
      let olderDemoHtml = "";

      if (error.status === 404) {
        const storageWarning = getAppointmentStorageWarning();
        if (!storageWarning) {
          const olderDemoAppointment = getAppointments().find(function (item) {
            return item.id.toUpperCase() === searchId;
          });
          if (olderDemoAppointment) {
            olderDemoHtml = renderOlderDemoStatusTracker(olderDemoAppointment);
          }
        }
      }

      result.innerHTML = '<div class="empty-state"><h2>Appointment not verified.</h2><p class="mb-0">' + escapeHtml(message) + '</p></div>' + olderDemoHtml;
      setupSlipActions(result);
    } finally {
      setStatusLookupSubmitting(form, false);
    }
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

  const storageWarning = getAppointmentStorageWarning();
  if (storageWarning) {
    historyArea.innerHTML = '<div class="empty-state text-center"><h3>Appointment storage needs attention.</h3><p class="mb-0">' + escapeHtml(storageWarning) + ' The damaged browser data was left unchanged.</p></div>';
    return;
  }

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
    { title: "Confirmed - Time Passed", filter: function (appointment) {
      const status = getDisplayStatus(appointment);
      const appointmentDateTime = getAppointmentDateTime(appointment);
      return status === "Confirmed" &&
        !Number.isNaN(appointmentDateTime.getTime()) &&
        appointmentDateTime < new Date();
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

      try {
        saveAppointments(appointments);
      } catch (error) {
        window.alert("This appointment could not be cancelled because browser storage is unavailable or damaged. The record was left unchanged.");
        return;
      }

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

      try {
        saveAppointments(appointments);
      } catch (error) {
        window.alert("This cancelled appointment could not be deleted because browser storage is unavailable or damaged. The record was left unchanged.");
        return;
      }

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
    if (catalogState.loading) {
      container.innerHTML = '<h3>Available doctors</h3><p class="mb-0 text-muted">Loading doctors...</p>';
      return;
    }

    if (!catalogState.loaded || catalogState.error) {
      container.innerHTML = '<h3>Available doctors</h3><p class="mb-0 text-muted">Doctor details are unavailable right now.</p>';
      return;
    }

    const service = findServiceByName(container.getAttribute("data-service-doctors"));
    if (!service) {
      container.innerHTML = '<h3>Available doctors</h3><p class="mb-0 text-muted">No doctors found for this service.</p>';
      return;
    }

    container.innerHTML = '<h3>Available doctors</h3>' + service.doctors.map(function (doctor) {
      return '<div class="doctor-row"><strong>' + escapeHtml(doctor.name) + '</strong><span>' + escapeHtml(doctor.role) + ' - ' + escapeHtml(doctor.room) + '</span></div>';
    }).join("");
  });
}

function renderDoctorsSection() {
  const doctorsGrid = document.getElementById("doctorsGrid");
  if (!doctorsGrid) return;

  if (catalogState.loading) {
    doctorsGrid.innerHTML = '<div class="empty-state text-center doctors-empty"><h3>Loading doctors.</h3><p class="mb-0">Fetching the clinic catalog from the CampusCare API.</p></div>';
    return;
  }

  if (!catalogState.loaded || catalogState.error) {
    doctorsGrid.innerHTML = '<div class="empty-state text-center doctors-empty"><h3>Doctors unavailable.</h3><p class="mb-0">' + escapeHtml(catalogState.error || "The clinic catalog could not be loaded.") + '</p></div>';
    return;
  }

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
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (error) {
    savedTheme = "";
  }
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
    try {
      localStorage.setItem(THEME_KEY, useDarkMode ? "dark" : "light");
    } catch (error) {
      window.alert("Theme changed for this page, but your browser could not save the preference.");
    }
    updateThemeToggle(useDarkMode);
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  applySavedTheme();
  setupThemeToggle();
  setMinimumAppointmentDate();
  const catalogPromise = loadCatalog();
  setupDoctorSelection();
  setupAppointmentForm();
  setupStatusSearch();
  setupHistoryFilters();
  renderAppointmentHistory();
  renderServiceDoctors();
  setupDoctorFilters();
  renderDoctorsSection();
  await catalogPromise;
  populateDepartmentSelect();
  populateDoctorSelect();
  renderServiceDoctors();
  renderDoctorsSection();
  applyAppointmentPrefill();
});
