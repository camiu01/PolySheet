/** @file Show imported prefilters explicitly and allow the player to broaden local selection. */
import { useState } from 'react';
import type { ResourceDefinition, ResourceInstance } from '../domain/model';
import { createEvaluator } from '../engine/formulas';
import { filterResources, resourceFilters } from '../engine/resource-filters';
import type { RenderContext } from './renderer';
import { LocalResourcePicker } from './LocalResourcePicker';
import { it } from './it';

/** Prefilters use the current parent draft, never a candidate's or another form's `$view`. */
export function FilteredResourcePicker({ input, definition, context, resources, busy, onSelect }: {
  input: unknown; definition: ResourceDefinition; context: RenderContext;
  resources: ResourceInstance[]; busy: boolean; onSelect: (record: ResourceInstance) => void;
}) {
  const [disabled, setDisabled] = useState<string[]>([]);
  try {
    const engine = createEvaluator(context.stats, context.previewValues ?? context.values, undefined, context);
    const filters = resourceFilters(input, definition, engine.evaluate);
    const active = filters.filter(filter => !disabled.includes(filter.stat));
    const matches = filterResources(resources, definition, active, context);
    return <>
      {filters.length > 0 && <fieldset className="resource-prefilters" disabled={busy}>
        <legend>{it.sourceResourceFilters}</legend>
        <p className="field-help">{it.sourceResourceFiltersHelp}</p>
        {filters.map(filter => <label className="check-field" key={filter.stat}>
          <input type="checkbox" checked={!disabled.includes(filter.stat)} onChange={event =>
            setDisabled(current => event.target.checked ? current.filter(id => id !== filter.stat) : [...current, filter.stat])} />
          <span>{filter.name}: {filter.values.map(value => typeof value === 'boolean' ? value ? it.yes : it.no : String(value)).join(', ')}</span>
        </label>)}
      </fieldset>}
      <LocalResourcePicker resources={matches} busy={busy} onSelect={onSelect} sorting={{ definition, environment: context }} />
    </>;
  } catch (error) {
    return <p role="alert" data-view-error className="unsupported">{error instanceof Error ? error.message : String(error)}</p>;
  }
}
