import { motion } from "framer-motion"
import axios from "axios"
import { useCallback, useEffect, useState } from "react"
import { Gauge, Info, Loader2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import EmptyState from "../components/shared/EmptyState"
import ErrorState from "../components/shared/ErrorState"
import { ChartCard, GRID, INK, Legend, MAGNITUDE, SURFACE, TooltipCard, axisTick, humanize, percent, type TableColumn } from "../components/charts/chartKit"
import { errorMessage, getBenchmarkSummary, type BenchmarkInterval, type BenchmarkSummary } from "../lib/api"

const OTHER = "#64748b" // the systems VERIFIN is compared with; VERIFIN itself uses the one accent hue
const cursor = { fill: "rgba(255,255,255,0.04)" }
const pct0 = (v: number) => `${Math.round(v * 100)}%`
const range = (i: BenchmarkInterval) => `${percent(i.value)} (${percent(i.low)}–${percent(i.high)})`
const subtypeName = (raw: string) => raw.split("/").map(humanize).join(" · ")

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1.5 font-mono text-3xl font-bold text-white">{value}</div>
      {note && <div className="mt-1 text-[11px] text-slate-400">{note}</div>}
    </div>
  )
}

/** Rows are the true label and columns what VERIFIN said; the shade is the share of the row, so a dark diagonal is good. */
function ConfusionMatrix({ classes, matrix }: { classes: string[]; matrix: number[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <caption className="sr-only">Confusion matrix: true label by predicted label</caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-left text-[10px] font-medium text-slate-500">True ↓ / Said →</th>
            {classes.map((c) => <th key={c} scope="col" className="p-1 text-[10px] font-semibold text-slate-300">{humanize(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0)
            return (
              <tr key={classes[i]}>
                <th scope="row" className="p-1 text-left text-[11px] font-semibold text-slate-300">{humanize(classes[i])}<div className="font-mono text-[10px] font-normal text-slate-500">{total} claims</div></th>
                {row.map((n, j) => {
                  const share = total ? n / total : 0
                  return (
                    <td key={classes[j]} className="rounded-md px-1 py-3" style={{ backgroundColor: n ? `rgba(99,102,241,${0.12 + 0.78 * share})` : "rgba(255,255,255,0.03)" }}
                      title={`${n} of ${total} ${humanize(classes[i]).toLowerCase()} claims were called ${humanize(classes[j]).toLowerCase()}`}>
                      <div className="font-mono text-base font-bold text-white">{n}</div>
                      <div className="font-mono text-[10px] text-slate-200">{percent(share, 0)}</div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Benchmark() {
  const [data, setData] = useState<BenchmarkSummary | null>(null)
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null)
  const [metric, setMetric] = useState<"macro_f1" | "accuracy">("macro_f1")

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    getBenchmarkSummary()
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError({ message: errorMessage(e, "Could not load the benchmark."), missing: axios.isAxiosError(e) && e.response?.status === 404 }) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => load(), [load])

  const header = (
    <div className="glass-strong relative overflow-hidden rounded-2xl border border-white/10 p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative z-10 space-y-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">Benchmark</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
          How accurately VERIFIN labels a claim as supported, contradicted or unverifiable, and how that compares with simpler methods and a 7B language model.
        </p>
      </div>
    </div>
  )

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        {error.missing
          ? <EmptyState icon={Gauge} title="Results not on this server" message="The recorded evaluation reports were not found, so there is nothing to chart here." />
          : <ErrorState title="Benchmark unavailable" message={error.message} onRetry={load} />}
      </div>
    )
  }
  if (!data) return <div className="space-y-6">{header}<div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" /></div></div>

  const verifin = data.systems[0]
  const judge = data.systems.find((s) => s.key.includes("llm_rag"))
  const systemRows = data.systems.map((s) => ({ ...s, value: s[metric].value, name: s.label }))
  const metricName = metric === "macro_f1" ? "Macro-F1" : "Accuracy"

  const systemColumns: TableColumn<(typeof systemRows)[number]>[] = [
    { header: "System", cell: (r) => r.label },
    { header: "Macro-F1 (95% interval)", cell: (r) => range(r.macro_f1), align: "right" },
    { header: "Accuracy (95% interval)", cell: (r) => range(r.accuracy), align: "right" },
    { header: "Seconds per claim", cell: (r) => r.latency_mean_s.toFixed(1), align: "right" },
  ]

  const subtypeRows = [...data.subtypes].sort((a, b) => a.accuracy - b.accuracy || b.claims - a.claims)
    .map((s) => ({ name: `${subtypeName(s.name)} (${s.claims})`, value: s.accuracy, claims: s.claims }))
  const calibrationRows = data.calibration.bins.map((b) => ({ ...b, name: `${b.bin} (${b.claims})` }))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {header}

      <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs leading-relaxed text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          These are recorded results on a held-out split of {data.claims} claims about six public financial documents, scored after the rules were frozen. The claims were
          built by editing or inventing statements, so their labels are known; they are not claims written by a real model. Nothing is re-run on this page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Macro-F1" value={percent(verifin.macro_f1.value)} note={`95% interval ${percent(verifin.macro_f1.low)}–${percent(verifin.macro_f1.high)}`} />
        <Tile label="Accuracy" value={percent(verifin.accuracy.value)} note={`95% interval ${percent(verifin.accuracy.low)}–${percent(verifin.accuracy.high)}`} />
        <Tile label="Evidence found" value={percent(data.retrieval.recall_at_k, 0)} note={`Right page in the top results, ${data.retrieval.n} claims`} />
        <Tile label="Time per claim" value={`${verifin.latency_mean_s.toFixed(1)} s`}
          note={judge ? `${(judge.latency_mean_s / verifin.latency_mean_s).toFixed(0)}× faster than the 7B judge (${judge.latency_mean_s.toFixed(1)} s)` : "CPU only"} />
      </div>

      <ChartCard title={`${metricName} by system`} subtitle="Same held-out claims for every system; higher is better"
        summary={systemRows.map((r) => `${r.label} ${percent(r.value)}`).join(", ")}
        legend={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Legend items={[{ label: "VERIFIN", color: MAGNITUDE }, { label: "Compared with", color: OTHER }]} />
            <div role="group" aria-label="Metric" className="flex rounded-lg border border-white/10 p-0.5 text-[11px] font-semibold">
              {([["macro_f1", "Macro-F1"], ["accuracy", "Accuracy"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${metric === key ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>{label}</button>
              ))}
            </div>
          </div>
        }
        table={{ caption: "Systems compared", rows: systemRows, columns: systemColumns }}>
        <ResponsiveContainer width="100%" height={systemRows.length * 44 + 30}>
          <BarChart data={systemRows} layout="vertical" margin={{ left: 0, right: 48, top: 4, bottom: 4 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={pct0} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={170} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={cursor} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload as (typeof systemRows)[number]
              return <TooltipCard title={r.label} rows={[
                { label: "Macro-F1", value: range(r.macro_f1) }, { label: "Accuracy", value: range(r.accuracy) },
                { label: "Seconds per claim", value: r.latency_mean_s.toFixed(1) },
              ]} />
            }} />
            <Bar dataKey="value" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {systemRows.map((r) => <Cell key={r.key} fill={r.key === "verifin" ? MAGNITUDE : OTHER} />)}
              <LabelList dataKey="value" position="right" formatter={(v: unknown) => percent(Number(v))} fill={INK.primary} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="What VERIFIN said, by true label" subtitle="Each row adds up to the claims of that true label; a dark diagonal is good"
          summary={`Of ${data.claims} claims, ${data.confusion.reduce((a, row, i) => a + row[i], 0)} were labelled correctly.`}>
          <ConfusionMatrix classes={data.classes} matrix={data.confusion} />
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Treating anything not supported as "flag it for review": precision {percent(data.flag_any_unsupported.precision)}, recall {percent(data.flag_any_unsupported.recall)},
            and {percent(data.flag_any_unsupported.false_positive_rate)} of supported claims flagged by mistake.
          </p>
        </ChartCard>

        <ChartCard title="Per class" subtitle="How well each kind of claim is recognised"
          summary={data.per_class.map((c) => `${humanize(c.label)} F1 ${percent(c.f1)}`).join(", ")}
          table={{ caption: "Precision, recall and F1 per class", rows: data.per_class, columns: [
            { header: "Class", cell: (r) => humanize(r.label) }, { header: "Precision", cell: (r) => percent(r.precision), align: "right" },
            { header: "Recall", cell: (r) => percent(r.recall), align: "right" }, { header: "F1", cell: (r) => percent(r.f1), align: "right" },
            { header: "Claims", cell: (r) => r.support, align: "right" }] }}
          forceTable>
          <span />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Accuracy by kind of claim" subtitle="Weakest first; the number of claims is in brackets"
          summary={`Lowest: ${subtypeRows[0]?.name} at ${percent(subtypeRows[0]?.value ?? 0)}.`}
          table={{ caption: "Accuracy by kind of claim", rows: subtypeRows, columns: [
            { header: "Kind", cell: (r) => r.name }, { header: "Accuracy", cell: (r) => percent(r.value), align: "right" }] }}>
          <ResponsiveContainer width="100%" height={subtypeRows.length * 30 + 30}>
            <BarChart data={subtypeRows} layout="vertical" margin={{ left: 0, right: 48, top: 4, bottom: 4 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" domain={[0, 1]} tickFormatter={pct0} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={200} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip cursor={cursor} content={({ active, payload }) => active && payload?.length
                ? <TooltipCard title={String(payload[0].payload.name)} rows={[{ label: "Accuracy", value: percent(payload[0].payload.value), color: MAGNITUDE }]} /> : null} />
              <Bar dataKey="value" fill={MAGNITUDE} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => percent(Number(v), 0)} fill={INK.primary} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Confidence against accuracy" subtitle={`How often the verdict was right at each confidence level, with the number of claims in brackets; a bar from only a few claims says little (calibration error ${data.calibration.ece.toFixed(2)})`}
          summary="Accuracy and average confidence for each confidence range; the confidence score is not a probability."
          legend={<Legend items={[{ label: "Accuracy", color: MAGNITUDE }, { label: "Average confidence", color: INK.primary }]} />}
          table={{ caption: "Calibration by confidence range", rows: calibrationRows, columns: [
            { header: "Confidence", cell: (r) => r.bin }, { header: "Claims", cell: (r) => r.claims, align: "right" },
            { header: "Average confidence", cell: (r) => percent(r.confidence), align: "right" }, { header: "Accuracy", cell: (r) => percent(r.accuracy), align: "right" }] }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={calibrationRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" interval={0} tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tickFormatter={pct0} tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip cursor={cursor} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as (typeof calibrationRows)[number]
                return <TooltipCard title={`Confidence ${r.bin}`} rows={[
                  { label: "Claims", value: String(r.claims) }, { label: "Accuracy", value: percent(r.accuracy), color: MAGNITUDE },
                  { label: "Average confidence", value: percent(r.confidence), color: INK.primary }]} />
              }} />
              <Bar dataKey="accuracy" fill={MAGNITUDE} barSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line type="linear" dataKey="confidence" stroke={INK.primary} strokeWidth={2} isAnimationActive={false}
                dot={{ r: 4, fill: INK.primary, stroke: SURFACE, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </motion.div>
  )
}
