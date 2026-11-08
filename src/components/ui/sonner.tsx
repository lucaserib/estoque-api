"use client";

import { useLayout } from "@/app/context/LayoutContext";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const TOAST_DURATION = 5000;

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useLayout();
  const theme = isDarkMode ? "dark" : "light";

  return (
    <SonnerToaster
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      expand={false}
      closeButton
      duration={TOAST_DURATION}
      visibleToasts={5}
      className="toaster group"
      toastOptions={{
        duration: TOAST_DURATION,
        classNames: {
          toast:
            "group toast flex w-full items-start gap-3 rounded-xl border border-border border-l-4 bg-card p-4 text-foreground shadow-xl",
          title: "text-sm font-semibold text-foreground",
          description: "mt-0.5 text-[13px] leading-snug text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground text-xs font-medium py-1 px-3 rounded-md",
          cancelButton:
            "bg-muted text-foreground text-xs font-medium py-1 px-3 rounded-md",
          closeButton:
            "!border-border !bg-card !text-muted-foreground hover:!text-foreground",
          icon: "mt-0.5",
          success: "!border-l-success [&_[data-icon]]:text-success-text",
          error: "!border-l-destructive [&_[data-icon]]:text-destructive-text",
          warning: "!border-l-warning [&_[data-icon]]:text-warning-text",
          info: "!border-l-info [&_[data-icon]]:text-info",
        },
      }}
      {...props}
    />
  );
};

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
