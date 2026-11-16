/** @file Explicit level/HP assistance, with unexecuted source choices kept visible. */
import { useRef, useState } from 'react';
import type { Character, ResourceInstance, StoredSystem } from '../domain/model';
import { progressionArchetypes, progressionClasses, progressionContract, progressionEvaluator } from '../engine/progression';
import { advanceCharacter, previewNewClass } from '../persistence/progression';
import { Modal, Warning } from './shared';
import { it } from './it';

/** Keep drafts local until one guarded command; closing never advances or rolls dice. */
export function CharacterProgression({ character, system, resources, onClose }: {
  character: Character; system: StoredSystem; resources: ResourceInstance[]; onClose: () => void;
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
  const [error, setError] = useState(''), [result, setResult] = useState('');
  const lock = useRef(false), selection = useRef(0);
  const close = () => { if (!lock.current) { selection.current++; onClose(); } };
  try {
    const contract = progressionContract(system), classes = progressionClasses(system, snapshot, resources);
    const evaluator = progressionEvaluator(system, snapshot, resources);
    const level = evaluator.get('level'), mode = evaluator.get('hit_point_mode');
    if (typeof level !== 'number' || typeof mode !== 'string' || !classes.length) throw new Error(it.progressionUnsupported);
    const selected = classes.find(choice => choice.record.id === wrapperId) ?? classes[0];
    const total = target ?? level + 1;
    const staged = multiclass ? preview : { character: snapshot, resources, wrapperId: selected.record.id };
    const options = staged && progressionArchetypes(system, staged.character, staged.resources, staged.wrapperId,
      (multiclass ? 0 : selected.level) + total - level);
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
      {result ? <><p role="status">{result}</p><Warning>{it.progressionChoices}</Warning>
        <div className="modal-actions"><button className="button primary" onClick={close}>{it.close}</button></div></>
        : <form className="source-form" onSubmit={event => {
          event.preventDefault();
          if (lock.current || loading || !acknowledged || multiclass && (!manual || !preview)) return;
          lock.current = true; setBusy(true); setError('');
          void advanceCharacter(snapshot.id, snapshot.revision, {
            wrapperId: selected.record.id, expectedClassLevel: selected.level, targetLevel: total,
            archetypeId: archetype || null, acknowledgeChoices: acknowledged,
            ...(multiclass ? { newClassId: template, manualPrerequisites: manual } : {})
          }).then(saved => setResult(`${it.progressionSaved} ${it.classLevel}: ${saved.level} · HP max: ${saved.maxHp} · +${saved.baseHpGain} HP base`))
            .catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
            .finally(() => { lock.current = false; setBusy(false); });
        }}>
          <div className="source-form-fields"><fieldset className="source-form-controls" disabled={busy}>
            <p className="muted">{it.progressionHelp}</p>
            <p>{it.progressionCurrent}: <strong>{level}</strong> · {it.progressionHpMode}: <strong>{mode}</strong></p>
            <label className="field"><span>{it.progressionTarget}</span><input type="number" min={level + 1} max={contract.maxLevel}
              required step={1} value={Number.isNaN(total) ? '' : total} onChange={event => setTarget(event.target.value === '' ? NaN : event.target.valueAsNumber)} /></label>
            <label className="check-field"><input type="checkbox" checked={multiclass} onChange={event => {
              setMulticlass(event.target.checked); setArchetype(''); setManual(false); setAcknowledged(false);
            }} />{it.progressionMulticlass}</label>
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
            <p className="muted">{it.progressionRoll}</p>
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
