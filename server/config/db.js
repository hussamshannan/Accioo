const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn("MONGODB_URI not set. Database features disabled.");
      // Disable buffering so DB calls fail immediately instead of hanging
      mongoose.set("bufferCommands", false);
      return;
    }

    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    mongoose.set("bufferCommands", false);
    // Don't crash the server — allow socket-only mode
  }
};

module.exports = connectDB;
