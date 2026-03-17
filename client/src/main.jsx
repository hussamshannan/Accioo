import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { ui } from "@clerk/ui";
import "./index.css";
import "./assets/style/app.scss";
import App from "./App.jsx";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Auth will not work. " +
    "Add it to client/.env to enable authentication."
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPubKey || "pk_test_placeholder"} ui={ui}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
