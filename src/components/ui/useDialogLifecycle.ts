import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { FOCUSABLE_SELECTOR, lockScroll, unlockScroll } from './scrollLock';

interface DialogLifecycleOptions {
  open: boolean;
  onClose: () => void;
  closeDisabled: boolean;
  closeAnimationDuration: number;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  confirmClose?: () => boolean | Promise<boolean>;
}

export function useDialogLifecycle({
  open,
  onClose,
  closeDisabled,
  closeAnimationDuration,
  dialogRef,
  initialFocusRef,
  confirmClose,
}: DialogLifecycleOptions) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1
    );
  }, [dialogRef]);

  const startClose = useCallback(
    (notifyParent: boolean) => {
      if (closeTimerRef.current !== null) return;
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
        closeTimerRef.current = null;
        if (notifyParent) onClose();
      }, closeAnimationDuration);
    },
    [closeAnimationDuration, onClose]
  );

  useEffect(() => {
    let cancelled = false;

    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      queueMicrotask(() => {
        if (cancelled) return;
        setIsVisible(true);
        setIsClosing(false);
      });
    } else if (isVisible) {
      queueMicrotask(() => {
        if (!cancelled) startClose(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isVisible, open, startClose]);

  const requestClose = useCallback(async () => {
    if (closeDisabled) return;
    if (confirmClose) {
      try {
        if ((await confirmClose()) === false) return;
      } catch {
        return;
      }
    }
    startClose(true);
  }, [closeDisabled, confirmClose, startClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const shouldRender = open || isVisible;

  useEffect(() => {
    if (!shouldRender) return;
    lockScroll();
    return () => unlockScroll();
  }, [shouldRender]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      const firstFocusable = getFocusableElements()[0];
      (firstFocusable ?? initialFocusRef.current ?? dialogRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [dialogRef, getFocusableElements, initialFocusRef, open]);

  useEffect(() => {
    if (shouldRender) return;
    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
  }, [shouldRender]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeDisabled) return;
        event.preventDefault();
        void requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeElement === firstElement || activeElement === dialogRef.current) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDisabled, dialogRef, getFocusableElements, open, requestClose]);

  return { isClosing, requestClose, shouldRender };
}
