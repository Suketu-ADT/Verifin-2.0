import { useParams } from "react-router-dom"

export default function ResultsDashboard() {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Verification Results</h1>
      <p className="text-muted-foreground">Session ID: {id}</p>
      <div className="p-8 border rounded-lg bg-card text-center">
        Mock results for verification.
      </div>
    </div>
  )
}
