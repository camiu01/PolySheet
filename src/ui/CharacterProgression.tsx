/** @file Atomic level/HP and selectable-feature assistance, with remaining source choices visible. */
import { useRef, useState } from 'react';
import type { Character, ResourceInstance, StoredSystem } from '../domain/model';
import { abilityIncreaseLevels, abilityIncreaseOptions, hitPointModes, levelChoiceCommit, pendingLevelChoices, progressionArchetypes, progressionClasses, progressionContract, progressionEvaluator, progressionPreview,
  type ProgressionSummary } from '../engine/progression';
import { advanceCharacter, applyAbilityIncrease, applyLevelChoices, previewNewClass } from '../persistence/progression';
import { Modal, Warning } from './shared';
import { it } from './it';
import { RenderView, type RenderContext } from './renderer';
import { selectableProgressionFeatures } from '../engine/progression-selectable';
import { ProgressionFeatures } from './ProgressionFeatures';

/** Keep drafts local until one guarded command; closing never advances or rolls dice. */
export function CharacterProgression({ character, system, resources, onClose, sheet }: {
  character: Character; system: StoredSystem; resources: ResourceInstance[]; onClose: () => void;
  /** The live sheet context; level choices are edited in it, exactly as on the sheet. */
  sheet?: RenderContext;
}) {
  const [snapshot] = useState(character);
  const [wrapperId, setWrapperId] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [archetype, setArchetype] = useState('');
  const [multiclass, setMulticlass] = useState(false);
  const [template, setTemplate] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewNewClass>>>();
  const [manual, setManual] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [result, setResult] = useState<{ text: string; summary: ProgressionSummary; increases: number[] }>();
  const [hpMode, setHpMode] = useState<string>();
  const [featureDrafts, setFeatureDrafts] = useState<{ key: string; values: Record<string, string[]> }>({ key: '', values: {} });
  const lock = useRef(false), selection = useRef(0);
  const close = () => { if (!lock.current) { selection.current++; onClose(); } };
  try {
    const contract = progressionContract(system), classes = progressionClasses(system, snapshot, resources);
    const evaluator = progressionEvaluator(system, snapshot, resources);
    const level = evaluator.get('level'), imported = system.definition.character_stats.some(stat => stat.id === 'hit_point_mode') ? evaluator.get('hit_point_mode') : undefined, modes = hitPointModes(system);
    const mode = hpMode ?? imported;
    // PF2e derives HP from levels: no imported HP method, no dice and no multiclass wrapper preview here.
    const rolled = contract.kind === 'class_details';
    if (typeof level !== 'number' || rolled && typeof mode !== 'string' || !classes.length) throw new Error(it.progressionUnsupported);
    const selected = classes.find(choice => choice.record.id === wrapperId) ?? classes[0];
    const total = target ?? level + 1;
    const staged = multiclass ? preview : { character: snapshot, resources, wrapperId: selected.record.id };
    const options = staged && progressionArchetypes(system, staged.character, staged.resources, staged.wrapperId,
      (multiclass ? 0 : selected.level) + total - level);
    const featureKey = `${staged?.wrapperId}:${total}:${archetype}`;
    const drafts = featureDrafts.key === featureKey ? featureDrafts.values : {};
    const features = !result && rolled && staged && Number.isSafeInteger(total) && total > level && total <= contract.maxLevel
      ? selectableProgressionFeatures(system, staged.character, staged.resources, staged.wrapperId,
        (multiclass ? 0 : selected.level) + total - level, archetype || null) : [];
    async function selectTemplate(id: string) {
      const token = ++selection.current;
      setTemplate(id); setPreview(undefined); setArchetype(''); setError(''); setLoading(!!id);
      if (!id) return;
      try {
        const next = await previewNewClass(snapshot.id, id);
        if (selection.current === token) setPreview(next);
      } catch (cause) { if (selection.current === token) setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { if (selection.current === token) setLoading(false); }
    }
    return <Modal title={it.progression} onClose={close}>
      {result ? <div className="source-form">
        <div className="source-form-fields"><p role="status" className="progression-saved">{result.text}</p>
          {sheet && <LevelChoices system={system} character={character} context={sheet} />}
          {result.increases.length > 0 && <AbilityIncreases system={system} characterId={snapshot.id} levels={result.increases} resources={resources} />}
          <ProgressionResult summary={result.summary} /></div>
        <div className="modal-actions"><button className="button primary" onClick={close}>{it.close}</button></div></div>
        : <form className="source-form" onSubmit={event => {
          event.preventDefault();
          if (lock.current || loading || !acknowledged || multiclass && (!manual || !preview)) return;
          lock.current = true; setBusy(true); setError('');
          const from = multiclass ? 0 : selected.level;
          const increases = staged ? abilityIncreaseLevels(system, staged.character, staged.resources, staged.wrapperId, from, from + total - level) : [];
          void advanceCharacter(snapshot.id, snapshot.revision, {
            wrapperId: selected.record.id, expectedClassLevel: selected.level, targetLevel: total,
            archetypeId: archetype || null, acknowledgeChoices: acknowledged,
            selectableFeatures: Object.entries(drafts).map(([featureId, selected]) => ({ featureId, selected })),
            ...(hpMode !== undefined && hpMode !== imported ? { hitPointMode: hpMode } : {}),
            ...(multiclass ? { newClassId: template, manualPrerequisites: manual } : {})
          }).then(saved => setResult({ text: `${it.progressionSaved} ${it.classLevel}: ${saved.level} · PF max ${saved.maxHp} (+${saved.baseHpGain})`, summary: saved.summary, increases }))
            .catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
            .finally(() => { lock.current = false; setBusy(false); });
        }}>
          <div className="source-form-fields"><fieldset className="source-form-controls" disabled={busy}>
            <p className="muted">{it.progressionHelp}</p>
            <p>{it.progressionCurrent}: <strong>{level}</strong></p>
            {modes.some(option => option.id === mode) ? <label className="field"><span>{it.progressionHpMode}</span>
              <select value={String(mode)} onChange={event => setHpMode(event.target.value)}>
                {modes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select><small className="muted">{it.progressionHpModeHelp}</small></label>
              : rolled ? <p>{it.progressionHpMode}: <strong>{String(mode)}</strong></p> : <p className="muted">{it.progressionHpDerived}</p>}
            <label className="field"><span>{it.progressionTarget}</span><input type="number" min={level + 1} max={contract.maxLevel}
              required step={1} value={Number.isNaN(total) ? '' : total} onChange={event => setTarget(event.target.value === '' ? NaN : event.target.valueAsNumber)} /></label>
            {level < contract.maxLevel && <div className="button-row progression-shortcuts" role="group" aria-label={it.progressionShortcuts}>
              <button type="button" className="button secondary" aria-pressed={total === level + 1} onClick={() => setTarget(level + 1)}>{it.progressionNext(level + 1)}</button>
              {contract.maxLevel > level + 1 && <button type="button" className="button secondary" aria-pressed={total === contract.maxLevel}
                onClick={() => setTarget(contract.maxLevel)}>{it.progressionMax(contract.maxLevel)}</button>}
            </div>}
            {rolled && <label className="check-field"><input type="checkbox" checked={multiclass} onChange={event => {
              setMulticlass(event.target.checked); setArchetype(''); setManual(false); setAcknowledged(false);
            }} />{it.progressionMulticlass}</label>}
            {!multiclass ? <label className="field"><span>{it.progressionClass}</span><select value={selected.record.id} onChange={event => {
              setWrapperId(event.target.value); setArchetype(''); setAcknowledged(false);
            }}>{classes.map(choice => <option key={choice.record.id} value={choice.record.id}>{choice.name} · {choice.level}</option>)}</select></label>
              : <><label className="field"><span>{it.classChoice}</span><select value={template} onChange={event => void selectTemplate(event.target.value)}>
                <option value="">{it.choose}</option>
                {resources.filter(record => record.definitionId === 'class' && !record.catalogIssue
                  && (record.catalogSource || !record.catalogGroup)).map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
              </select></label><label className="check-field"><input type="checkbox" checked={manual} onChange={event => setManual(event.target.checked)} />{it.progressionManual}</label></>}
            {options?.required && <label className="field"><span>{it.progressionArchetype}</span><select required value={archetype} onChange={event => setArchetype(event.target.value)}>
              <option value="">{it.choose}</option>{options.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select></label>}
            {mode === 'roll' && <p className="muted">{it.progressionRoll}</p>}
            {!multiclass && <ProgressionGains classLevel={selected.level + total - level}
              read={() => progressionPreview(system, snapshot, resources, selected.record.id, selected.level + total - level)} />}
            <ProgressionFeatures features={features} drafts={drafts} onChange={(featureId, selected) =>
              setFeatureDrafts({ key: featureKey, values: { ...drafts, [featureId]: selected } })} />
            <h3>{it.progressionChecklist}</h3><Warning>{it.progressionChoices}</Warning>
            <label className="check-field"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{it.progressionAcknowledge}</label>
          </fieldset></div>
          {error && <p role="alert" className="danger-text">{error}</p>}
          <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>{it.cancel}</button>
            <button type="submit" className="button primary" disabled={busy || loading || !acknowledged || multiclass && (!manual || !preview)
              || !!options?.required && !archetype || total <= level || total > contract.maxLevel || !Number.isSafeInteger(total)}>{busy ? it.saving : it.progression}</button></div>
        </form>}
    </Modal>;
  } catch (cause) {
    return <Modal title={it.progression} onClose={close}><p role="alert">{cause instanceof Error ? cause.message : String(cause)}</p>
      <button className="button secondary" onClick={close}>{it.close}</button></Modal>;
  }
}

/** Class features the selected level adds, read from the imported class before confirming. */
function ProgressionGains({ classLevel, read }: { classLevel: number; read: () => ProgressionSummary }) {
  if (!Number.isSafeInteger(classLevel)) return null;
  const { features, choices } = read();
  return <section className="progression-summary">
    <h3>{it.progressionGains(classLevel)}</h3>
    {features.length ? <ul>{features.map(name => <li key={name}>{name}{choices.includes(name) && <small className="muted"> · {it.progressionChoiceToMake}</small>}</li>)}</ul>
      : <p className="muted">{it.progressionNoGains}</p>}
  </section>;
}

/**
 * The source's ability score improvements gained by this advance (5e `should_show_asi` levels):
 * +1 to two abilities, the same one twice for +2, or a feat instead, as its ASI popup offers.
 */
function AbilityIncreases({ system, characterId, levels, resources }: {
  system: StoredSystem; characterId: string; levels: number[]; resources: ResourceInstance[];
}) {
  const abilities = abilityIncreaseOptions(system);
  const feats = resources.filter(record => record.definitionId === 'feat' && record.catalogSource)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  if (!abilities.length) return null;
  return <section className="progression-choices" aria-labelledby="progression-asi-title">
    <h3 id="progression-asi-title">{it.progressionAsi}</h3>
    <p className="muted">{it.progressionAsiHelp}</p>
    {levels.map(level => <AbilityIncrease key={level} level={level} characterId={characterId} abilities={abilities} feats={feats} />)}
  </section>;
}

function AbilityIncrease({ level, characterId, abilities, feats }: {
  level: number; characterId: string; abilities: { id: string; name: string }[]; feats: ResourceInstance[];
}) {
  const [useFeat, setUseFeat] = useState(false), [first, setFirst] = useState(''), [second, setSecond] = useState('');
  const [feat, setFeat] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [message, setMessage] = useState('');
  const ready = useFeat ? !!feat : !!first && !!second;
  const select = (label: string, value: string, set: (value: string) => void) => <label className="field"><span>{label}</span>
    <select value={value} disabled={done} onChange={event => set(event.target.value)}>
      <option value="">{it.choose}</option>
      {abilities.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></label>;
  return <fieldset className="progression-asi" disabled={busy}>
    <legend>{it.progressionAsiLevel(level)}</legend>
    {feats.length > 0 && <label className="check-field"><input type="checkbox" checked={useFeat} disabled={done}
      onChange={event => setUseFeat(event.target.checked)} />{it.progressionAsiFeat}</label>}
    {useFeat ? <label className="field"><span>{it.progressionAsiFeatPick}</span>
      <select value={feat} disabled={done} onChange={event => setFeat(event.target.value)}>
        <option value="">{it.choose}</option>
        {feats.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
      </select></label>
      : <div className="progression-asi-pair">{select(it.progressionAsiFirst, first, setFirst)}{select(it.progressionAsiSecond, second, setSecond)}</div>}
    <div className="button-row">
      <button type="button" className="button secondary" disabled={!ready || done} onClick={() => {
        setBusy(true); setMessage('');
        void applyAbilityIncrease(characterId, useFeat ? { featId: feat } : { abilities: [first, second] })
          .then(() => { setDone(true); setMessage(it.progressionChoicesApplied); })
          .catch(cause => setMessage(cause instanceof Error ? cause.message : String(cause))).finally(() => setBusy(false));
      }}>{busy ? it.saving : it.progressionApplyChoices}</button>
      {message && <span role="status">{message}</span>}
    </div>
  </fieldset>;
}

/** What the confirmed advancement changed on the sheet. */
function ProgressionResult({ summary }: { summary: ProgressionSummary }) {
  const shown = (value: unknown) => typeof value === 'number' || typeof value === 'string' ? String(value) : '—';
  return <div className="progression-summary">
    <section><h3>{it.progressionImproved}</h3>
      {summary.improved.length ? <ul>{summary.improved.map((row, index) => <li key={index}>
        <span>{row.name}</span> <strong>{shown(row.before)} → {shown(row.after)}</strong></li>)}</ul>
        : <p className="muted">{it.progressionNothingImproved}</p>}</section>
    {summary.features.length > 0 && <section><h3>{it.progressionNewFeatures}</h3>
      <ul>{summary.features.map(name => <li key={name}>{name}</li>)}</ul></section>}
    {summary.choices.length > 0 && <section><h3>{it.progressionOpenChoices}</h3>
      <p className="muted">{it.progressionOpenChoicesHelp}</p>
      <ul>{summary.choices.map(name => <li key={name}>{name}</li>)}</ul></section>}
    <section><h3>{it.progressionRecovered}</h3><p className="muted">{it.progressionNothingRecovered}</p></section>
    <Warning>{it.progressionChoices}</Warning>
  </div>;
}

/**
 * The source's own level choices, edited on the live sheet: the PF2e grants of the current level still
 * open (feat slots, ability boosts, skill increases), the records its level-up popup edits. Controls
 * write the grants; «Applica le scelte» then runs the source's commit program for them.
 */
function LevelChoices({ system, character, context }: { system: StoredSystem; character: Character; context: RenderContext }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const commit = levelChoiceCommit(system);
  if (!commit) return null;
  const pending = pendingLevelChoices(system, character, context.resources ?? []);
  return <section className="progression-choices" aria-labelledby="progression-choices-title">
    <h3 id="progression-choices-title">{it.progressionChoicesNow}</h3>
    {pending.length ? <>
      <p className="muted">{it.progressionChoicesNowHelp(pending.length)}</p>
      {pending.map((grant, index) => <RenderView key={grant.resourceId} context={{ ...context, variables: { ...context.variables, $choice: grant } }}
        input={{ id: `polysheet-level-choice-${index}`, type: 'resource', stat: '$choice', resource_id: 'progression_grant', view_type: 'edit' }} />)}
    </> : <p className="muted">{it.progressionNoChoices}</p>}
    <div className="button-row">
      <button type="button" className="button primary" disabled={busy} onClick={() => {
        setBusy(true); setMessage('');
        void applyLevelChoices(character.id).then(() => setMessage(it.progressionChoicesApplied))
          .catch(cause => setMessage(cause instanceof Error ? cause.message : String(cause))).finally(() => setBusy(false));
      }}>{busy ? it.saving : it.progressionApplyChoices}</button>
      {message && <span role="status">{message}</span>}
    </div>
  </section>;
}
