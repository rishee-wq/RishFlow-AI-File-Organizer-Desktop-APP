
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { pythonAPI } from "./api/pywebview";

  // Initialize Python API connection
  pythonAPI.initialize().catch(() => {
    console.log("Running in development mode - Python backend not available");
  });

  createRoot(document.getElementById("root")!).render(<App />);
  