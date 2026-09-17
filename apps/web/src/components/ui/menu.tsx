"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export type MenuAlignment = "start" | "end";

type MenuActionItem = Readonly<{
  disabled?: false;
  id: string;
  label: string;
  onSelectAction: () => void;
}>;

type MenuDisabledItem = Readonly<{
  disabled: true;
  id: string;
  label: string;
}>;

export type MenuItem = MenuActionItem | MenuDisabledItem;

type MenuProps = Readonly<{
  align?: MenuAlignment;
  items: readonly MenuItem[];
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
}>;

const alignmentClassNames: Record<MenuAlignment, string> = {
  start: "left-0",
  end: "right-0",
};

function getEnabledMenuItems(menu: HTMLElement) {
  return Array.from(
    menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])'),
  );
}

export function Menu({ align = "end", items, label, trigger, triggerClassName }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initialFocusRef = useRef<"first" | "last">("first");
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const menu = menuRef.current;

      if (!menu) {
        return;
      }

      const menuItems = getEnabledMenuItems(menu);
      const initialFocusTarget =
        initialFocusRef.current === "last" ? menuItems[menuItems.length - 1] : menuItems[0];

      (initialFocusTarget ?? menu).focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;

      if (!root || !(event.target instanceof Node) || root.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function focusTrigger() {
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  function focusMenuItem(position: "first" | "last") {
    const menu = menuRef.current;

    if (!menu) {
      return;
    }

    const menuItems = getEnabledMenuItems(menu);
    const target = position === "last" ? menuItems[menuItems.length - 1] : menuItems[0];

    (target ?? menu).focus({ preventScroll: true });
  }

  function openMenu(position: "first" | "last") {
    initialFocusRef.current = position;

    if (isOpen) {
      focusMenuItem(position);
      return;
    }

    setIsOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);

    if (restoreFocus) {
      focusTrigger();
    }
  }

  function moveFocus(direction: 1 | -1) {
    const menu = menuRef.current;

    if (!menu) {
      return;
    }

    const menuItems = getEnabledMenuItems(menu);

    if (menuItems.length === 0) {
      menu.focus({ preventScroll: true });
      return;
    }

    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : menuItems.length - 1
        : (currentIndex + direction + menuItems.length) % menuItems.length;

    menuItems[nextIndex]?.focus({ preventScroll: true });
  }

  function handleRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const nextFocusedElement = event.relatedTarget;

    if (nextFocusedElement instanceof Node && rootRef.current?.contains(nextFocusedElement)) {
      return;
    }

    setIsOpen(false);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu("first");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusMenuItem("last");
    }
  }

  function handleMenuItemClick(item: MenuActionItem) {
    setIsOpen(false);

    window.requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true });
      item.onSelectAction();
    });
  }

  return (
    <div className="relative inline-flex" onBlur={handleRootBlur} ref={rootRef}>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className={[
          "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted",
          triggerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        id={triggerId}
        onClick={() => (isOpen ? closeMenu() : openMenu("first"))}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        {trigger}
      </button>
      {isOpen ? (
        <div
          aria-labelledby={triggerId}
          className={[
            "absolute top-full z-50 mt-2 min-w-56 rounded-md border border-border bg-surface p-1 shadow-md",
            alignmentClassNames[align],
          ].join(" ")}
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
          tabIndex={-1}
        >
          {items.map((item) => {
            if (item.disabled) {
              return (
                <button
                  key={item.id}
                  className="flex w-full cursor-not-allowed items-center rounded-sm px-3 py-2 text-left text-sm leading-5 text-muted-subtle"
                  disabled
                  role="menuitem"
                  type="button"
                >
                  {item.label}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm leading-5 text-foreground transition-colors hover:bg-surface-muted focus:bg-surface-muted"
                onClick={() => handleMenuItemClick(item)}
                role="menuitem"
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
