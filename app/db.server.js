import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  console.warn('Warning: "MONGODB_URI" environment variable is missing. Database commands will fail.');
}

const uri = process.env.MONGODB_URI || "";

let connection;

if (process.env.NODE_ENV === "development") {
  if (!global.__mongoose) {
    global.__mongoose = mongoose.connect(uri);
  }
  connection = global.__mongoose;
} else {
  connection = mongoose.connect(uri);
}

export default connection;
