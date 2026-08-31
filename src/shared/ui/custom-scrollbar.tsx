import { PointerEvent, RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ThumbMetrics = {
  visible: boolean;
  left: number;
  top: number;
  height: number;
  trackHeight: number;
};

const hiddenMetrics: ThumbMetrics = {
  visible: false,
  left: 0,
  top: 0,
  height: 0,
  trackHeight: 0
};

export function CustomScrollbar({
  targetRef,
  className = "",
  alignToViewport = false,
  inset = 6,
  rightOffset = 8
}: {
  targetRef: RefObject<HTMLElement | null>;
  className?: string;
  alignToViewport?: boolean;
  inset?: number;
  rightOffset?: number;
}) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<ThumbMetrics>(hiddenMetrics);
  const dragRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    let frame = 0;
    let transitionFrame = 0;
    let activeTransitions = 0;
    const measure = () => {
      const thumb = thumbRef.current;
      if (!thumb) return;

      const rect = target.getBoundingClientRect();
      const maxScroll = target.scrollHeight - target.clientHeight;
      if (maxScroll <= 1 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        metricsRef.current = hiddenMetrics;
        thumb.style.opacity = "0";
        thumb.style.pointerEvents = "none";
        return;
      }

      const trackHeight = Math.max(0, rect.height - inset * 2);
      const height = Math.max(56, trackHeight * (target.clientHeight / target.scrollHeight));
      const travel = Math.max(0, trackHeight - height);
      const left = (alignToViewport ? window.innerWidth : rect.right) - rightOffset;
      const top = rect.top + inset + travel * (target.scrollTop / maxScroll);

      metricsRef.current = { visible: true, left, top, height, trackHeight };
      thumb.style.height = `${height}px`;
      thumb.style.opacity = "1";
      thumb.style.pointerEvents = "auto";
      thumb.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    };

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(update);
    const mutationObserver = new MutationObserver(update);
    const shell = target.closest(".app-shell");

    const followTransition = () => {
      if (transitionFrame) return;

      const tick = () => {
        measure();
        if (activeTransitions > 0) {
          transitionFrame = window.requestAnimationFrame(tick);
        } else {
          transitionFrame = 0;
        }
      };

      transitionFrame = window.requestAnimationFrame(tick);
    };

    const startTransition = () => {
      activeTransitions += 1;
      followTransition();
    };

    const stopTransition = () => {
      activeTransitions = Math.max(0, activeTransitions - 1);
      update();
    };

    resizeObserver.observe(target);
    mutationObserver.observe(target, { childList: true, subtree: true });
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    shell?.addEventListener("transitionrun", startTransition);
    shell?.addEventListener("transitionend", stopTransition);
    shell?.addEventListener("transitioncancel", stopTransition);
    update();

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(transitionFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      shell?.removeEventListener("transitionrun", startTransition);
      shell?.removeEventListener("transitionend", stopTransition);
      shell?.removeEventListener("transitioncancel", stopTransition);
    };
  }, [alignToViewport, inset, rightOffset, targetRef]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    const target = targetRef.current;
    if (!target) return;
    dragRef.current = { pointerY: event.clientY, scrollTop: target.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const target = targetRef.current;
    const start = dragRef.current;
    if (!target || !start) return;
    const maxScroll = target.scrollHeight - target.clientHeight;
    const metrics = metricsRef.current;
    const travel = Math.max(1, metrics.trackHeight - metrics.height);
    target.scrollTop = start.scrollTop + ((event.clientY - start.pointerY) / travel) * maxScroll;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return createPortal(
    <div
      ref={thumbRef}
      aria-hidden="true"
      className={`custom-scroll-thumb ${className}`.trim()}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    />,
    document.body
  );
}
