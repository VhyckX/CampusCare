import "../config/env.js";
import bcrypt from "bcrypt";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { configureDnsServers } from "../config/dns.js";
import ClinicAdmin from "../models/clinicAdmin.model.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function hiddenQuestion(prompt) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("A TTY is required for the hidden password prompt.");
  }

  output.write(prompt);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      input.setRawMode(false);
      input.off("data", onData);
      output.write("\n");
    }

    function onData(buffer) {
      const text = buffer.toString("utf8");

      if (text === "\u0003") {
        cleanup();
        reject(new Error("Clinic admin account creation cancelled."));
        return;
      }

      if (text === "\r" || text === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (text === "\b" || text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += text;
    }

    input.on("data", onData);
  });
}

function validateCredentials({ name, email, password, confirmPassword }) {
  if (!name || name.length < 2 || name.length > 100) {
    throw new Error("Admin name is required and must be 2 to 100 characters.");
  }

  if (!emailPattern.test(email) || email.length > 120) {
    throw new Error("A valid email address is required.");
  }

  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be 8 to 128 characters.");
  }

  if (password !== confirmPassword) {
    throw new Error("Password confirmation did not match.");
  }
}

export async function createAdminAccount({ name, email, password }) {
  const existingAdmin = await ClinicAdmin.findOne({
    $or: [{ singletonKey: "clinic-admin" }, { email }]
  }).maxTimeMS(8000);

  if (existingAdmin) {
    throw new Error("A clinic admin account already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return ClinicAdmin.create({
    singletonKey: "clinic-admin",
    name,
    email,
    passwordHash
  });
}

async function run() {
  let rl;

  try {
    rl = createInterface({ input, output });

    const name = normalizeName(readArg("name") || await rl.question("Clinic admin name: "));
    const email = normalizeEmail(readArg("email") || await rl.question("Clinic admin email: "));
    const password = await hiddenQuestion("Password: ");
    const confirmPassword = await hiddenQuestion("Confirm password: ");

    validateCredentials({ name, email, password, confirmPassword });

    configureDnsServers();
    await connectDatabase({ dbName: process.env.MONGODB_DB_NAME || "campuscare" });
    await createAdminAccount({ name, email, password });

    console.log("Clinic admin account created.");
  } catch (error) {
    console.error(error.message || "Clinic admin account creation failed.");
    process.exitCode = 1;
  } finally {
    if (rl) rl.close();
    await disconnectDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
