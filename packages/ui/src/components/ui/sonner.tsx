"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps, toast } from "sonner";
import { cn } from "#/lib/utils";

const Toaster = ({
  className,
  icons,
  style,
  theme: themeProp,
  toastOptions,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className={cn("toaster group", className)}
      icons={{
        error: <OctagonXIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        success: <CircleCheckIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        ...icons,
      }}
      style={
        {
          "--border-radius": "var(--radius-lg)",
          "--error-bg": "var(--card)",
          "--error-border": "var(--border)",
          "--error-text": "var(--card-foreground)",
          "--info-bg": "var(--card)",
          "--info-border": "var(--border)",
          "--info-text": "var(--card-foreground)",
          "--normal-bg": "var(--card)",
          "--normal-bg-hover": "var(--muted)",
          "--normal-border": "var(--border)",
          "--normal-border-hover": "var(--border)",
          "--normal-text": "var(--card-foreground)",
          "--success-bg": "var(--card)",
          "--success-border": "var(--border)",
          "--success-text": "var(--card-foreground)",
          "--warning-bg": "var(--card)",
          "--warning-border": "var(--border)",
          "--warning-text": "var(--card-foreground)",
          ...style,
        } as React.CSSProperties
      }
      theme={(themeProp ?? theme) as ToasterProps["theme"]}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          actionButton: cn(
            "!rounded-[min(var(--radius-md),12px)] !bg-primary !px-2.5 !text-xs !font-medium !text-primary-foreground hover:!bg-primary/80",
            toastOptions?.classNames?.actionButton,
          ),
          cancelButton: cn(
            "!rounded-[min(var(--radius-md),12px)] !bg-secondary !px-2.5 !text-xs !font-medium !text-secondary-foreground hover:!bg-secondary/80",
            toastOptions?.classNames?.cancelButton,
          ),
          closeButton: cn(
            "!border-border !bg-background !text-muted-foreground hover:!bg-muted hover:!text-foreground dark:!border-input",
            toastOptions?.classNames?.closeButton,
          ),
          description: cn(
            "text-sm leading-snug text-muted-foreground",
            toastOptions?.classNames?.description,
          ),
          error: cn(
            "[&_[data-icon]]:text-destructive",
            toastOptions?.classNames?.error,
          ),
          icon: cn("text-muted-foreground", toastOptions?.classNames?.icon),
          info: cn(
            "[&_[data-icon]]:text-[var(--chart-3)]",
            toastOptions?.classNames?.info,
          ),
          loading: cn(
            "[&_[data-icon]]:text-muted-foreground",
            toastOptions?.classNames?.loading,
          ),
          success: cn(
            "[&_[data-icon]]:text-[var(--chart-2)]",
            toastOptions?.classNames?.success,
          ),
          title: cn(
            "text-sm leading-snug font-medium text-card-foreground",
            toastOptions?.classNames?.title,
          ),
          toast: cn(
            "group/toast border-border bg-card px-3 py-2.5 text-sm text-card-foreground shadow-lg shadow-black/5 dark:border-input",
            toastOptions?.classNames?.toast,
          ),
          warning: cn(
            "[&_[data-icon]]:text-[var(--chart-4)]",
            toastOptions?.classNames?.warning,
          ),
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
