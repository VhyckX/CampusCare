import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { configureDnsServers } from "../config/dns.js";
import Doctor from "../models/doctor.model.js";
import Service from "../models/service.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = resolve(__dirname, "..");

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const demoCatalog = [
  {
    serviceIdentifier: "general-consultation",
    name: "General Consultation",
    displayHours: "Mon - Fri, 8:00 AM - 4:00 PM",
    openingHours: [{ days: weekdays, opensAt: "08:00", closesAt: "16:00" }],
    doctors: [
      { doctorIdentifier: "dr-amina-bello", name: "Dr. Amina Bello", role: "General Practitioner", room: "Room 1", available: true },
      { doctorIdentifier: "dr-daniel-okafor", name: "Dr. Daniel Okafor", role: "Student Health Physician", room: "Room 2", available: true }
    ]
  },
  {
    serviceIdentifier: "dental-care",
    name: "Dental Care",
    displayHours: "Tue - Thu, 9:00 AM - 2:00 PM",
    openingHours: [{ days: ["Tuesday", "Wednesday", "Thursday"], opensAt: "09:00", closesAt: "14:00" }],
    doctors: [
      { doctorIdentifier: "dr-maryam-sani", name: "Dr. Maryam Sani", role: "Dental Officer", room: "Dental Suite", available: true },
      { doctorIdentifier: "dr-peter-ade", name: "Dr. Peter Ade", role: "Oral Health Consultant", room: "Dental Suite", available: false }
    ]
  },
  {
    serviceIdentifier: "eye-care",
    name: "Eye Care",
    displayHours: "Mon - Wed, 10:00 AM - 3:00 PM",
    openingHours: [{ days: ["Monday", "Tuesday", "Wednesday"], opensAt: "10:00", closesAt: "15:00" }],
    doctors: [
      { doctorIdentifier: "dr-ifeoma-nwosu", name: "Dr. Ifeoma Nwosu", role: "Optometrist", room: "Vision Room", available: true },
      { doctorIdentifier: "dr-samuel-ibrahim", name: "Dr. Samuel Ibrahim", role: "Eye Care Specialist", room: "Vision Room", available: true }
    ]
  },
  {
    serviceIdentifier: "emergency-support",
    name: "Emergency Support",
    displayHours: "Daily, 24/7 Support",
    openingHours: [{ days: allDays, is24Hours: true }],
    doctors: [
      { doctorIdentifier: "nurse-grace-ali", name: "Nurse Grace Ali", role: "Emergency Support Lead", room: "Emergency Desk", available: true },
      { doctorIdentifier: "dr-victor-essien", name: "Dr. Victor Essien", role: "Urgent Care Doctor", room: "Emergency Desk", available: false }
    ]
  }
];

export async function validateCatalog() {
  const fakeServiceId = new mongoose.Types.ObjectId();

  for (const serviceData of demoCatalog) {
    const service = new Service({
      serviceIdentifier: serviceData.serviceIdentifier,
      name: serviceData.name,
      displayHours: serviceData.displayHours,
      openingHours: serviceData.openingHours
    });

    await service.validate();

    for (const doctorData of serviceData.doctors) {
      const doctor = new Doctor({
        ...doctorData,
        service: fakeServiceId,
        serviceIdentifier: serviceData.serviceIdentifier
      });

      await doctor.validate();
    }
  }
}

export async function seedCatalog() {
  const result = {
    servicesInserted: 0,
    servicesSkipped: 0,
    doctorsInserted: 0,
    doctorsSkipped: 0
  };

  for (const serviceData of demoCatalog) {
    let service = await Service.findOne({ serviceIdentifier: serviceData.serviceIdentifier });

    if (service) {
      result.servicesSkipped += 1;
    } else {
      service = await Service.create({
        serviceIdentifier: serviceData.serviceIdentifier,
        name: serviceData.name,
        displayHours: serviceData.displayHours,
        openingHours: serviceData.openingHours
      });
      result.servicesInserted += 1;
    }

    for (const doctorData of serviceData.doctors) {
      const existingDoctor = await Doctor.findOne({ doctorIdentifier: doctorData.doctorIdentifier });

      if (existingDoctor) {
        result.doctorsSkipped += 1;
        continue;
      }

      await Doctor.create({
        ...doctorData,
        service: service._id,
        serviceIdentifier: service.serviceIdentifier
      });
      result.doctorsInserted += 1;
    }
  }

  return result;
}

async function runSeed() {
  try {
    dotenv.config({ path: resolve(backendRoot, ".env") });
    configureDnsServers();
    await connectDatabase();
    await validateCatalog();

    const result = await seedCatalog();
    console.log("Catalog seed finished.");
    console.log(`Services inserted: ${result.servicesInserted}`);
    console.log(`Services skipped: ${result.servicesSkipped}`);
    console.log(`Doctors inserted: ${result.doctorsInserted}`);
    console.log(`Doctors skipped: ${result.doctorsSkipped}`);
  } catch (error) {
    console.error(error.message || "Catalog seed failed.");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed();
}
