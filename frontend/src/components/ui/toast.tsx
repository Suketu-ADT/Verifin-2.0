import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DURATION, EASE } from "@/lib/motion"

type Tone = "success" | "error" | "info"
interface ToastItem { id: number; title: string; description?: string; tone: Tone }

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: Tone }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONES: Record<Tone, { Icon: typeof Info; icon: string }> = {
  success: { Icon: CheckCircle2, icon: "text-supported" },
  error: { Icon: AlertTriangle, icon: "text-contradicted" },
  info: { Icon: Info, icon: "text-brand-2" },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])
  const toast = useCallback<ToastApi["toast"]>(({ title, description, tone = "info" }) => {
    const id = nextId.current++
    setItems((all) => [...all.slice(-3), { id, title, description, tone }])
    window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000)
  }, [dismiss])
  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const { Icon, icon } = TONES[t.tone]
            return (
              <motion.div
                key={t.id}
                layout
                role={t.tone === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: DURATION.base, ease: EASE }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-lg"
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink">{t.title}</div>
                  {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded-md p-1 text-muted hover:bg-subtle hover:text-ink">
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}
