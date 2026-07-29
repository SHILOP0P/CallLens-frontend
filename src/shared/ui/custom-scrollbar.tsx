import { PointerEvent, RefObject, useEffect, useRef, useState } from "react";
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
  className = ""
}: {
  targetRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [metrics, setMetrics] = useState<ThumbMetrics>(hiddenMetrics);
  const dragRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const maxScroll = target.scrollHeight - target.clientHeight;
        if (maxScroll <= 1 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) {
          setMetrics(hiddenMetrics);
          return;
        }

        const inset = 6;
        const trackHeight = Math.max(0, rect.height - inset * 2);
        const height = Math.max(56, trackHeight * (target.clientHeight / target.scrollHeight));
        const travel = Math.max(0, trackHeight - height);
        const top = rect.top + inset + travel * (target.scrollTop / maxScroll);

        setMetrics({
          visible: true,
          left: rect.right - 8,
          top,
          height,
          trackHeight
        });
      });
    };

    const resizeObserver = new ResizeObserver(update);
    const mutationObserver = new MutationObserver(update);
    resizeObserver.observe(target);
    mutationObserver.observe(target, { childList: true, subtree: true });
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [targetRef]);

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
    const travel = Math.max(1, metrics.trackHeight - metrics.height);
    target.scrollTop = start.scrollTop + ((event.clientY - start.pointerY) / travel) * maxScroll;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!metrics.visible) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className={`custom-scroll-thumb ${className}`.trim()}
      style={{
        height: `${metrics.height}px`,
        left: `${metrics.left}px`,
        top: `${metrics.top}px`
      }}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    />,
    document.body
  );
}
