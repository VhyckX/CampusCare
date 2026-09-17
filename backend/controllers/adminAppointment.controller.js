import Appointment, { appointmentStatuses } from "../models/appointment.model.js";
import Doctor from "../models/doctor.model.js";

const pageSize = 20;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const appointmentRefPattern = /^CC-\d{8}-\d{4,}$/;

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRealDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function normalizeFilters(query) {
  const allowedQueryKeys = new Set(["page", "doctor", "doctorIdentifier", "status", "appointmentDate"]);
  Object.keys(query).forEach(function (key) {
    if (!allowedQueryKeys.has(key)) {
      throw new ApiError(400, "Appointment filter is invalid.");
    }
  });

  const page = Number.parseInt(query.page || "1", 10);
  const doctorFilter = query.doctorIdentifier !== undefined ? query.doctorIdentifier : query.doctor;
  const doctorIdentifier = asTrimmedString(doctorFilter).toLowerCase();
  const status = asTrimmedString(query.status);
  const appointmentDate = asTrimmedString(query.appointmentDate);

  if (query.doctor !== undefined && query.doctorIdentifier !== undefined) {
    throw new ApiError(400, "Doctor filter is invalid.");
  }

  if (!/^[1-9]\d{0,5}$/.test(String(query.page || "1")) || !Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "Page must be a positive number.");
  }

  if (doctorIdentifier && !identifierPattern.test(doctorIdentifier)) {
    throw new ApiError(400, "Doctor filter is invalid.");
  }

  if (status && !appointmentStatuses.includes(status)) {
    throw new ApiError(400, "Status filter is invalid.");
  }

  if (appointmentDate && (!localDatePattern.test(appointmentDate) || !isRealDate(appointmentDate))) {
    throw new ApiError(400, "Appointment date filter must be a real YYYY-MM-DD date.");
  }

  return { page, doctorIdentifier, status, appointmentDate };
}

function buildFilter(filters) {
  const filter = {};

  if (filters.doctorIdentifier) filter.doctorIdentifier = filters.doctorIdentifier;
  if (filters.status) filter.status = filters.status;
  if (filters.appointmentDate) filter.appointmentDate = filters.appointmentDate;

  return filter;
}

function publicAppointmentListItem(appointment) {
  return {
    appointmentRef: appointment.appointmentRef,
    patientName: appointment.fullName,
    serviceName: appointment.service?.name || appointment.serviceIdentifier,
    doctorName: appointment.doctor?.name || appointment.doctorIdentifier,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status
  };
}

function normalizeAppointmentRef(value) {
  const appointmentRef = asTrimmedString(value).toUpperCase();

  if (!appointmentRef || appointmentRef.length > 40 || !appointmentRefPattern.test(appointmentRef)) {
    throw new ApiError(400, "Appointment reference is invalid.");
  }

  return appointmentRef;
}

function normalizeDoctorIdentifier(value) {
  const doctorIdentifier = asTrimmedString(value).toLowerCase();

  if (!doctorIdentifier || doctorIdentifier.length > 80 || !identifierPattern.test(doctorIdentifier)) {
    throw new ApiError(400, "Doctor identifier is invalid.");
  }

  return doctorIdentifier;
}

function normalizeAvailabilityInput(body) {
  if (!body || typeof body.available !== "boolean") {
    throw new ApiError(400, "Doctor availability must be true or false.");
  }

  return body.available;
}

