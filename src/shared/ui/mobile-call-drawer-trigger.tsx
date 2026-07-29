import { ListFilter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function MobileCallDrawerTrigger({
  open,
  onToggle
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [showHeaderTrigger, setShowHeaderTrigger] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    if (!anchor || !mobileQuery.matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowHeaderTrigger(!entry.isIntersecting),
      { rootMargin: "-84px 0px 0px" }
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="mobile-call-drawer-trigger-anchor" ref={anchorRef}>
        <button
          className="ghost-button mobile-call-drawer-trigger"
          type="button"
          aria-controls="mobile-call-drawer"
          aria-expanded={open}
          onClick={onToggle}
        >
          <ListFilter size={18} />
          <span>Звонки и фильтры</span>
        </button>
      </div>
      {createPortal(
        <button
          className={`mobile-call-drawer-header-trigger ${showHeaderTrigger || open ? "visible" : ""} ${open ? "drawer-open" : ""}`}
          type="button"
          aria-label={open ? "Закрыть звонки и фильтры" : "Открыть звонки и фильтры"}
          aria-controls="mobile-call-drawer"
          aria-expanded={open}
          tabIndex={showHeaderTrigger || open ? 0 : -1}
          onClick={onToggle}
        >
          <ListFilter size={20} />
        </button>,
        document.body
      )}
    </>
  );
}
