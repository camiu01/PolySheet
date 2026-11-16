/** @file Explicit, bounded numeric changes. Closing the dialog never writes. */
import { useRef, useState } from 'react';
import type { Stat } from '../domain/model';
import type { RenderContext } from './renderer';
import { it } from './it';

/** Apply a delta to the latest value, retaining unrelated concurrent edits. */
export function NumericAdjustment({ stat, value, context, minimum, maximum, onDone, onBusyChange }: {
  stat: Stat; value: number; context: RenderContext; minimum?: number; maximum?: number; onDone: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function apply(direction: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      const delta = Number(amount);
      if (!amount.trim() || !Number.isFinite(delta) || delta < 0) throw new Error(it.invalidNumber);
      const patch = (latest: Record<string, unknown>) => {
        const current = latest[stat.id] ?? stat.default_value;
        if (typeof current !== 'number') throw new Error(it.invalidNumber);
        const next = current + direction * delta;
        if (!Number.isFinite(next) || stat.value_type === 'integer' && !Number.isSafeInteger(next)
          || minimum != null && next < minimum || maximum != null && next > maximum) throw new Error(it.invalidNumber);
        return { [stat.id]: next };
      };
      if (!context.onCommit) throw new Error(it.formReadOnly);
      await context.onCommit(patch); onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <div className="source-form">
    <p>{it.currentValue}: <strong>{value}</strong></p>
    <label className="field"><span>{it.adjustmentAmount}</span><input type="number" min="0"
      step={stat.value_type === 'integer' ? 1 : 'any'} value={amount} disabled={busy}
      onChange={event => setAmount(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="modal-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onDone}>{it.cancel}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void apply(-1)}>{it.subtract}</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => void apply(1)}>{it.add}</button>
    </div>
  </div>;
}
