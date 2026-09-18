export default function About() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">About VERIFIN</h1>
      <div className="p-8 border rounded-lg bg-card prose dark:prose-invert">
        <p>
          VERIFIN is a research-oriented tool designed to detect hallucinations in LLM-generated financial summaries.
          It uses Natural Language Inference (NLI) and Retrieval-Augmented Generation (RAG) principles to verify claims against authoritative source documents.
        </p>
      </div>
    </div>
  )
}
