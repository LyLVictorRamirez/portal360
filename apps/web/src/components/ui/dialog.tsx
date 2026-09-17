"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./icon-button";

type DialogProps = Readonly<{
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}>;

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0,
  );
}

export function Dialog({ children, description, onOpenChange, open, title }: DialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasDescription = description !== undefined && description !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const activeElement = document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    const animationFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const [firstFocusableElement] = getFocusableElements(dialog);
      (firstFocusableElement ?? dialog).focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || open) {
      return;
    }

    const opener = openerRef.current;

    if (opener && document.contains(opener)) {
      opener.focus({ preventScroll: true });
    }

    openerRef.current = null;
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    }

    document.addEventListener("keydown", handleDocumentKeyDown, true);

    return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
  }, [mounted, onOpenChange, open]);

  function closeDialog() {
    onOpenChange(false);
  }

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeDialog();
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (!firstFocusableElement || !lastFocusableElement) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === dialog || activeElement === firstFocusableElement)) {
      event.preventDefault();
      lastFocusableElement.focus({ preventScroll: true });
      return;
    }

    if (
      !event.shiftKey &&
      (activeElement === lastFocusableElement || !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      firstFocusableElement.focus({ preventScroll: true });
    }
  }

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/35 p-4 sm:p-6"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        aria-describedby={hasDescription ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface shadow-md sm:max-h-[calc(100dvh-3rem)]"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold leading-6 text-foreground">
              {title}
            </h2>
            {hasDescription ? (
              <p id={descriptionId} className="mt-1.5 max-w-prose text-sm leading-6 text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton icon={X} label="Cerrar diálogo" onClick={closeDialog} />
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
