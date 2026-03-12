"use client";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700">
          API Documentation (Swagger)
        </div>
        <div className="p-2">
          <SwaggerUI url="/api/swagger" />
        </div>
      </div>
    </div>
  );
}

