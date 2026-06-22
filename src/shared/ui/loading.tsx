
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`skeleton-line ${className}`} />;
}

export function TextBlockSkeleton({ rows }: { rows: number }) {
  return (
    <div className="text-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonLine key={index} className={index === rows - 1 ? "short" : ""} />
      ))}
    </div>
  );
}

export function CallListSkeleton({ compact, count }: { compact?: boolean; count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className={`call-row skeleton-row ${compact ? "compact" : ""}`} key={index}>
          <span className="skeleton-circle" />
          <span className="skeleton-row-copy">
            <SkeletonLine />
            <SkeletonLine className="short" />
          </span>
          {!compact && <span className="skeleton-pill" />}
          {!compact && <span className="skeleton-dot" />}
        </div>
      ))}
    </>
  );
}

export function CallDetailSkeleton() {
  return (
    <>
      <div className="panel-heading large">
        <SkeletonLine className="title" />
        <SkeletonLine className="button" />
      </div>
      <div className="selected-call-card skeleton-card">
        <span className="skeleton-circle large" />
        <span className="skeleton-row-copy">
          <SkeletonLine className="short" />
          <SkeletonLine className="title" />
          <SkeletonLine />
        </span>
        <span className="skeleton-pill" />
        <span className="skeleton-dot" />
      </div>
      <div className="status-timeline skeleton-timeline">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="timeline-step" key={index}>
            <span className="skeleton-circle" />
            <SkeletonLine className="short" />
            <SkeletonLine className="tiny" />
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <InfoCardSkeleton />
        <InfoCardSkeleton />
      </div>
    </>
  );
}

export function InfoCardSkeleton() {
  return (
    <div className="info-card">
      <div className="card-title">
        <SkeletonLine className="title" />
        <span className="skeleton-pill" />
      </div>
      <TextBlockSkeleton rows={5} />
      <SkeletonLine className="button" />
    </div>
  );
}

export function AnalysisResultSkeleton() {
  return (
    <div className="analysis-user-summary">
      <TextBlockSkeleton rows={5} />
      <div className="topic-list skeleton-topic-list">
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
      </div>
      <TextBlockSkeleton rows={2} />
    </div>
  );
}

export function InstructionListSkeleton({ count }: { count: number }) {
  return (
    <div className="instruction-mini-list">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-circle small" />
          <span className="skeleton-row-copy">
            <SkeletonLine />
            <SkeletonLine className="short" />
          </span>
          <span className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}
