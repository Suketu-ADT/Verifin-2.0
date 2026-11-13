import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"
import { VERDICTS, VERDICT_ORDER, type Verdict } from "@/lib/verdict"
import { TooltipCard, VerdictPatterns, useChartMotion, verdictFill } from "./chartKit"

interface Props {
  counts: Record<Verdict, number>
  /** Word under the total in the centre of the ring. */
  unit?: string
  className?: string
}

/** Share of claims by verdict: a ring with a texture per verdict, plus a legend that carries the counts so nothing is colour-only. */
export function VerdictDonut({ counts, unit = "claims", className }: Props) {
  const motion = useChartMotion()
  const total = VERDICT_ORDER.reduce((a, k) => a + counts[k], 0)
  const data = VERDICT_ORDER.map((k) => ({ key: k, name: VERDICTS[k].label, value: counts[k] })).filter((d) => d.value > 0)
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-8 gap-y-5", className)}>
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <VerdictPatterns />
            <Pie data={total === 0 ? [{ key: "none", name: "No claims", value: 1 }] : data} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={total > 0 && data.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270} {...motion}>
              {total === 0 ? <Cell fill="#e2e8f0" /> : data.map((d) => <Cell key={d.key} fill={verdictFill(d.key as Verdict)} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length || total === 0) return null
              const d = payload[0].payload as { key: Verdict; name: string; value: number }
              return <TooltipCard title={d.name} rows={[{ label: unit, value: `${d.value} (${Math.round((d.value / total) * 100)}%)`, color: VERDICTS[d.key].color }]} />
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-3xl font-semibold leading-none tracking-tight text-ink">{total}</div>
            <div className="mt-1 text-xs text-muted">{unit}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-[14rem] flex-1 space-y-2.5" aria-label="Claims by verdict">
        {VERDICT_ORDER.map((k) => {
          const v = VERDICTS[k]
          const n = counts[k]
          return (
            <li key={k} className="flex items-center gap-3 text-[13px]">
              <span className={cn("size-3 shrink-0 rounded-[3px]", v.texture)} style={{ backgroundColor: v.color }} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap text-ink"><v.Icon className="size-3.5 text-muted" aria-hidden="true" />{v.label}</span>
              <span className="num font-semibold text-ink">{n}</span>
              <span className="num w-12 text-right text-muted">{total > 0 ? `${Math.round((n / total) * 100)}%` : "–"}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
