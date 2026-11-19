/** @file Sheet-wide grouping of repeated view errors: one summary, compact field markers. */
import { createContext, useContext, useEffect, useId, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { it } from './it';

/** Mounted error markers by message; only the summary subscribes, so registering never re-renders the sheet. */
class ErrorRegistry {
  private readonly entries = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private snapshot: [string, number][] = [];
  add(id: string, message: string) { this.entries.set(id, message); this.publish(); }
  remove(id: string) { if (this.entries.delete(id)) this.publish(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  read = () => this.snapshot;
  private publish() {
    const counts = new Map<string, number>();
    for (const message of this.entries.values()) counts.set(message, (counts.get(message) ?? 0) + 1);
    this.snapshot = [...counts];
    this.listeners.forEach(listener => listener());
  }
}

const Registry = createContext<ErrorRegistry | null>(null);

/** Group view errors of everything rendered inside, and show their summary first. */
export function ViewErrorGroup({ children }: { children: ReactNode }) {
  const registry = useMemo(() => new ErrorRegistry(), []);
  return <Registry.Provider value={registry}><ViewErrorSummary registry={registry} />{children}</Registry.Provider>;
}

function ViewErrorSummary({ registry }: { registry: ErrorRegistry }) {
  const groups = useSyncExternalStore(registry.subscribe, registry.read);
  if (!groups.length) return null;
  const fields = groups.reduce((sum, [, count]) => sum + count, 0);
  return <details className="notice view-error-summary">
    <summary>{it.viewErrorSummary(fields, groups.length)}</summary>
    <ul>{groups.map(([message, count]) => <li key={message}><code>{message}</code>{count > 1 && <strong> ×{count}</strong>}</li>)}</ul>
  </details>;
}

/**
 * One failed view. Inside a group it is a compact, honest marker (full text on hover and for
 * screen readers) without its own live region; elsewhere it shows the message as before.
 */
export function ViewError({ message, title }: { message: string; title?: string }) {
  const registry = useContext(Registry);
  const id = useId();
  useEffect(() => {
    if (!registry) return;
    registry.add(id, message);
    return () => registry.remove(id);
  }, [registry, id, message]);
  if (!registry) return <div role="status" data-view-error className="unsupported view-error" title={title}>
    {title && <span className="sr-only">{title} </span>}{message}</div>;
  return <div data-view-error className="unsupported view-error view-error-compact" title={message}>
    {it.notCalculable}<span className="sr-only">: {message}</span></div>;
}
