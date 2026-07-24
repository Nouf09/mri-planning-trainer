import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorkspaceErrorBoundaryProps {
  children: ReactNode;
  /** Recovery action; defaults to a full page reload. Injectable for tests. */
  onReload?: () => void;
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort catch for unexpected React render and lifecycle errors in the
 * MRI workspace.
 *
 * Expected imaging states — volume loading, unsupported capability, empty
 * preview — are modelled as data and rendered by their own components; they
 * never throw and never reach this boundary. What does reach it would
 * otherwise unmount the entire tree and leave a blank page.
 *
 * The visible fallback stays free of technical internals; the error and
 * component stack go to the developer console. A page reload re-creates the
 * tree from scratch, which also resets this boundary.
 */
export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("MRI workspace error:", error, errorInfo.componentStack);
  }

  private handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        role="alert"
        className="min-h-screen bg-console-dark flex items-center justify-center p-6"
      >
        <div className="w-full max-w-md rounded-sm border border-border bg-console-panel p-6 text-center">
          <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-primary">
            The workspace encountered an error
          </h1>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            The MRI planning workspace could not continue. Reloading starts a
            fresh session.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 rounded-sm border border-primary/30 bg-primary/15 px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/25 focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            Reload workspace
          </button>
        </div>
      </main>
    );
  }
}
