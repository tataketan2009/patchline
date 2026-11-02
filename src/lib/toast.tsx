import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { Severity } from "./data";

type ToastKind = "info" | "success" | "warning" | "danger";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}

const KIND_ICON: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: TriangleAlert,
};

interface ToastCtx {
  push: (kind: ToastKind, title: string, desc?: string) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, desc?: string) => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-3), { id, kind, title, desc }]);
      window.setTimeout(() => remove(id), 4800);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[1400] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = KIND_ICON[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                role="status"
                className="glass pointer-events-auto flex items-start gap-3 rounded-lg p-3"
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  className={
                    t.kind === "info"
                      ? "text-muted shrink-0 mt-0.5"
                      : t.kind === "success"
                        ? "text-accent shrink-0 mt-0.5"
                        : "text-danger shrink-0 mt-0.5"
                  }
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{t.title}</p>
                  {t.desc && <p className="mt-0.5 text-xs text-muted">{t.desc}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss notification"
                  className="text-muted hover:text-ink transition-colors shrink-0 rounded p-0.5"
                >
                  <X size={14} aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

export function severityToToast(kind: Severity): ToastKind {
  return kind === "critical" ? "danger" : kind === "high" ? "warning" : "info";
}
