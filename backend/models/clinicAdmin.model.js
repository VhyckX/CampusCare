import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicAdminSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      default: "clinic-admin",
      enum: ["clinic-admin"],
      unique: true,
      immutable: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    active: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const ClinicAdmin = mongoose.model("ClinicAdmin", clinicAdminSchema);

export default ClinicAdmin;
