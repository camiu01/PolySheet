/**
 * @file Official `character_creation_flow` pages as one local draft.
 * @remarks Each page is the source view rendered through the existing scoped
 * form; nothing is persisted before the final page is confirmed. Page hooks run
 * on the draft only (see `runCreationHook`): `on_page_open` when a page is shown,
 * then on confirmation `post_edit` and `on_page_close`. Back runs `on_page_close`
 * and discards the current page's unconfirmed edits. `pre_edit` is not executed.
 */
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { object, type StoredSystem } from '../domain/model';
import { db, initialValues } from '../persistence/db';
import { configureCharacter } from '../persistence/catalog';
import { RuntimeResource } from '../engine/formulas';
import { runCreationHook, type CreationDraft } from '../engine/creation-hooks';
import { mergeStaged, SourceForm } from './SourceForm';
import { Warning, type Run } from './shared';
import { runCharacterEvent } from '../persistence/character-events';
import { it } from './it';

/** Displayable page title: `displayableData.name`, a plain string, or a numbered fallback. */
export function creationPageTitle(page: Record<string, unknown>, index: number): string {
  const title = page.title;
  if (typeof title === 'string' && title) return title;
  if (title && typeof title === 'object' && !Array.isArray(title) && typeof object(title).name === 'string') return String(object(title).name);
  return it.creationPage(index + 1, index + 1);
}

/** Only values that differ from the declared defaults are committed. */
function changedValues(values: Record<string, unknown>, defaults: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([id, value]) => JSON.stringify(value) !== JSON.stringify(defaults[id])));
}

/** Walk the source pages in order; Back discards the current page, Cancel discards everything. */
export function CreationFlow({ system, run, onDone, onClose }: {
  system: StoredSystem; run: Run; onDone: (id: string) => void; onClose: () => void;
}) {
  const definition = system.definition;
  const pages = definition.character_creation_flow.map(page => object(page));
  const defaults = initialValues(definition.character_stats);
  const [index, setIndex] = useState(-1);
  const [draft, setDraft] = useState<CreationDraft>({ values: defaults, staged: [], skipped: [] });
  const [hookError, setHookError] = useState('');
  const records = useLiveQuery(() => db.resources.where('systemKey').equals(system.key).toArray(), [system.key]);
  const hook = (field: string, at: number, from: CreationDraft, updatedStats: string[] = []) =>
    runCreationHook(pages[at]?.[field], definition, from, records ?? [], definition.enumerated_types, { updatedStats });

  /** Show page `at`, running its open hook; a failing hook leaves the draft unchanged and visible. */
  function open(at: number, from: CreationDraft) {
    try { setDraft(hook('on_page_open', at, from)); setHookError(''); }
    catch (cause) { setDraft(from); setHookError(cause instanceof Error ? cause.message : String(cause)); }
    setIndex(at);
  }
  useEffect(() => { if (records && index < 0) open(0, draft); }, [records]);
  if (!records || index < 0) return <p className="muted">{it.saving}</p>;

  const page = pages[index];
  const nameId = definition.character_display_name ?? 'name';
  /** Persist the merged draft atomically; failures stay inline in the final page form. */
  async function finish(next: CreationDraft) {
    const name = next.values[nameId];
    if (typeof name !== 'string' || !name.trim()) throw new Error(it.creationNameRequired);
    const { id } = await configureCharacter(system, name, changedValues(next.values, defaults), {}, undefined, db, false, next.staged);
    onDone(id);
    // Events fired by page hooks run as ordinary character commands once the character exists.
    if (next.events?.length) void run(async () => { for (const event of next.events!) await runCharacterEvent(id, event); });
  }

  return <section className="creation-flow" aria-label={it.creationFlow}>
    <ol className="creation-steps" aria-label={it.creationPage(index + 1, pages.length)}>{pages.map((p, i) =>
      <li key={i} className={i < index ? 'done' : undefined} aria-current={i === index ? 'step' : undefined}>
        <span className="step-mark" aria-hidden="true">{i < index ? <Check size={14} /> : i + 1}</span>
        <span className="step-name">{creationPageTitle(p, i)}</span>
      </li>)}</ol>
    <p className="muted creation-help">{it.creationFlowHelp}</p>
    {page.pre_edit != null && <Warning>{it.creationHooksPending}: pre_edit</Warning>}
    {draft.skipped.length > 0 && <Warning>{it.creationHooksPending}: {[...new Set(draft.skipped)].join(', ')}</Warning>}
    {hookError && <p role="alert" className="error-text">{hookError}</p>}
    <SourceForm key={index} revealErrorsOnSubmit input={page.view} saveText={index === pages.length - 1 ? it.create : it.next}
      cancelText={index === 0 ? it.cancel : it.back}
      onCancel={() => index === 0 ? onClose() : open(index - 1, hook('on_page_close', index, draft))} onDone={() => undefined}
      context={{
        stats: definition.character_stats, values: draft.values, systemKey: system.key,
        resources: [...records.filter(r => !draft.staged.some(s => s.id === r.id)), ...draft.staged],
        resourceDefinitions: definition.resources, stagedIds: draft.staged.map(r => r.id),
        enumerations: definition.enumerated_types, variables: { $is_new: true },
        // PF2e class views test `defined($character.$is_new)`.
        character: new RuntimeResource('character:creation', definition.character_stats, draft.values, undefined, { $is_new: true }),
        onCommit: async (patch, created = []) => {
          const changes = typeof patch === 'function' ? patch({ ...draft.values }) : patch;
          let next: CreationDraft = { ...draft, values: { ...draft.values, ...changes }, staged: mergeStaged(draft.staged, created) };
          next = hook('on_page_close', index, hook('post_edit', index, next, Object.keys(changes)));
          if (index === pages.length - 1) return finish(next);
          open(index + 1, next);
        }
      }} />
  </section>;
}
