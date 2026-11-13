import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SkeletonRows } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: "left" | "right" | "center"
  /** Makes the column sortable by this value. */
  sortValue?: (row: T) => string | number
  /** Hides the column below this breakpoint so tables stay readable on phones. */
  hideBelow?: "sm" | "md" | "lg" | "xl"
  className?: string
  /** Numeric cell: tabular figures. */
  numeric?: boolean
}

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" }
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" }

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Accessible name of the table. */
  caption: string
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Frameless: for use inside a Card that already has a border. */
  bare?: boolean
  dense?: boolean
  maxHeight?: string
  defaultSort?: { key: string; dir: "asc" | "desc" }
}

/** A sortable table that scrolls inside its frame on narrow screens and can drop secondary columns. */
export function DataTable<T>({ columns, rows, rowKey, caption, loading, empty, onRowClick, bare, dense, maxHeight, defaultSort }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null)

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key)
    if (!sort || !col?.sortValue) return rows
    const get = col.sortValue
    return [...rows].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
      return sort.dir === "asc" ? r : -r
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }))

  const table = (
    <div className={cn("overflow-auto", maxHeight)} tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
      <table className="w-full min-w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-canvas text-xs font-medium text-muted">
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort?.key === c.key
              const Icon = !active ? ChevronsUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined}
                  className={cn("whitespace-nowrap px-4 py-2.5 font-medium", ALIGN[c.align ?? "left"], c.hideBelow && HIDE[c.hideBelow])}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink", active && "text-ink")}>
                      {c.header}
                      <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden="true" />
                    </button>
                  ) : c.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="animate-fade-in divide-y divide-line">
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row) } : undefined}
              className={cn("transition-colors", onRowClick ? "cursor-pointer hover:bg-canvas" : "hover:bg-canvas/70")}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(dense ? "px-4 py-2" : "px-4 py-3.5", "align-middle", ALIGN[c.align ?? "left"], c.numeric && "num", c.hideBelow && HIDE[c.hideBelow], c.className)}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && sorted.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">{empty ?? "No rows to show."}</div>}
      {loading && sorted.length === 0 && <SkeletonRows />}
    </div>
  )
  return bare ? table : <Card className="overflow-hidden">{table}</Card>
}
