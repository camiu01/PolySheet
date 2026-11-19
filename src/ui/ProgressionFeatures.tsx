/** @file Draft-only feature choices within the centered advancement form. */
import type { selectableProgressionFeatures } from '../engine/progression-selectable';
import { it } from './it';

/** Native checkbox groups share the advancement's busy state and single atomic confirmation. */
export function ProgressionFeatures({ features, drafts, onChange }: {
  features: ReturnType<typeof selectableProgressionFeatures>;
  drafts: Record<string, string[]>;
  onChange: (featureId: string, selected: string[]) => void;
}) {
  if (!features.length) return null;
  return <section className="progression-summary progression-features" aria-labelledby="progression-features-title">
    <h3 id="progression-features-title">{it.progressionSelectable}</h3>
    <p className="muted">{it.progressionSelectableHelp}</p>
    {features.map(feature => {
      const selected = Object.hasOwn(drafts, feature.featureId) ? drafts[feature.featureId] : feature.selected;
      return <fieldset key={feature.featureId} className="progression-feature">
        <legend>{feature.name}</legend>
        <p className="muted mono" aria-live="polite">{it.progressionSelectableCount(selected.length, feature.maximum)}</p>
        {feature.options.map(option => <label key={option.id} className="check-field">
          <input type="checkbox" name={feature.featureId} value={option.id} checked={selected.includes(option.id)}
            disabled={!selected.includes(option.id) && selected.length >= feature.maximum}
            onChange={event => onChange(feature.featureId, event.target.checked
              ? [...selected, option.id] : selected.filter(id => id !== option.id))} />
          <span>{option.name}</span>
        </label>)}
        {!feature.options.length && <p className="muted">{it.noOptions}</p>}
      </fieldset>;
    })}
  </section>;
}
