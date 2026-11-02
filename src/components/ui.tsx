import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type DetectionStatus,
  type Severity,
} from "../lib/data";

/* ------------------------------------------------------------------ */
/* Panel — a standard dashboard card. Glass is intentionally NOT used  */
/* for panels: important information must stay fully readable.         */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  meta,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-line bg-panel transition-colors duration-150 hover:border-line-strong ${className}`}
    >
      {title && (
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {meta}
          {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                             */
/* ------------------------------------------------------------------ */

export function SeverityBadge({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
      style={{ color, backgroundColor: `${color}22` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const STATUS_STYLE: Record<DetectionStatus, string> = {
  new: "text-warn bg-warn-soft",
  investigating: "text-accent bg-accent-soft",
  resolved: "text-muted bg-muted/10",
};

export function StatusBadge({ status }: { status: DetectionStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Chip({
  active,
  color,
  onClick,
  children,
  pressedNote,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
  pressedNote?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={pressedNote}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
      style={{
        borderColor: active && color ? `${color}88` : "var(--pl-line-strong)",
        backgroundColor: active && color ? `${color}1f` : "transparent",
      }}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded animate-[pl-skeleton_1.4s_ease-in-out_infinite] bg-raised ${className}`} aria-hidden />
  );
}

/* ------------------------------------------------------------------ */
/* Modal / confirmation dialog — translucent backdrop, guaranteed text */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            className="absolute inset-0 rounded-none cursor-default bg-black/50"
            onClick={onClose}
            aria-label="Close dialog"
            tabIndex={-1}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={`relative w-full ${width} rounded-lg border border-line bg-panel shadow-2xl`}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1 text-muted transition-colors hover:text-ink"
              >
                <X size={15} aria-hidden />
              </button>
            </header>
            <div className="px-4 py-3">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-[13px] leading-relaxed text-muted">{body}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-transform active:scale-[0.97] ${
            danger ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent/90"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  children,
  onClick,
  className = "",
  danger,
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-white transition-[background-color,transform,box-shadow] duration-150 hover:shadow-sm active:scale-[0.97] ${
        danger ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent/90"
      } ${small ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"} ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised ${className}`}
    >
      {children}
    </button>
  );
}
