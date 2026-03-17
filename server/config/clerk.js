const { clerkMiddleware } = require("@clerk/express");

const initClerk = () => {
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn("CLERK_SECRET_KEY not set. Auth middleware disabled.");
    return null;
  }
  return clerkMiddleware();
};

module.exports = { initClerk };
