// Top-level error boundary. React error boundaries must be class components.
//
// Catches:
//   - Uncaught render errors anywhere in the tree
//   - Lazy-import failures (network 404, chunk hash mismatch on stale tabs)
//   - Anything thrown synchronously in lifecycle / effects
//
// Does NOT catch: async errors inside event handlers (we use try/catch + state
// for those — see e.g. handleShareScore in App.tsx).

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearAllSettings } from '../store/settings';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console; if we ever wire Sentry / PostHog this is the hook
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    // Try unregistering the SW first so a stale precache can't keep returning
    // broken HTML — this matters specifically for lazy-import 404s after deploy
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => {})
        .finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  private handleClearAndReload = () => {
    // Clear only OUR keys — leaves other apps on the same origin alone
    clearAllSettings();
    this.handleReload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] w-full bg-[#0a0a1a] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-6">🐧💥</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-2">
          糟糕，企鵝撞牆了
        </h1>
        <p className="text-base sm:text-lg opacity-70 mb-8 max-w-md">
          遊戲遇到一個沒料到的錯誤。通常重新整理就會修好。
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={this.handleReload}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-base sm:text-lg transition-all active:scale-95"
          >
            🔄 重新載入
          </button>
          <button
            onClick={this.handleClearAndReload}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-medium text-sm transition-all border border-white/20"
            title="清除所有本地紀錄（最高分 / 成就 / 皮膚 等都會重置）"
          >
            🗑️ 清除資料後重新載入
          </button>
        </div>

        {this.state.error && (
          <details className="max-w-2xl w-full bg-black/40 border border-red-500/30 rounded-xl p-4 text-left">
            <summary className="cursor-pointer text-sm text-red-300 font-mono">
              錯誤詳情（給工程師看）
            </summary>
            <pre className="mt-3 text-[10px] sm:text-xs text-red-200 overflow-x-auto whitespace-pre-wrap break-all">
              {this.state.error.name}: {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
        )}

        <p className="text-[10px] text-white/30 mt-8">
          若反覆出現，請到{' '}
          <a
            href="https://github.com/cagoooo/penguin/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            GitHub 回報
          </a>
        </p>
      </div>
    );
  }
}
