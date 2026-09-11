import mongoose from "mongoose";

const { Schema } = mongoose;

const appointmentStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
const appointmentReferencePattern = /^CC-\d{8}-\d{4,}$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;

const appointmentSchema = new Schema(
  {
    appointmentRef: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      match: appointmentReferencePattern
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 25,
      match: phonePattern
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true
    },
    serviceIdentifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true
    },
    doctorIdentifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
      match: localDatePattern
    },
    appointmentTime: {
      type: String,
      required: true,
      trim: true,
      match: localTimePattern
    },
    scheduledAt: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      required: true,
      default: "Africa/Lagos",
      enum: ["Africa/Lagos"]
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500
    },
    status: {
      type: String,
      enum: appointmentStatuses,
      default: "Pending",
      required: true
    }
  },
  { timestamps: true }
);

appointmentSchema.index({ appointmentRef: 1 }, { unique: true });
appointmentSchema.index(
  { doctor: 1, scheduledAt: 1 },
  {
    unique: true,
    name: "unique_active_doctor_slot",
    partialFilterExpression: { status: { $in: ["Pending", "Confirmed"] } }
  }
);
appointmentSchema.index({ status: 1, scheduledAt: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export { appointmentStatuses };
export default Appointment;
