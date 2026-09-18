import { useParams, Link } from "react-router-dom"
import { Button } from "../components/ui/button"

export default function ClaimDetail() {
  const { id, claimId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to={`/verify/results/${id}`}>
          <Button variant="outline" size="sm">Back to Results</Button>
        </Link>
        <h1 className="text-3xl font-bold">Claim Details</h1>
      </div>
      <div className="p-8 border rounded-lg bg-card">
        <p className="text-muted-foreground">Viewing details for claim: {claimId}</p>
      </div>
    </div>
  )
}
