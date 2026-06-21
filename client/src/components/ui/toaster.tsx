"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#111",
          border: "1px solid #222",
          color: "#fff",
        },
      }}
    />
  );
}
