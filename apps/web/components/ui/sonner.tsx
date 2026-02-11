"use client";

import { Toaster } from "sonner";

export const SonnerToaster = () => {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
      }}
    />
  );
};
