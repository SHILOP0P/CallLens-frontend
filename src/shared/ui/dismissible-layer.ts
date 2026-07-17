import { useEffect } from "react";
import type { RefObject } from "react";

export function useEscapeDismiss(open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onDismiss]);
}

export function useDismissibleLayer(
  open: boolean,
  layerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !layerRef.current?.contains(event.target)) {
        onDismiss();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [layerRef, onDismiss, open]);
}
