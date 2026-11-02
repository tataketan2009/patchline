import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LifeBuoy, MessageCircle } from "lucide-react";

/** Floating contact control — the one permitted glass surface outside the map. */
export default function FloatingContact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 sm:bottom-5 z-[1150] flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="glass w-64 rounded-lg p-3"
          >
            <p className="text-[12px] font-semibold text-ink">Monitoring operations</p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-muted">
              <li>
                Command desk · <span className="font-mono text-ink">ops@patchline.gov.in</span>
              </li>
              <li>
                Field hotline · <span className="font-mono text-ink">+91 8xx xxx-xxxx (demo)</span>
              </li>
              <li>
                Response window · <span className="font-mono text-ink">06:00 – 22:00 IST</span>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Open contact support popover"
        className="glass !rounded-full grid h-11 w-11 place-items-center text-accent transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <MessageCircle size={18} aria-hidden /> : <LifeBuoy size={18} aria-hidden />}
      </button>
    </div>
  );
}
