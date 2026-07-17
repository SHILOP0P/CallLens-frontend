import {
  AlertTriangle,
  X
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEscapeDismiss } from "./dismissible-layer";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  busy = false,
  variant = "default",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEscapeDismiss(open && !busy, onCancel);

  if (!open) return null;

  return createPortal(
    <div
      className="confirm-dialog-layer"
      role="presentation"
      onPointerDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className={`confirm-dialog ${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onConfirm();
        }}
      >
        <div className="confirm-dialog-icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
        <div className="confirm-dialog-content">
          <div className="confirm-dialog-head">
            <h2>{title}</h2>
            <button className="icon-button" type="button" aria-label="Закрыть" disabled={busy} onClick={onCancel}>
              <X size={18} />
            </button>
          </div>
          <p>{message}</p>
          <div className="confirm-dialog-actions">
            <button
              className={`primary-button small ${variant === "danger" ? "danger-confirm" : ""}`}
              type="submit"
              disabled={busy}
            >
              {busy ? "Выполняю..." : confirmLabel}
            </button>
            <button className="ghost-button small" type="button" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
