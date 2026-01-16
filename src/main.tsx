import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

function formatError(err: unknown): string {
  if (!err) return "Ocurrió un error inesperado";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "Ocurrió un error";
  if (typeof err === "object") {
    const e: any = err;
    return (
      e.message ||
      e.error_description ||
      e.code ||
      JSON.stringify(e)
    );
  }
  return String(err);
}

// Captura rechazos de promesas no manejados
window.addEventListener("unhandledrejection", (event) => {
  const message = formatError(event.reason);
  console.error("Unhandled rejection:", event.reason);
  toast.error(message);
});

// Captura errores globales de runtime
window.addEventListener("error", (event) => {
  const base = (event as ErrorEvent);
  const message = formatError(base.error || base.message);
  console.error("Global error:", base.error || base.message);
  toast.error(message);
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" closeButton richColors />
  </React.StrictMode>
);