"use client";

import { ProtectedRoute } from "@/App";
import { PaymentPage } from "@/lib/legacy-pages";

export default function Page() {
  return (
    <ProtectedRoute>
      <PaymentPage />
    </ProtectedRoute>
  );
}
