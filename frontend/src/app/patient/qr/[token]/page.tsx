import React, { Suspense } from "react";
import PatientQRClient from "./PatientQRClient";

export default function PatientQRPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#17212F] flex items-center justify-center text-white text-sm">
          Loading CareOps Bedside Portal...
        </div>
      }
    >
      <PatientQRClient paramsPromise={params} />
    </Suspense>
  );
}
