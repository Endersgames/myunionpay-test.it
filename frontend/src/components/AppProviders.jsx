"use client";

import { AuthProvider } from "@/App";
import ChromePromptBanner from "@/components/ChromePromptBanner";
import MyuMascot from "@/components/MyuMascot";
import PwaBootstrap from "@/components/PwaBootstrap";
import { Toaster } from "sonner";

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <PwaBootstrap />
      <ChromePromptBanner />
      <Toaster
        position="top-center"
        richColors
        theme="light"
        toastOptions={{
          style: {
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.1)",
          },
        }}
      />
      {children}
      <MyuMascot />
    </AuthProvider>
  );
}
