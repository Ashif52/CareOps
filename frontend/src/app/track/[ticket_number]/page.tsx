import React, { Suspense } from "react";
import TrackClient from "./TrackClient";

export default function TrackPage({
  params,
}: {
  params: Promise<{ ticket_number: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#17212F] flex items-center justify-center text-white text-sm">
          Loading Service Status...
        </div>
      }
    >
      <TrackClient paramsPromise={params} />
    </Suspense>
  );
}
