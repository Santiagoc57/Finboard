import { Suspense } from "react";

import { DetailPageClient } from "@/components/DetailPageClient";

export default function DetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1400px] px-6 py-10 text-sm text-text-muted">Cargando detalle...</div>}>
      <DetailPageClient />
    </Suspense>
  );
}
