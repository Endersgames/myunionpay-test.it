"use client";

import { ProtectedRoute } from "@/App";
import { MerchantReferredUsersPage } from "@/lib/legacy-pages";

export default function Page() {
  return (
    <ProtectedRoute>
      <MerchantReferredUsersPage />
    </ProtectedRoute>
  );
}
