import { Component, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { ErrorState } from "./states"

interface BoundaryProps {
  resetKey: string
  children: ReactNode
}

/**
 * Catches a page that fails to load or render. Pages are fetched on demand, so after a new version is deployed an old tab can ask for
 * a file that no longer exists; React's Suspense does not handle that failure, and without a boundary the screen would go blank.
 */
class Boundary extends Component<BoundaryProps, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  // moving to another page gives it a fresh chance
  static getDerivedStateFromProps(props: BoundaryProps, state: { failed: boolean; resetKey: string }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16">
          <ErrorState
            title="This page could not be loaded"
            message="VERIFIN may have been updated since you opened this tab. Reload to get the latest version."
            onRetry={() => window.location.reload()}
          />
        </div>
      )
    }
    return this.props.children
  }
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}
