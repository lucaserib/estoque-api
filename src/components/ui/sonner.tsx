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
      richColors
      closeButton={false}
      duration={TOAST_DURATION}
      visibleToasts={5}
      className="toaster group"
      toastOptions={{
        duration: TOAST_DURATION,
        classNames: {
          toast:
            "group toast group-[.toaster]:border group-[.toaster]:bg-white group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:dark:bg-gray-800 group-[.toaster]:dark:border-gray-700",
          title: "font-medium text-sm text-gray-900 dark:text-gray-100",
          description: "text-xs text-gray-600 dark:text-gray-400 mt-1",
          actionButton:
            "bg-indigo-500 text-white text-xs font-medium py-1 px-3 rounded-md",
          cancelButton:
            "bg-gray-300 text-gray-800 text-xs font-medium py-1 px-3 rounded-md",
          closeButton:
            "absolute top-2 right-2 opacity-70 hover:opacity-100 transition-opacity",
          success:
            "!bg-emerald-50 !border-emerald-200 dark:!bg-emerald-900/20 dark:!border-emerald-800/30",
          error:
            "!bg-red-50 !border-red-200 dark:!bg-red-900/20 dark:!border-red-800/30",
          warning:
            "!bg-amber-50 !border-amber-200 dark:!bg-amber-900/20 dark:!border-amber-800/30",
          info: "!bg-blue-50 !border-blue-200 dark:!bg-blue-900/20 dark:!border-blue-800/30",
        },
      }}
      {...props}
    />
  );
};

// Tipos de opções customizadas para o toast
type ToastOptions = {
  duration?: number;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
  dismissible?: boolean;
};

const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      duration: TOAST_DURATION,
      dismissible: true,
      ...options,
    });
  },
  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      duration: TOAST_DURATION,
      dismissible: true,
      ...options,
    });
  },
  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      duration: TOAST_DURATION,
      dismissible: true,
      ...options,
    });
  },
  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      duration: TOAST_DURATION,
      dismissible: true,
      ...options,
    });
  },
  default: sonnerToast,
};

export { Toaster, toast };
