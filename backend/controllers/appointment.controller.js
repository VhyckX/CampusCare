import { randomInt } from "node:crypto";
import Appointment from "../models/appointment.model.js";
import Doctor from "../models/doctor.model.js";
import Service from "../models/service.model.js";

const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]*$/;
const appointmentReferencePattern = /^CC-\d{8}-\d{4,}$/;
const lagosOffsetMinutes = 60;
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const guestActionAttempts = new Map();
const guestActionWindowMs = 15 * 60 * 1000;
const guestActionMaxAttempts = 8;

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAppointmentInput(body) {
  return {
    fullName: asTrimmedString(body.fullName),
    email: asTrimmedString(body.email).toLowerCase(),
    phone: asTrimmedString(body.phone),
    reason: asTrimmedString(body.reason),
    serviceIdentifier: asTrimmedString(body.serviceIdentifier).toLowerCase(),
    doctorIdentifier: asTrimmedString(body.doctorIdentifier).toLowerCase(),
    appointmentDate: asTrimmedString(body.appointmentDate),
    appointmentTime: asTrimmedString(body.appointmentTime)
  };
}

function normalizeLookupInput(body) {
  return {
    appointmentRef: asTrimmedString(body.appointmentRef || body.appointmentId || body.id).toUpperCase(),
    email: asTrimmedString(body.email).toLowerCase()
  };
}

function validateLookupInput(input) {
  if (!input.appointmentRef || input.appointmentRef.length > 40 || !appointmentReferencePattern.test(input.appointmentRef)) {
    throw new ApiError(400, "A valid appointment reference is required.");
  }

  if (!input.email || input.email.length > 120 || !emailPattern.test(input.email)) {
    throw new ApiError(400, "A valid booking email is required.");
  }
}

