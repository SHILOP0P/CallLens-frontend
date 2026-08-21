import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type TransientAlertTone = "error" | "success" | "info";

function alertViewport() {
  let viewport = document.getElementById("app-alert-viewport");
  if (!viewport) {
    viewport = document.createElement("div");
    viewport.id = "app-alert-viewport";
    viewport.className = "app-alert-viewport";
    viewport.setAttribute("aria-live", "polite");
    document.body.appendChild(viewport);
  }
  return viewport;
}

export function TransientAlert({ message, tone = "error", duration = 1800 }: { message: string; tone?: TransientAlertTone; duration?: number }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, message]);

  if (!visible || !message) return null;
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return createPortal(
    <div className={`app-transient-alert is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={19} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" aria-label="Закрыть уведомление" onClick={() => setVisible(false)}><X size={16} /></button>
    </div>,
    alertViewport()
  );
}
