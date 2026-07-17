import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FeedbackForm from "./FeedbackForm";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeedbackForm />
  </StrictMode>,
);