function checkGuestActionRateLimit(req, actionName) {
  const key = `${actionName}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
  const now = Date.now();
  const current = guestActionAttempts.get(key);

  if (!current || current.resetAt <= now) {
    guestActionAttempts.set(key, { count: 1, resetAt: now + guestActionWindowMs });
    return;
  }

  if (current.count >= guestActionMaxAttempts) {
    throw new ApiError(429, "Too many attempts. Please wait before trying again.");
  }

  current.count += 1;
}

function validateInput(input) {
  if (!input.fullName || input.fullName.length < 2 || input.fullName.length > 100) {
    throw new ApiError(400, "Full name is required and must be 2 to 100 characters.");
  }

  if (!input.email || input.email.length > 120 || !emailPattern.test(input.email)) {
    throw new ApiError(400, "A valid email address is required.");
  }

  const phoneDigits = input.phone.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (!input.phone || input.phone.length > 25 || !phonePattern.test(input.phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new ApiError(400, "A valid phone number is required.");
  }

  if (!input.reason || input.reason.length < 3 || input.reason.length > 500) {
    throw new ApiError(400, "Reason for visit is required and must be 3 to 500 characters.");
  }

  if (!identifierPattern.test(input.serviceIdentifier)) {
    throw new ApiError(400, "A valid serviceIdentifier is required.");
  }

  if (!identifierPattern.test(input.doctorIdentifier)) {
    throw new ApiError(400, "A valid doctorIdentifier is required.");
  }

  if (!localDatePattern.test(input.appointmentDate)) {
    throw new ApiError(400, "Appointment date must use YYYY-MM-DD format.");
  }

  if (!localTimePattern.test(input.appointmentTime)) {
    throw new ApiError(400, "Appointment time must use HH:mm 24-hour format.");
  }
}

function parseLagosDateTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    throw new ApiError(400, "Appointment date must be a real calendar date.");
  }

  const scheduledAt = new Date(Date.UTC(year, month - 1, day, hour, minute) - lagosOffsetMinutes * 60 * 1000);

  if (scheduledAt <= new Date()) {
    throw new ApiError(400, "Please choose a future appointment date and time.");
  }

  return {
    scheduledAt,
    dayName: dayNames[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()],
    minutesAfterMidnight: hour * 60 + minute
  };
}

function parseTimeMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function validateOpeningHours(service, dateTime) {
  const isOpen = service.openingHours.some((rule) => {
    if (!rule.days.includes(dateTime.dayName)) return false;
    if (rule.is24Hours) return true;

    return dateTime.minutesAfterMidnight >= parseTimeMinutes(rule.opensAt) &&
      dateTime.minutesAfterMidnight < parseTimeMinutes(rule.closesAt);
  });

  if (!isOpen) {
    throw new ApiError(400, `${service.name} appointments are available during: ${service.displayHours}.`);
  }
}

function formatLagosDatePart(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date).replaceAll("-", "");
}

function generateAppointmentRef() {
  return `CC-${formatLagosDatePart()}-${randomInt(1000, 10000)}`;
}

function publicAppointment(appointment, service, doctor) {
  return {
    appointmentRef: appointment.appointmentRef,
    fullName: appointment.fullName,
    email: appointment.email,
    phone: appointment.phone,
    serviceIdentifier: appointment.serviceIdentifier,
    serviceName: service.name,
    doctorIdentifier: appointment.doctorIdentifier,
    doctorName: doctor.name,
    doctorRole: doctor.role,
    doctorRoom: doctor.room,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    scheduledAt: appointment.scheduledAt,
    timezone: appointment.timezone,
    reason: appointment.reason,
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
}

function publicAppointmentStatus(appointment) {
  return {
    appointmentRef: appointment.appointmentRef,
    status: appointment.status,
    serviceName: appointment.service?.name || appointment.serviceIdentifier,
    doctorName: appointment.doctor?.name || appointment.doctorIdentifier,
    doctorRole: appointment.doctor?.role || "",
    doctorRoom: appointment.doctor?.room || "",
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    timezone: appointment.timezone
  };
}

function limitedAppointmentStatusQuery() {
  return "appointmentRef status service doctor serviceIdentifier doctorIdentifier appointmentDate appointmentTime scheduledAt timezone -_id";
}

function populateAppointmentStatus(query) {
  return query
    .select(limitedAppointmentStatusQuery())
    .populate({ path: "service", select: "name -_id" })
    .populate({ path: "doctor", select: "name role room -_id" })
    .maxTimeMS(8000)
    .lean();
}

function isDuplicateSlotError(error) {
  return error?.code === 11000 &&
    (error?.keyPattern?.doctor === 1 || error?.message?.includes("unique_active_doctor_slot"));
}

export async function createAppointment(req, res, next) {
  try {
    const input = normalizeAppointmentInput(req.body || {});
    validateInput(input);

    const dateTime = parseLagosDateTime(input.appointmentDate, input.appointmentTime);
    const service = await Service.findOne({ serviceIdentifier: input.serviceIdentifier }).maxTimeMS(8000);

    if (!service) {
      throw new ApiError(404, "Clinic service was not found.");
    }

    const doctor = await Doctor.findOne({ doctorIdentifier: input.doctorIdentifier }).maxTimeMS(8000);

    if (!doctor) {
      throw new ApiError(404, "Doctor was not found.");
    }

    if (String(doctor.service) !== String(service._id) || doctor.serviceIdentifier !== service.serviceIdentifier) {
      throw new ApiError(409, "Selected doctor does not belong to the selected service.");
    }

    if (!doctor.available) {
      throw new ApiError(409, "Selected doctor is currently unavailable.");
    }

    validateOpeningHours(service, dateTime);

    let appointment;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        appointment = await Appointment.create({
          appointmentRef: generateAppointmentRef(),
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          service: service._id,
          serviceIdentifier: service.serviceIdentifier,
          doctor: doctor._id,
          doctorIdentifier: doctor.doctorIdentifier,
          appointmentDate: input.appointmentDate,
          appointmentTime: input.appointmentTime,
          scheduledAt: dateTime.scheduledAt,
          reason: input.reason,
          status: "Pending"
        });
        break;
      } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.appointmentRef === 1 && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      data: publicAppointment(appointment, service, doctor)
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    if (isDuplicateSlotError(error)) {
      return res.status(409).json({
        success: false,
        message: "That doctor already has an active appointment at the selected date and time."
      });
    }

    next(error);
  }
}

export async function lookupAppointment(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    checkGuestActionRateLimit(req, "lookup");

    const input = normalizeLookupInput(req.body || {});
    validateLookupInput(input);

    const appointment = await populateAppointmentStatus(Appointment.findOne({
      appointmentRef: input.appointmentRef,
      email: input.email
    }));

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "No appointment was found for those details."
      });
    }

    res.status(200).json({
      success: true,
      data: publicAppointmentStatus(appointment)
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    checkGuestActionRateLimit(req, "cancel");

    const input = normalizeLookupInput(req.body || {});
    validateLookupInput(input);

    const now = new Date();
    const cancelledAppointment = await populateAppointmentStatus(Appointment.findOneAndUpdate(
      {
        appointmentRef: input.appointmentRef,
        email: input.email,
        status: { $in: ["Pending", "Confirmed"] },
        scheduledAt: { $gt: now }
      },
      { $set: { status: "Cancelled" } },
      { returnDocument: "after", runValidators: true }
    ));

    if (cancelledAppointment) {
      return res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully.",
        data: publicAppointmentStatus(cancelledAppointment)
      });
    }

    const existingAppointment = await populateAppointmentStatus(Appointment.findOne({
      appointmentRef: input.appointmentRef,
      email: input.email
    }));

    if (!existingAppointment) {
      return res.status(404).json({
        success: false,
        message: "No appointment was found for those details."
      });
    }

    if (existingAppointment.status === "Cancelled") {
      return res.status(200).json({
        success: true,
        message: "Appointment is already cancelled.",
        data: publicAppointmentStatus(existingAppointment)
      });
    }

    return res.status(409).json({
      success: false,
      message: "This appointment can no longer be cancelled."
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}
