"use client";

import { useLayout } from "@/app/context/LayoutContext";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const TOAST_DURATION = 8000; // 8 segundos

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useLayout();
  const theme = isDarkMode ? "dark" : "light";

  return (
    <SonnerToaster
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      expand={false}
      richColors={false}
      closeButton={true}
      duration={TOAST_DURATION}
      visibleToasts={5}
      toastOptions={{
        duration: TOAST_DURATION,
        style: {
          opacity: "1 !important",
        },
      }}
      {...props}
    />
  );
};

const toast = {
  success: (message: string, options?: any) => {
    return sonnerToast.success(message, {
      duration: TOAST_DURATION,
      dismissible: false,
      ...options,
    });
  },
  error: (message: string, options?: any) => {
    return sonnerToast.error(message, {
      duration: TOAST_DURATION,
      dismissible: false,
      ...options,
    });
  },
  warning: (message: string, options?: any) => {
    return sonnerToast.warning(message, {
      duration: TOAST_DURATION,
      dismissible: false,
      ...options,
    });
  },
  info: (message: string, options?: any) => {
    return sonnerToast.info(message, {
      duration: TOAST_DURATION,
      dismissible: false,
      ...options,
    });
  },
  default: sonnerToast,
};

export { Toaster, toast };
