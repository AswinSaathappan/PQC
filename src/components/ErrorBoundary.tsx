import React from "react";

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#fff1f0", minHeight: "100vh" }}>
          <h1 style={{ color: "#c00", fontSize: 24 }}>⚠ Application Error</h1>
          <p style={{ color: "#333", marginTop: 16 }}>The app crashed with the following error:</p>
          <pre style={{ background: "#fff", border: "1px solid #faa", padding: 16, marginTop: 12, borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ marginTop: 20, padding: "8px 20px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
