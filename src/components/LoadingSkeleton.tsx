interface LoadingSkeletonProps {
  type: 'table' | 'list' | 'card';
  rows?: number;
}

export function LoadingSkeleton({ type, rows = 5 }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className="skeleton-table">
        <div className="skeleton-table-header">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton-cell skeleton-shimmer" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-table-row">
            {Array.from({ length: 9 }).map((_, cellIndex) => (
              <div key={cellIndex} className="skeleton-cell skeleton-shimmer" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="skeleton-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-list-item">
            <div className="skeleton-line skeleton-shimmer" style={{ width: '60%' }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-shimmer" style={{ width: '80%', height: '24px' }} />
      <div className="skeleton-line skeleton-shimmer" style={{ width: '60%' }} />
      <div className="skeleton-line skeleton-shimmer" style={{ width: '90%' }} />
    </div>
  );
}
