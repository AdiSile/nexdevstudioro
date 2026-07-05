'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled error caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong!</h2>
      {error.message && (
        <p className="error-message">
          <strong>Details:</strong> {error.message}
        </p>
      )}
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}