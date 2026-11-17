/** @file Source stat presentation, safe dynamic colors and centered detail forms. */
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { View } from '../domain/model';
import { RenderView, ScalarInput, type RenderContext } from './renderer';
import { inputValue, saveInput, textValue, viewBounds, viewColor } from './view-support';
import { SourceForm } from './SourceForm';
import { Modal } from './shared';
import { it } from './it';
import { canSourceEvent } from './CharacterEvents';
import { NumericAdjustment } from './NumericAdjustment';

/** Keep source tap-event precedence; detail edits use the existing atomic form scope. */
export function SourceStat({ node: v, context: ctx, evaluate: e }: {
  node: View; context: RenderContext; evaluate: (input: unknown) => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const cancelHold = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => cancelHold, []);
  const stat = ctx.stats.find(s => s.id === v.stat);
  if (!stat) throw new Error(`Statistica mancante: ${String(v.stat)}`);
  const value = e({ type: 'stat', stat: stat.id });
  const editId = typeof v.edit_stat === 'string' ? v.edit_stat : stat.id;
  const edit = ctx.stats.find(s => s.id === editId && s.type === 'base' && ['integer', 'decimal', 'string', 'bool'].includes(s.value_type));
  const name = v.override_label ? textValue(e(v.override_label)) : stat.name;
  const shown = typeof value === 'number' && v.always_show_sign === true && value >= 0 ? `+${value}` : textValue(value);
  const details = v.bottom_sheet_view != null && v.on_tap_event == null;
  const tap = canSourceEvent(ctx, v.on_tap_event);
  const longTap = canSourceEvent(ctx, v.on_long_tap_event);
  const editValue = edit ? e({ type: 'stat', stat: edit.id }) : undefined;
  const { minimum, maximum } = viewBounds(v, e);
  const adjustment = v.edit_bottom_sheet_title != null && v.on_tap_event == null && !details
    && !!edit && ['integer', 'decimal'].includes(edit.value_type) && typeof editValue === 'number' && v.change_amount !== 0 && !!ctx.onCommit;
  const title = adjustment ? textValue(e(v.edit_bottom_sheet_title)) : v.sheet_title != null ? textValue(e(v.sheet_title)) : name;
  return <div className={`stat-block ${v.style === 'list' ? 'stat-list' : ''}`}>
    <span className="stat-label" style={{ color: viewColor(v.name_color, e) }}>{name}</span>
    {details || tap || longTap || adjustment ? <button type="button" className="stat-detail-trigger" disabled={ctx.eventBusy}
      onPointerDown={event => {
        if (!longTap || event.button !== 0 || !event.isPrimary) return;
        held.current = false; origin.current = { x: event.clientX, y: event.clientY }; cancelHold();
        timer.current = setTimeout(() => { held.current = true; ctx.onEvent?.(v.on_long_tap_event); }, 600);
      }}
      onPointerMove={event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancelHold(); }}
      onPointerUp={cancelHold} onPointerCancel={() => { cancelHold(); held.current = false; }} onPointerLeave={cancelHold}
      onContextMenu={event => { if (longTap) event.preventDefault(); }}
      aria-label={`${tap ? it.eventExecute : adjustment ? it.edit : it.details} · ${name}`} onClick={event => {
        if (held.current) { held.current = false; if (event.detail !== 0) return; }
        if (tap) ctx.onEvent?.(v.on_tap_event); else if (details || adjustment) setOpen(true);
      }}>
      <output data-testid={`stat-${stat.id}`} className="stat-value" style={{ color: viewColor(v.stat_color, e) }}>{shown || '—'}</output>
    </button> : <output data-testid={`stat-${stat.id}`} className="stat-value" style={{ color: viewColor(v.stat_color, e) }}>{shown || '—'}</output>}
    {stat.type === 'calculated' && <small className="calculated">{it.calculated}</small>}
    {longTap && <button type="button" className="icon-button stat-more" disabled={ctx.eventBusy}
      aria-label={`${it.longTapAction} · ${name}`} title={`${it.longTapAction} · ${name}`}
      onClick={() => ctx.onEvent?.(v.on_long_tap_event)}><MoreHorizontal size={16} aria-hidden="true" /></button>}
    {ctx.onChange && edit && v.change_amount !== 0 && <ScalarInput key={ctx.drafts ? v.id : `${edit.id}:${String(ctx.values[edit.id])}`} stat={edit}
      value={inputValue(v, ctx, edit)} label={`${it.edit} ${edit.name}`}
      step={typeof v.change_amount === 'number' ? v.change_amount : undefined}
      min={minimum} max={maximum}
      onDraft={ctx.onInput ? next => saveInput(v, ctx, edit.id, next) : undefined}
      onSave={next => saveInput(v, ctx, edit.id, next)} />}
    {open && <Modal title={title} onClose={() => !busy && setOpen(false)}>
      {adjustment && edit && typeof editValue === 'number' ? <NumericAdjustment stat={edit} value={editValue} context={ctx}
        minimum={minimum} maximum={maximum}
        onBusyChange={setBusy} onDone={() => setOpen(false)} />
        : v.bottom_sheet_in_edit_mode === true
        ? <SourceForm input={v.bottom_sheet_view} context={ctx} onBusyChange={setBusy} onDone={() => setOpen(false)} />
        : <ReadOnlyDetail input={v.bottom_sheet_view} context={ctx} />}
    </Modal>}
  </div>;
}

/** A display detail is not part of its parent's input session. */
function ReadOnlyDetail({ input, context }: { input: unknown; context: RenderContext }) {
  const variables: Record<string, unknown> = { ...context.variables, $edit_mode: false };
  delete variables.$view;
  return <RenderView input={input} context={{ ...context, variables, onChange: undefined, onInput: undefined,
    onCommit: undefined, onEvent: undefined, canEvent: undefined, drafts: undefined, validationErrors: undefined }} />;
}
