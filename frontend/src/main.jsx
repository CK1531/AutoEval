import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./style.css";
import { UserProvider } from "./context/UserContext";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <div className="g-grain" aria-hidden="true" />
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>
);