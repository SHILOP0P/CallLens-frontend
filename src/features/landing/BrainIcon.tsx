import { useId, type CSSProperties, type ComponentPropsWithoutRef } from "react";

type BrainIconProps = ComponentPropsWithoutRef<"span"> & {
  size?: number;
};

type BrainIconStyle = CSSProperties & {
  "--brain-icon-size"?: string;
};

const leftHemisphere =
  "M47 24c-3.4-5.8-12.8-5.7-16.2 1.8-6.6.4-11.4 5.8-10.8 12.6-5.4 4-7.3 11.8-3.7 18.3-2.2 6.7 2.9 13.8 10.6 14.6 1.5 6.5 8.8 10.2 15 6.5 4.7-2.8 7.1-7.3 7.1-12.8V31.3c0-3-0.7-5.4-2-7.3Z";
const rightHemisphere =
  "M49 24.2c3.7-5.5 12.8-5.1 16 2.3 6.3.8 10.8 6.4 10 13.1 5.2 4.3 6.8 12 2.9 18.1 2.5 6.9-2.6 14.3-10.2 15.1-1.2 6.7-8.4 10.8-14.8 7.1-4.8-2.7-7.3-7.4-7.3-13V31.5c0-3 1.1-5.5 3.4-7.3Z";
const centerLine = "M48 25.5v45.7c0 3.4 1.1 6.1 3.3 8";
const leftFolds =
  "M35.2 32.7c-5.4.2-9 4-8.6 8.8.3 3.6 3.1 6.4 7.1 7M44.4 39.2c-4.7-.3-8.2 2.4-8.4 6.7M29.4 55.8c5.5-2.6 11-.9 13.7 4.3M26.9 66.8c4.4-2.5 9.2-1.6 12.1 2.3M42.5 70.4c-4.6-.1-7.8-3.1-7.7-7.2";
const rightFolds =
  "M60.8 32.9c5.3.6 8.5 4.7 7.7 9.4-.6 3.4-3.4 5.9-7.1 6.3M52.4 39.5c4.8-.7 8.5 1.8 8.9 6.1M66.8 55.9c-5.2-2.8-10.7-1.3-13.7 3.8M69.1 66.2c-4.2-2.2-8.9-1-11.6 2.5M53.6 70.8c4.5-.4 7.5-3.7 7.1-7.8";

export function BrainIcon({ className = "", size, style, ...props }: BrainIconProps) {
  const rawId = useId().replace(/:/g, "");
  const glowId = `brainGlow-${rawId}`;
  const strokeId = `brainStroke-${rawId}`;
  const iconStyle: BrainIconStyle = {
    ...style,
    ...(size ? { "--brain-icon-size": `${size}px` } : {})
  };

  return (
    <span className={`brain-icon ${className}`.trim()} style={iconStyle} {...props}>
      <span className="brain-icon-radial" aria-hidden="true" />
      <svg className="brain-icon-svg" viewBox="0 0 96 96" aria-hidden={props["aria-hidden"] ?? true}>
        <defs>
          <linearGradient id={strokeId} x1="24" x2="72" y1="22" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--brain-icon-hot, #d8ffc4)" />
            <stop offset="52%" stopColor="var(--brain-icon-stroke, #b9ff82)" />
            <stop offset="100%" stopColor="var(--brain-icon-deep, #86db6b)" />
          </linearGradient>
          <filter id={glowId} x="-45%" y="-45%" width="190%" height="190%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="softGlow" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="wideGlow" />
            <feColorMatrix
              in="wideGlow"
              type="matrix"
              values="0 0 0 0 0.54  0 0 0 0 1  0 0 0 0 0.27  0 0 0 0.42 0"
              result="limeGlow"
            />
            <feMerge>
              <feMergeNode in="limeGlow" />
              <feMergeNode in="softGlow" />
            </feMerge>
          </filter>
        </defs>

        <g className="brain-icon-glow" filter={`url(#${glowId})`} stroke={`url(#${strokeId})`}>
          <path d={leftHemisphere} />
          <path d={rightHemisphere} />
          <path d={centerLine} />
          <path d={leftFolds} />
          <path d={rightFolds} />
        </g>

        <g className="brain-icon-mark" stroke={`url(#${strokeId})`}>
          <path className="brain-icon-outline" d={leftHemisphere} />
          <path className="brain-icon-outline" d={rightHemisphere} />
          <path className="brain-icon-midline" d={centerLine} />
          <path className="brain-icon-sulcus" d={leftFolds} />
          <path className="brain-icon-sulcus" d={rightFolds} />
        </g>
      </svg>
    </span>
  );
}
