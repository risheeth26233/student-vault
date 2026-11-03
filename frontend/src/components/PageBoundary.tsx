import { Component, Suspense, type ReactNode } from 'react';

/** Keep navigation available while a page chunk loads or fails to download. */
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <div role="alert" className="p-8 text-center">
        <h1 className="text-xl font-semibold">This page could not load</h1>
        <p className="my-4">Check your connection and reload to try again.</p>
        <button className="rounded-lg bg-teal-600 px-4 py-2 text-white" onClick={() => window.location.reload()}>Reload page</button>
      </div>;
    }
    return <Suspense fallback={<div role="status" className="p-8 text-center">Loading page…</div>}>
      {this.props.children}
    </Suspense>;
  }
}
