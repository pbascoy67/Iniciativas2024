"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">The page couldn&apos;t load. This usually means the database is still starting or is unreachable. Your data is not affected.</p>
      <button type="button" className="primary" onClick={reset}>Try again</button>
    </div>
  );
}
