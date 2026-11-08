"use client";

import { Button } from "./ui"; // Use the mate's custom button component

export function ExportProtocolButton({ findingId }: { findingId: string }) {
  const handleExport = () => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
    window.open(`${base}/findings/${findingId}/export`, "_blank");
  };

  return (
    <Button variant="secondary" onClick={handleExport}>
      Export Lab Protocol
    </Button>
  );
}
