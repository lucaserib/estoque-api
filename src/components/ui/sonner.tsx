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
            "group toast group-[.toaster]:border group-[.toaster]:bg-card group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "font-medium text-sm text-foreground",
          description: "text-xs text-muted-foreground mt-1",
          actionButton:
            "bg-primary text-primary-foreground text-xs font-medium py-1 px-3 rounded-md",
          cancelButton:
            "bg-muted text-foreground text-xs font-medium py-1 px-3 rounded-md",
          closeButton:
            "absolute top-2 right-2 opacity-70 hover:opacity-100 transition-opacity",
          success: "!bg-success/10 !border-success/30",
          error: "!bg-destructive/10 !border-destructive/30",
          warning: "!bg-warning/10 !border-warning/30",
          info: "!bg-info/10 !border-info/30",
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
