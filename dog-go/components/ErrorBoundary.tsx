'use client';

import { Component, type ReactNode } from 'react';

/** Catches render/WebGL errors in a subtree and shows a friendly fallback instead of a blank screen. */
export default class ErrorBoundary extends Component<
  { fallback: (retry: () => void) => ReactNode; children: ReactNode },
  { err: boolean; key: number }
> {
  state = { err: false, key: 0 };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: unknown) {
    console.error('Dog-go: recovered from error', e);
  }
  retry = () => this.setState((s) => ({ err: false, key: s.key + 1 }));
  render() {
    if (this.state.err) return this.props.fallback(this.retry);
    return (
      <div key={this.state.key} className="contents">
        {this.props.children}
      </div>
    );
  }
}
