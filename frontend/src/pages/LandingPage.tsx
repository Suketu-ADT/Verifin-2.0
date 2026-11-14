import { Link } from "react-router-dom"
import { ArrowRight, Calculator, Cpu, ExternalLink, FileText, Quote, Search, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/verification/indicators"
import { cn } from "@/lib/utils"

const STEPS = [
  { icon: FileText, title: "Claim decomposition", desc: "The AI-generated answer is split into atomic, independently checkable factual statements rather than judged as one block." },
  { icon: Search, title: "Hybrid evidence retrieval", desc: "Each claim is matched against the source document with keyword (BM25) and dense semantic search, keeping page and section provenance." },
  { icon: Cpu, title: "NLI verification", desc: "A DeBERTa-v3 cross-encoder compares claim and evidence. It is the main decision signal; there is no self-reported LLM confidence." },
  { icon: Calculator, title: "Numerical and temporal checks", desc: "Figures, percentages and fiscal periods in the claim are compared directly against the values in the source document." },
  { icon: ShieldCheck, title: "Interpretable output", desc: "Every verdict ships with its evidence passage, page number and the rule that decided it, never a bare risk percentage." },
]

function Brand({ light }: { light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-[0.04em]", light ? "text-white" : "text-brand")}>
      <span className={cn("grid size-8 place-items-center rounded-lg", light ? "bg-white/10 ring-1 ring-white/15" : "bg-brand text-white")}><ShieldCheck className="size-[18px]" aria-hidden="true" /></span>
      VERIFIN
    </span>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav aria-label="Page sections" className="hidden items-center gap-7 text-[13px] font-medium text-muted md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#about" className="hover:text-ink">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</Link>
            <Link to="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>Get started <ArrowRight /></Link>
          </div>
        </div>
      </header>

      <main id="main">
      {/* Hero */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="max-w-xl">
            <Badge tone="brand" className="mb-5">Evidence-based verification</Badge>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              Don't trust an AI's financial claim. <span className="text-brand-2">Verify it.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted">
              VERIFIN breaks an AI-written financial answer into individual claims, retrieves supporting evidence from the source filing, and uses Natural Language Inference, not a second model's opinion, to show exactly why each claim is supported, contradicted or unverifiable.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/verify" className={buttonVariants({ variant: "primary", size: "lg" })}>Start a verification <ArrowRight /></Link>
              <a href="#how-it-works" className={buttonVariants({ variant: "secondary", size: "lg" })}>See how it works</a>
            </div>
            <p className="mt-6 text-[13px] text-muted">Trust through transparency. Intelligence through evidence.</p>
          </div>

          {/* illustrative example: no scores, because it is not a real run */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-3 text-xs text-muted">
                <span className="font-medium text-ink">Example verification</span>
                <Badge tone="outline">Illustration only</Badge>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-line bg-canvas p-4">
                  <div className="text-xs font-medium text-muted">AI answer under review</div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">“Revenue increased 12% in fiscal 2025, driven by strong demand.”</p>
                </div>
                {([
                  ["SUPPORTED", "The filing states the same growth figure for the same fiscal year."],
                  ["CONTRADICTED", "The filing reports a different figure for the same measure and period."],
                  ["UNVERIFIABLE", "Nothing in the filing speaks to this statement either way."],
                ] as const).map(([s, why]) => (
                  <div key={s} className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                    <StatusBadge status={s} />
                    <div className="min-w-0 text-[13px] leading-relaxed text-muted"><Quote className="mr-1 inline size-3 -translate-y-px text-faint" aria-hidden="true" />{why}</div>
                  </div>
                ))}
                <p className="text-xs text-muted">The three outcomes every claim can get. Real results show the actual evidence passage, page and deciding rule.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-b border-line py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-brand-2">Pipeline</div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">How VERIFIN works</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">Five stages, each one auditable on its own. Nothing is a black box.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-md bg-brand-tint text-brand"><s.icon className="size-4" aria-hidden="true" /></span>
                  <span className="num text-xs font-medium text-muted">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-ink">{s.title}</h3>
                <p className="flex-1 text-[13px] leading-relaxed text-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16 border-b border-line py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-brand-2">Background</div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">About this project</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              VERIFIN is a research-oriented tool for detecting hallucinations in AI-generated financial summaries, using Natural Language Inference and retrieval-based verification against source documents.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6 shadow-xs md:p-8">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">Team and credits</div>
            <div className="mb-8 flex flex-wrap gap-2">
              {["Vedant Chaudhari", "Rakshit Girase", "Suketu Mishra", "Rachayita Sharma"].map((n) => <Badge key={n} tone="outline" className="px-3 py-1.5 text-[13px]">{n}</Badge>)}
            </div>
            <div className="flex flex-col gap-6 text-[13px] text-muted sm:flex-row sm:gap-12">
              <div><span className="mb-1 block font-medium text-ink">Faculty guide</span>Dr. Sheetal Aher</div>
              <div><span className="mb-1 block font-medium text-ink">Institution</span>MIT ADT University — Class LYAIA08, Group ID BCAIAA89</div>
            </div>
          </div>
        </div>
      </section>
      </main>

      <footer className="bg-navy py-8 text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs sm:px-6 md:flex-row">
          <div className="flex items-center gap-3"><Brand light /><span className="text-white/50">MIT School of Computing, Class LYAIA0B</span></div>
          <a href="https://github.com/Suketu-ADT/Verifin-2.0" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-sm hover:text-white"><ExternalLink className="size-3.5" aria-hidden="true" /> Source on GitHub</a>
        </div>
      </footer>
    </div>
  )
}
