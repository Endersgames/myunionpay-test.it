"use client";

import { ProtectedRoute } from "@/App";
import { DashboardPage } from "@/lib/legacy-pages";

export default function Page() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
