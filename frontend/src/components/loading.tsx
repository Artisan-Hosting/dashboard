import React from 'react';

export default function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm bg-white/80 dark:bg-gray-900/60">
      {/* <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 w-full max-w-4xl px-8 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-300 dark:bg-gray-700 rounded" />
        ))}
      </div> */}
      <p className="mt-6 text-gray-700 dark:text-gray-300 text-lg font-medium">Loading data…</p>
    </div>
  );
}
