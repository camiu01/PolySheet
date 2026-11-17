/** @file Real scoped source drafts. Nothing is persisted before a successful Save. */
import { useEffect, useRef, useState } from 'react';
import { matchesType, type ResourceInstance } from '../domain/model';
import { draftCalculations, initialDrafts, inputStat, scopedDrafts, sessionViews, validationMessages } from '../engine/view-session';
import { RenderView, type RenderContext } from './renderer';
import { it } from './it';
import { RuntimeResource } from '../engine/formulas';

/** Merge staged records; a re-staged id replaces its earlier copy and keeps children first. */
export function mergeStaged(previous: ResourceInstance[], created: ResourceInstance[]) {
  const ids = new Set(created.map(r => r.id));
  return [...previous.filter(r => !ids.has(r.id)), ...created];
}

/**
 * Stage one form with local input shadowing, validate source messages and submit one atomic patch.
 * @remarks With `autoApply`, every change is forwarded to `context.onCommit` immediately and no
 * buttons are shown; used for draft-only nested resources inside an enclosing draft.
 */
export function SourceForm({ input, context, onDone, onCancel = onDone, onBusyChange, saveText = it.save, cancelText = it.cancel, showSave = true, showCancel = true, autoApply = false, revealErrorsOnSubmit = false }: {
  input: unknown; context: RenderContext; onDone: () => void;
  /** Defaults to `onDone`; a multi-page owner can distinguish going back from completion. */
  onCancel?: () => void;
  autoApply?: boolean;
  /** Keep Save enabled and show source validation only after a first attempt (guided creation). */
  revealErrorsOnSubmit?: boolean;
  saveText?: string; cancelText?: string; showSave?: boolean; showCancel?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const sourceValues = context.previewValues ?? { ...context.values, ...context.overrides };
  const [drafts, setDrafts] = useState<Record<string, unknown>>(() => {
    try { return initialDrafts(input, context.stats, sourceValues); } catch { return {}; }
  });
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const latestChanges = useRef<Record<string, unknown>>({});
  const [additions, setAdditions] = useState<ResourceInstance[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    if (!autoApply || !context.onCommit || (!Object.keys(changes).length && !additions.length)) return;
    context.onCommit(changes, additions).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
  // Re-apply only when this form's own staged state changes, never on parent re-renders.
  }, [autoApply, changes, additions]);
  try {
    const nodes = sessionViews(input);
    const environment = { ...context, resources: mergeStaged(context.resources ?? [], additions),
      stagedIds: [...(context.stagedIds ?? []), ...additions.map(r => r.id)],
      variables: { ...context.variables, $view: scopedDrafts(context.variables?.$view, drafts), $edit_mode: true },
      character: context.character?.stats === context.stats
        ? new RuntimeResource(context.character.key, context.stats, { ...sourceValues, ...changes }, context.createdAt, context.character.variables)
        : context.character };
    const errors = validationMessages(input, context.stats, context.values, drafts, environment);
    function update(id: string, value: unknown) {
      latestChanges.current = { ...latestChanges.current, [id]: value };
      setChanges(previous => ({ ...previous, [id]: value }));
      setDrafts(previous => ({ ...previous, ...Object.fromEntries(nodes.filter(v => inputStat(v, context.stats)?.id === id).map(v => [v.id, value])) }));
    }
    const formContext: RenderContext = {
      ...environment, drafts, previewValues: { ...sourceValues, ...changes }, validationErrors: errors,
      hideValidation: revealErrorsOnSubmit ? !attempted : context.hideValidation, onChange: showSave ? update : undefined, onInput: showSave ? (_viewId, id, value) => update(id, value) : undefined,
      onCommit: showSave ? async (patch, created = []) => {
        const next = typeof patch === 'function' ? patch({ ...sourceValues, ...latestChanges.current }) : patch;
        for (const [id, value] of Object.entries(next)) update(id, value);
        setAdditions(previous => mergeStaged(previous, created));
      } : undefined
    };
    const body = <>
      <div className="source-form-fields"><fieldset disabled={busy} className="source-form-controls"><RenderView input={input} context={formContext} />
        <div className="base-grid">{autoApply ? null : draftCalculations(context.stats, drafts).filter(s => ['string', 'integer', 'decimal', 'bool'].includes(s.value_type)).map(s =>
          <RenderView key={s.id} input={{ id: `polysheet-derived-${s.id}`, type: 'stat', stat: s.id }} context={{ ...formContext, onChange: undefined, onInput: undefined }} />
        )}</div>
      </fieldset></div>
      {error && <p role="alert" className="error-text">{error}</p>}
      {revealErrorsOnSubmit && attempted && Object.keys(errors).length > 0 && <p role="status" className="error-text form-summary">{it.completeHighlighted}</p>}
      {!autoApply && <div className="modal-actions">
        {showCancel && <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>{cancelText}</button>}
        {showSave && <button type="submit" className="button primary" disabled={busy || !context.onCommit || (!revealErrorsOnSubmit && Object.keys(errors).length > 0)}>{busy ? it.saving : saveText}</button>}
      </div>}
    </>;
    // A nested auto-applied form must not be a second <form> inside its owner's form.
    if (autoApply) return <div className="source-form" role="group" data-invalid={Object.keys(errors).length ? 'true' : undefined}>{body}</div>;
    return <form className="source-form" onSubmit={event => {
      event.preventDefault(); event.stopPropagation();
      const form = event.currentTarget;
      if (lock.current) return;
      if (Object.keys(errors).length || form.querySelector('[aria-invalid="true"],[data-view-error],[data-invalid="true"]')) {
        setAttempted(true);
        requestAnimationFrame(() => form.querySelector('.source-form-fields [role="alert"],[aria-invalid="true"],[data-view-error]')?.scrollIntoView({ block: 'center' }));
        return;
      }
      lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
      void (async () => {
        try {
          if (!context.onCommit) throw new Error(it.formReadOnly);
          for (const [id, value] of Object.entries(changes)) {
            const s = context.stats.find(s => s.id === id && s.type === 'base');
            if (!s || !matchesType(value, s.value_type, s.sub_value_type)) throw new Error(it.invalidValue);
          }
          await context.onCommit(changes, additions); onDone();
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
      })();
    }}>
      {body}
    </form>;
  } catch (error) {
    return <>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
      {showCancel && !autoApply && <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>{cancelText}</button>
      </div>}
    </>;
  }
}