export async function listAdminAppointments(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const filters = normalizeFilters(req.query || {});
    const filter = buildFilter(filters);
    const skip = (filters.page - 1) * pageSize;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .select("appointmentRef fullName service serviceIdentifier doctor doctorIdentifier appointmentDate appointmentTime status -_id")
        .populate({ path: "service", select: "name -_id" })
        .populate({ path: "doctor", select: "name -_id" })
        .sort({ scheduledAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .maxTimeMS(8000)
        .lean(),
      Appointment.countDocuments(filter).maxTimeMS(8000)
    ]);

    res.status(200).json({
      success: true,
      data: {
        appointments: appointments.map(publicAppointmentListItem),
        pagination: {
          page: filters.page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      }
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

export async function approveAdminAppointment(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const appointmentRef = normalizeAppointmentRef(req.params.appointmentRef);
    const now = new Date();

    const approvedAppointment = await Appointment.findOneAndUpdate(
      {
        appointmentRef,
        status: "Pending",
        scheduledAt: { $gt: now }
      },
      { $set: { status: "Confirmed" } },
      {
        returnDocument: "after",
        runValidators: true
      }
    )
      .select("appointmentRef status scheduledAt -_id")
      .maxTimeMS(8000)
      .lean();

    if (approvedAppointment) {
      return res.status(200).json({
        success: true,
        message: "Appointment approved successfully.",
        data: {
          appointmentRef: approvedAppointment.appointmentRef,
          status: approvedAppointment.status
        }
      });
    }

    const existingAppointment = await Appointment.findOne({ appointmentRef })
      .select("appointmentRef status scheduledAt -_id")
      .maxTimeMS(8000)
      .lean();

    if (!existingAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment was not found."
      });
    }

    if (existingAppointment.status === "Confirmed" && existingAppointment.scheduledAt > now) {
      return res.status(200).json({
        success: true,
        message: "Appointment is already approved.",
        data: {
          appointmentRef: existingAppointment.appointmentRef,
          status: existingAppointment.status
        }
      });
    }

    return res.status(409).json({
      success: false,
      message: "Only future pending appointments can be approved."
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

export async function cancelAdminAppointment(req, res, next) {
  res.set("Cache-Control", "no-store");
  try {
    const appointmentRef = normalizeAppointmentRef(req.params.appointmentRef);
    const existing = await Appointment.findOne({ appointmentRef })
      .select("appointmentRef status scheduledAt -_id").maxTimeMS(8000).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Appointment was not found." });
    }
    if (existing.status === "Cancelled") {
      return res.status(200).json({ success: true, message: "Appointment is already cancelled.", data: { appointmentRef, status: "Cancelled" } });
    }
    const now = new Date();
    if (!["Pending", "Confirmed"].includes(existing.status) || !(existing.scheduledAt > now)) {
      return res.status(409).json({ success: false, message: "Only future pending or confirmed appointments can be cancelled." });
    }
    // Match the observed status so approval or completion between read and update wins.
    const cancelled = await Appointment.findOneAndUpdate(
      { appointmentRef, status: existing.status, scheduledAt: { $gt: new Date() } },
      { $set: { status: "Cancelled" } },
      { returnDocument: "after", runValidators: true }
    ).select("appointmentRef status -_id").maxTimeMS(8000).lean();
    if (!cancelled) {
      return res.status(409).json({ success: false, message: "Appointment changed or is no longer eligible. Refresh the list before trying again." });
    }
    return res.status(200).json({ success: true, message: "Appointment cancelled successfully.", data: { appointmentRef: cancelled.appointmentRef, status: cancelled.status } });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function completeAdminAppointment(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const appointmentRef = normalizeAppointmentRef(req.params.appointmentRef);
    const completed = await Appointment.findOneAndUpdate(
      { appointmentRef, status: "Confirmed", scheduledAt: { $lte: new Date() } },
      { $set: { status: "Completed" } },
      { returnDocument: "after", runValidators: true }
    ).select("appointmentRef status -_id").maxTimeMS(8000).lean();

    const appointment = completed || await Appointment.findOne({ appointmentRef })
      .select("appointmentRef status -_id").maxTimeMS(8000).lean();

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment was not found." });
    }

    if (appointment.status !== "Completed") {
      return res.status(409).json({
        success: false,
        message: "Only confirmed appointments whose scheduled time has arrived can be marked completed."
      });
    }

    return res.status(200).json({
      success: true,
      message: completed ? "Appointment marked completed." : "Appointment is already completed.",
      data: { appointmentRef: appointment.appointmentRef, status: appointment.status }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function setDoctorAvailability(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const doctorIdentifier = normalizeDoctorIdentifier(req.params.doctorIdentifier);
    const available = normalizeAvailabilityInput(req.body || {});

    const doctor = await Doctor.findOneAndUpdate(
      { doctorIdentifier },
      { $set: { available } },
      {
        returnDocument: "after",
        runValidators: true
      }
    )
      .select("doctorIdentifier name role room available serviceIdentifier service -_id")
      .populate({ path: "service", select: "name serviceIdentifier -_id" })
      .maxTimeMS(8000)
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor was not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: available ? "Doctor is now available for new bookings." : "Doctor is now unavailable for new bookings.",
      data: {
        doctorIdentifier: doctor.doctorIdentifier,
        name: doctor.name,
        role: doctor.role,
        room: doctor.room,
        available: doctor.available,
        serviceIdentifier: doctor.serviceIdentifier,
        serviceName: doctor.service?.name || doctor.serviceIdentifier
      }
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
