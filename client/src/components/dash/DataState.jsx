import { Skeleton } from '../Skeleton';

/** Standard loading / error wrapper for dashboard data: <DataState loading error onRetry>{content}</DataState>. */
export default function DataState({ loading, error, onRetry, children, rows = 4 }) {
  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        {error}{' '}
        {onRetry ? <button type="button" className="btn btn--sm btn--ghost" onClick={onRetry}>Try again</button> : null}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h={46} radius="12px" />)}
      </div>
    );
  }
  return children;
}
