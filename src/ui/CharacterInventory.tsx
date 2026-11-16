/** @file Manual inventory uses declared source fields and existing resource forms. */
import type { RenderContext } from './renderer';
import { SourceResourceSection, SourceResourceSelect } from './SourceViews';
import { it } from './it';

/** Offer only typed inventory arrays; never infer class equipment or equip effects. */
export function CharacterInventory({ context }: { context: RenderContext }) {
  const fields = context.stats.filter(stat => stat.type === 'base' && stat.value_type === 'array'
    && stat.sub_value_type === 'resource' && ['item', 'armor', 'weapon'].includes(stat.resource_type ?? '')
    && context.resourceDefinitions?.some(definition => definition.id === stat.resource_type && definition.edit_view));
  if (!fields.length) return null;
  return <section className="setup-group"><h3>{it.inventory}</h3><p className="muted">{it.inventoryHelp}</p>
    {fields.map(field => <section key={field.id}><h4>{field.name}</h4>
      <SourceResourceSelect node={{ id: `inventory-create-${field.id}`, type: 'selectResources',
        stat: field.id, resource_id: field.resource_type, create_in_place: true,
        should_append: true, should_save_on_selection: true }} context={context} />
      <SourceResourceSection node={{ id: `inventory-list-${field.id}`, type: 'resourceSection',
        resource_stat: field.id, resource_id: field.resource_type }} context={context} />
    </section>)}
  </section>;
}
