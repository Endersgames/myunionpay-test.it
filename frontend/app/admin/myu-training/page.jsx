"use client";

import { ProtectedRoute } from "@/App";
import { AdminMyuTrainingPage } from "@/lib/legacy-pages";

export default function Page() {
  return (
    <ProtectedRoute>
      <AdminMyuTrainingPage />
    </ProtectedRoute>
  );
}
