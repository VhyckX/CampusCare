import Doctor from "../models/doctor.model.js";
import Service from "../models/service.model.js";

const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function publicService(service) {
  return {
    serviceIdentifier: service.serviceIdentifier,
    name: service.name,
    displayHours: service.displayHours,
    openingHours: service.openingHours
  };
}

function publicDoctor(doctor) {
  return {
    doctorIdentifier: doctor.doctorIdentifier,
    name: doctor.name,
    role: doctor.role,
    room: doctor.room,
    available: doctor.available,
    serviceIdentifier: doctor.serviceIdentifier,
    service: doctor.service ? publicService(doctor.service) : null
  };
}

export async function getServices(req, res, next) {
  try {
    const services = await Service.find({})
      .select("serviceIdentifier name displayHours openingHours -_id")
      .sort({ serviceIdentifier: 1 })
      .maxTimeMS(8000)
      .lean();

    res.status(200).json({
      success: true,
      data: services.map(publicService)
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctors(req, res, next) {
  const { serviceIdentifier } = req.query;

  if (serviceIdentifier !== undefined && !identifierPattern.test(String(serviceIdentifier))) {
    return res.status(400).json({
      success: false,
      message: "Invalid serviceIdentifier filter."
    });
  }

  try {
    const filter = serviceIdentifier ? { serviceIdentifier } : {};
    const doctors = await Doctor.find(filter)
      .select("doctorIdentifier name role room available serviceIdentifier service -_id")
      .populate({
        path: "service",
        select: "serviceIdentifier name displayHours openingHours -_id"
      })
      .sort({ serviceIdentifier: 1, doctorIdentifier: 1 })
      .maxTimeMS(8000)
      .lean();

    res.status(200).json({
      success: true,
      data: doctors.map(publicDoctor)
    });
  } catch (error) {
    next(error);
  }
}
