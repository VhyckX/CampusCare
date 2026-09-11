import mongoose from "mongoose";

const { Schema } = mongoose;

const doctorSchema = new Schema(
  {
    doctorIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    room: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    available: {
      type: Boolean,
      default: true
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
    }
  },
  { timestamps: true }
);

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
