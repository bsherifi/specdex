import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-level error boundary. Without this, any render-phase throw unmounts the
 * whole React tree and leaves a blank white window with no chrome. This catches
 * it, keeps the window usable, and shows the error so it can be diagnosed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the webview console (and dev terminal) for debugging.
    console.error("Specdex render crash:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    // props are typed via the Props interface; react/prop-types can't see TS types.
    // eslint-disable-next-line react/prop-types
    if (!error) return this.props.children;
    return (
      <div
        style={{
          padding: "2rem",
          fontFamily: "ui-monospace, monospace",
          color: "#fca5a5",
          background: "#0a0a0a",
          minHeight: "100vh",
          overflow: "auto",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#f87171" }}>
          Something crashed
        </h1>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", lineHeight: 1.5 }}>
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #525252",
            background: "#171717",
            color: "#e5e5e5",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
