import mongoose from "mongoose";

const { Schema } = mongoose;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const openingWindowSchema = new Schema(
  {
    days: {
      type: [String],
      required: true,
      validate: {
        validator(days) {
          return Array.isArray(days) && days.length > 0;
        },
        message: "At least one opening day is required."
      }
    },
    is24Hours: {
      type: Boolean,
      default: false
    },
    opensAt: {
      type: String,
      required() {
        return !this.is24Hours;
      },
      match: timePattern
    },
    closesAt: {
      type: String,
      required() {
        return !this.is24Hours;
      },
      match: timePattern
    }
  },
  { _id: false }
);

const serviceSchema = new Schema(
  {
    serviceIdentifier: {
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
    displayHours: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    openingHours: {
      type: [openingWindowSchema],
      required: true,
      validate: {
        validator(hours) {
          return Array.isArray(hours) && hours.length > 0;
        },
        message: "At least one opening-hours rule is required."
      }
    }
  },
  { timestamps: true }
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;
