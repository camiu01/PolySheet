# Compatibility and source evidence

[← README](../README.md) · [Docs index](README.md) · [Executed checks](VERIFICATION.md) · [Local fixture preparation](DEVELOPMENT.md#external-fixtures)

## Reading import results

An imported file passes through four separate stages. Passing one does not
establish the next.

| Stage | What it establishes | What it does not establish |
| --- | --- | --- |
| 1. Decode | An accepted JSON or verified gzip-JSON system envelope, within byte/UTF-8 limits | That the document defines a valid system |
| 2. Validate the definition | Required structure and interpreted-field checks pass; errors block installation | That every formula, component or event is implemented |
| 3. Check runtime support | Diagnostics identify supported handlers and unsupported fields/scopes | That every path will work with missing or later user data |
| 4. Exercise actual use | A stated workflow produces independently expected results, saves and reopens correctly | Full system playability or parity with the original app |

"Supported" means the stated subset and inputs have tests. "Partial" means some
paths work but rule-affecting omissions remain. "Unsupported" means PolySheet
rejects the format or leaves the action visibly unexecuted. A preview with zero
errors may still have hundreds of warnings and produce runtime errors on
unpopulated resource references. No diagnostic count is a compatibility certificate.

## Scoped stat paths, prefilters and card commands, 2026-11-20

Evidence: official 5e 0.9.1 package SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`,
source revision `8788e3b18099e4a1b3510f02869d97f1488586b4`; PF2e 0.3.0 package
`a0f6f3d56e432e1f60625b06e374c21af8237ec01f3ef93024ed45c321b3e679`.
Pointers: `resources[4].stats[*]` (`$parent.level`, `$parent.school`),
`resources[9]` (`$parent.min_level`), `resources[30].stats[*]`
(`$parent.current_level`, `$parent.is_attuned`), `resources[35]`
(`$parent.current_class_details.selected_selectable_feature_ids`),
`resources[37]` (`$parent.archetypes`), `resources[44]` (`$parent.hp`),
`resources[30].display_view.subviews[19..27].stat` (`$resource.traits`,
`$resource.actions`), `resources[1].search_filters`, `resources[1].sort_options`,
`resources[11].stats[28..30].components` (`eventName`),
`character_sheet_sections[3].view.content[0].subviews[2].should_auto_save`,
`resources[6].mechanics` (one popup handler) and `resources[6].list_view.subviews[1].content[1].on_tap_event`.

Semantics observed in the originals: `$parent` names the record that holds the
scope being rendered, so a `levelled_*` resource reads the spell that selected
it and `monster`/`class` read the record that owns them; `$resource` names the
current scope itself. Neither exists at character level, where the same path
stays a reported error. Resource `search_filters` carry the prefilter each local
picker shows, and `sort_options` add a "Sort by" choice to the resource archive (once a type is chosen) and the local picker: enumeration options follow the enumeration's declaration order and group under its entry names, option-resource values group under their `options_display_stat`, booleans use `true_name`/`false_name`, `order: desc` reverses ranked records, and records without a value stay last. The default order is unchanged until the player picks an option; array stats are rejected rather than guessed. `should_auto_save: false` marks a
field the source saves on commit rather than continuously. A card `addToStat`
has no revert subscription in 5e `resources[6].mechanics`, so it writes the
character base value; a second activation stacks instead of failing.

Ambiguities kept visible rather than guessed: a stat path under `$parent` cannot
be validated against a definition, because the owning record varies at runtime;
`resources[30]` references a `monster_instance_trait` type no installed catalog
provides and `$resource.traits`/`actions` fields its stats do not declare;
`on_tap_event` inside resource, combat or draft views still has no owning
character to run a card command; `macros` and `currencies`
remain unimplemented. A combatant type's `is_defeated` formula is evaluated in
the combatant scope and shown as a Defeated badge; it never skips or removes a
turn, because the source does not say what a defeated actor does. A resource
`is_combatant_entry` is recognised but only feeds automatic encounter
generation, which the app does not offer, so it stays reported.

Independently expected values: the official 5e, 5e2024 and PF2e import reports
carry 22, 22 and 38 warnings (from 127/127/213) and no errors; a `$parent.level`
stat on a character is still reported; two CAST activations on a level-1 slot
take it 3 → 1 and a long rest restores 3. `npm run check` passes 409 tests with
one skip and `npm run build` emits 16 precache entries.

Tests: `import.test.ts` (resource-mechanic report, nested and scoped stat paths),
`engine.test.ts` (`eventName`), `renderer.test.tsx` (chip tap event),
`resource-events.test.ts` (card `addToStat`), `source-views.test.tsx`,
`scoped-resource-popup.test.tsx` (`create_if_empty` seeding) and production
`e2e/dnd-catalog-use.spec.ts` / `e2e/sheet-interactions.spec.ts` for the picker
level labels.

## Selective 5e monsters, 2026-11-19

Current gap assessment: [D&D 5e audit](DND5E_AUDIT.md). Older dated entries
and matrix rows below retain their original verification scope; they do not
supersede the newer bounded event, source-compiler and catalog increments.

Evidence: unchanged official 5e 0.9.1 package SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`,
source revision `8788e3b18099e4a1b3510f02869d97f1488586b4`,
`systems/5e/resource_instances/monster_goblin_goblin.json` and
`systems/5e/system/combat_system/combatant_types/monster_instance/index.rpgs`.

Monster files use `.json`, not only `.rpg.json`, and were omitted from both
catalog root mapping and conventional automatic discovery. The new **Cerca
mostri 5e** path reads public GitHub metadata at one immutable commit, searches
original file names locally and downloads only the selected file. The ordinary
preview/confirmation installs its exact original. No complete bestiary download,
byte-limit increase, bundled game content or remote image fetch is introduced.
File/direct-JSON catalog imports also accept typed `monster` roots.

Source photo objects can omit `base64` or `url`; materialization fills only
the absent nullable slots before the existing strict photo validation.
Invalid bytes/extra fields remain invalid and originals remain byte-identical.
An assignment creates a bounded private graph. Encounter addition clones a
compatible monster template only for an instanced combatant and validates the
latest template/system before committing the clone and initializer together.
Failure leaves both encounter and resource archive unchanged. Immutable
templates and other characters' assigned private roots are not offered as
shared mutable combat records.

The public [sequence](https://docs.rpg-companion.app/Effects/sequence)
description explicitly defaults omitted `synchronous` to true, despite its
table marking the field required. The original 5e initializer omits it.
Both diagnostics and runtime now honor that sequential default; false, null
and unsupported options still fail. Other initializer restrictions are unchanged.
Independent Goblin expectations: AC 15; HP `2d6+0`, yielding 6 with both dice
fixed to 3; first/second additions named `Goblin #1` / `Goblin #2`.
Reload/restore never rerolls. The original image URL remains inert.

Tests: `monster-catalogs.test.ts`, `capabilities.test.ts`,
`duplicate-catalog-labels.test.tsx` and production
`e2e/monster-catalogs.spec.ts`. All 1,416 pinned monster files map without
typed assignment blockers, not proof of full action/view compatibility.
The source's unresolved `monster_instance_trait` type and broader limits
remain disclosed in the audit; no source rewrite hides them.

## Resource parent ownership, 2026-11-18

Evidence: official 5e 0.9.1 package SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`,
and source revision `8788e3b18099e4a1b3510f02869d97f1488586b4`:
`systems/5e/system/resources/class/stats.rpgs:214-228,270-271`.
`resources[id=class].stats[id=current_class_details]` reads its owning
`class_details` wrapper through `$parent`; an archetype first reads its parent
class's `current_class_details`. Without this scope, class `level` defaults
to 1 even after the wrapper's saved `class_level` advances.

The public [stat](https://docs.rpg-companion.app/Stat/Formulas/stat) and
[resource](https://docs.rpg-companion.app/System/Resource) pages establish
resource traversal and optional paths, but do not specify a complete
`$parent` contract. The tested policy follows the pinned class formulas:
typed references retain their declaring scope through calculated collections,
sorting and lambdas. Forwarding a reference does not reparent it to the
lookup caller. The same record under two owners has distinct cached values;
ancestor references reuse their scope so cycles still fail within existing
budgets. Unassigned references have no inferred parent.

`resource`, `resourceArray` and `resourceSection` carry that owner into their
rendered resource scopes. `$view` remains local; reading an owner's draft
requires an explicit `$parent.$view` path. Parent metadata is weakly held,
absent from JSON/structured clones, and never added to saved records or
source originals. Reopening derives it from the current reference path.

Independent expectations, covered by `resource-parent.test.ts`,
`resource-context.test.tsx` and the pinned `progression.test.ts`: shared child
levels 2/5 remain isolated; Fighter 2 exposes Action Surge; a selected level-3
archetype resolves its level and wrapper; Fighter 3/Wizard 1 retains Fighter
level 3; Fighter 20 has four attacks per action. Browser acceptance checks
Action Surge in the preview, result and main sheet, plus level text after
reload. This does not establish every system's special context variables,
automatic effect lifecycle, or parent recovery for a standalone ID-only
resource event with no retained reference path.

## Selectable 5e advancement features, 2026-11-19

Evidence: the unchanged official 5e 0.9.1 package SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`
and revision `8788e3b18099e4a1b3510f02869d97f1488586b4`,
`systems/5e/system/resources/feat/{stats,display_view}.rpgs` and
`mechanics/save_selectable_features_choice.rpgs` in that resource directory.
The select `feat_display_selectable_features_select` reads calculated
`chosen_selectable_features`. Its Save mechanic removes this feature's
`selectable_feature_ids` from the destination, appends the draft selection
and deduplicates. `selected_selectable_feature_ids_stat_path` resolves to
`$parent.current_class_details.selected_selectable_feature_ids`, or to the
character's `selected_selectable_feature_ids`.

The level assistant now offers explicit local checkbox drafts **before**
confirmation. It reads the unchanged availability, current selection and
maximum formulas at the proposed class level and subclass, including earlier
unfilled choices. Confirmation rechecks those formulas against the latest
transactional graph, verifies the parent destination is the selected wrapper,
and commits only the submitted features' selections with class/HP changes.
Unrelated selections survive; foreign, duplicate, unavailable and excessive
choices abort the whole command before any HP roll. Multiclass requests use
upstream feature/option identities, not temporary preview record IDs.

Independent expectations from `resource_instances/class_fighter_fighter.rpg.json`
and `class_artificer_artificer__eb_.rpg.json`: Fighting Style allows one selection;
Archery saves `archery1` on the Fighter wrapper, not the character or immutable
catalog. Artificer Infusions first appears at class level 2, permits four choices,
and includes Enhanced Defense but not level-6 Radiant Weapon. At class level 6
the allowance is six and Radiant Weapon becomes available; level 20 allows twelve.
Choosing Fighter through multiclass leaves the Artificer's choices unchanged.
Tests: `progression.test.ts`, `progression-features.test.tsx` and the production
desktop/mobile guided-setup case in `e2e/sheet-interactions.spec.ts`.

This is a bounded manual advancement command, not general support for writing
calculated selects or arbitrary `$parent` event destinations. It stores source
selection IDs as base values, without executing Save callbacks, overriding the
calculated `chosen_selectable_features`, activating equipment effects or granting
external spell resources. General source-card diagnostics remain visible.
Original bytes, import pins, database schema and backup format are unchanged.
The public [select](https://docs.rpg-companion.app/Views/select) and
[setStat](https://docs.rpg-companion.app/Effects/setStat) contracts were inspected;
the source's parent destination and replacement policy above are pinned-source
evidence, not a claim of general upstream override/lifecycle parity.

## Nullable resources and selection filters, 2026-11-16

The 5e race definition's `weapons` calculation tests
`current_level_weapon != null`; `selected_subrace_has_weapon` also tests a
resource against null. These original predicates previously failed the
scalar-only comparison guard. `equals` and `notEquals` now allow a typed
resource reference or trusted runtime resource to be compared with null,
without dereferencing, coercion or deep object comparison. Resource-to-resource
equality and arbitrary object operands remain unsupported. Consecutive
`notEquals` semantics are unchanged.

Evidence: the local Archer 0.9.1 composed JSON, `resources[id=race].stats`,
and the unchanged official 5e package with SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`.
With private Fighter/Human catalogs from revision
`8788e3b18099e4a1b3510f02869d97f1488586b4`, `all_weapons` contains the
catalog's single Unarmed Strike; `attuned_weapons` and `attuned_resources`
are empty, not errors. This does not execute equipment effects.

[selectResources](https://docs.rpg-companion.app/Views/selectResources) defines
`filters` as parent-scope formulas keyed by declared
[SearchFilter](https://docs.rpg-companion.app/System/SearchFilter) stats.
Official 5e `character_sheet_sections[15].view.header[3].filters.classes`
maps class wrappers to class names. The local picker now evaluates that
unchanged formula against the actual parent draft/owner and filters the
correct pinned local records. Filters remain visible and removable; reopening
restores the source proposal. They are search aids, never class prerequisites.

The supported local matching policy is strict equality for scalars, any
overlap for selected arrays, and conjunction across different fields.
Null or an empty selection leaves that field unrestricted. String, bool and
finite numeric filters are supported, including calculated candidate fields;
unknown filters, unsupported types and formula errors remain visible.
The docs do not specify the original client's complete search implementation,
so this does not claim full compendium parity. Inline creation does not apply
search filters. No external spell compendium is installed or fabricated.

Tests: `resource-comparison.test.ts`, `resource-filters.test.tsx`,
`imported-resource-filters.test.ts` and the desktop/mobile guided-setup case.
The latter checks cancel without writes, reset on reopen, clone/append and
offline reopening. Original bytes and backup/database versions are unchanged.
The filter increment had 338 / 337 / 496 warnings for 5e / 5e2024 / PF2e.
Numeric-title support now yields 333 / 332 / 491: five currency
`stat.edit_bottom_sheet_title` fields per system have an implemented editor.
Broader event/mechanic diagnostics remain visible.

## General event/effect pipeline, 2026-11-16

### Scoped resource previews and action diagnostics, 2026-11-17

Inspected [resource views](https://docs.rpg-companion.app/Views/resource),
[creation pages](https://docs.rpg-companion.app/System/CharacterCreationPage)
and [mechanics](https://docs.rpg-companion.app/Mechanic/), against Archer 5e
0.9.1 at `378bdf68f055bae8777a233fc0ac6e4f9eb6145c`.
The unchanged path
`character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view.stat`
is `$view.edit_character_basics_race_select`, not a direct character stat ID.
Resource views now evaluate paths through the existing bounded evaluator.
Nested form scopes retain distinct parent inputs and shadow matching IDs with
local drafts. Validation uses the same scope. The selected local instance still
requires the declared definition and exact import pin; unsafe paths stay invalid.
`create_if_empty: false` is an implemented inert option; `true` remains diagnosed.

Static reference diagnostics collect actual typed inputs, excluding nested
popups and ambiguous duplicate inputs. Display-only duplicate labels are not
draft bindings and do not invalidate the import. The original Archer popup test
uses the unchanged button and a minimal original resource fixture to isolate
selection lookup, not to claim the entire creation page executes.
Independent expectations: a parent selection of Draft must display Draft, not
the committed Committed instance; closing a preview writes nothing; local
validation values shadow parent values. Browser acceptance additionally creates
the resource through nested source controls, cancels it, saves a new selection
and reopens the committed selection offline.

Stat tap/long-press and avatar button diagnostics now check the existing
character dispatcher instead of declaring every event field unknown. Unsupported
resource/combat/draft scopes and handlers retain diagnostics. Current pinned
package totals are 184 / 183 / 357 for 5e / 5e2024 / PF2e, replacing the earlier
273 / 272 / 409 totals. These reductions do not establish full system support.
The broad character mechanics notice now describes partial explicit-command
support rather than incorrectly claiming that no mechanics run.

Still unimplemented from the reported request: the official creation lifecycle
(`pre_edit`, open/close, final `post_edit`), full `progression_systems` effects,
and Archer `resources[1]` armor, `[6]` companion and `[9]` damage-variant mechanics.
Their warnings remain, as do unsupported asynchronous popups and roll callbacks.
This increment fixes scoped previews and inaccurate diagnostics only; it does
not fulfill those remaining automation requests.

### Merge corrections, 2026-11-17

The pinned Archer 0.9.1 JSON from revision
`378bdf68f055bae8777a233fc0ac6e4f9eb6145c`, `mechanics[*].revert_event_names`,
contains an empty string on all 21 mechanics. A blank subscription string means
no subscribed events, not an invalid event name. Empty elements inside a list
or a nonempty comma-separated string remain invalid. The unchanged Archer
`skillTap` action with Dexterity 16 and a deterministic d20 result of 10 again
totals 13; its proficiency popup still targets `acrobatics_proficiency`.

Editable popups retain their opening source event for Save instead of reading
the browser's transient global event. A UI regression checks Cancel, reopen,
Save and preservation of a concurrent unrelated HP edit.

Current pinned-package warning totals are 273 / 272 / 409 for 5e / 5e2024 /
PF2e. Compared with the pre-merge expectations 311 / 310 / 459, the dispatcher
removed two obsolete button-event diagnostics at each of 19 / 19 / 25 source
button nodes. These counts were checked against the original package trees;
this correction does not suppress additional diagnostics or establish that
resource-owned events can execute.

New backups now actually declare v4; v1–v3 readers remain supported, including
previously emitted v3 backups with character override layers.

### Pipeline scope

The pinned 5e 0.6.0 system (`reported-system.rpg`) contains 21 character mechanics:
3 `setStat`, 4 `showPopUp`, 6 `when`, 4 `sequence`, 2 `showMessage`, 2 `roll`.
Event-carrying fields in real source are `on_tap_event`/`on_long_tap_event` on
stats/sections, avatar `bottom_*_button_event`, and `button.event`/`event_names`.

PolySheet now implements the character-level dispatcher with persistent,
reversible overrides. Exactly one matching character mechanic runs per event;
multiple handlers or `calculated_event_names` remain explicit errors. Reversion
(`revert_event_names`) removes that mechanic's overrides entirely. Supported
effects: `sequence`, `when`, `setStat`, `addToStat`, `fireEvent`, `forwardEvent`,
`forEach`, `roll` (without `on_result_effect`), `showMessage`. Terminal effects
(`showPopUp`, `roll`) execute at most one per command. Value overrides (`setStat`)
and modifier overrides (`addToStat`) are stored separately per mechanic and
combined with deterministic `sum`/`max`/`min` aggregation; `set`/`none` clashes
require an upstream user prompt and stay a visible error. A manual base edit
clears value overrides for that field; modifiers remain additive.

Resource-scoped events (2026-11-18): `fireEvent.event_names` accepts a static
`list` of constant names or `eventName` nodes; computed lists (`map`, `stat`)
stay errors. An `eventName` with `for_resource` runs the single matching
mechanic of that resource instance; a resource without a handler is unchanged,
because sources fire these names at every class or archetype (PF2e
`resource_daily_preparations`). Handlers may only touch instances reachable
from the character's own values, never catalog roots. Resource writes are
`setStat` with `set` aggregation on base stats (the instance has no override
layer); `$character.stat` writes become overrides of the character mechanic
that fired the event, so reverting it reverts both; `$variable.stat` writes the
owned resource bound to a loop variable. Writes are applied only after the
whole command succeeds. A `when` with no matching clause is a no-op (PF2e
`characterLoaded` guards rely on it). `delayed` is accepted structurally but
reaching it aborts the command. Assumptions not verified upstream: scoped names
reach only the target resource, unscoped names only character mechanics, and
resource writes replace base values.

Resource card actions (2026-11-18): a source `button`/stat event inside a
resource card on the character sheet runs that resource's single matching
mechanic (`toggle_equip`, `toggle_attunement`, `togglePrepareSpell`, weapon
`attack`/`damage`, `castSpell`). Inside a resource handler an unscoped event
reaches the same resource first, then the character (5e: weapon `shoot_ammo`
is weapon-local, item `remove_empty_items` is a character mechanic). Rolls
inside a sequence are collected and the sequence continues; a `map` of
`rollable` and flat modifier formulas ("-1") are accepted. `addToStat` on a
resource adds to its base value; `stat.sub` writes through a resource-valued
stat. `dismissResource` (also delayed) is UI pacing and changes nothing; the
open sheet stays open. Card buttons stay disabled, with "Azione non ancora
disponibile in PolySheet.", when the handler needs a `$view.` input absent
from its own display card, requires an unsupported popup or is otherwise
invalid. The charge and card-input increment below supersedes the earlier
Second Wind restriction. These scoping rules are inferred from the 5e source,
not verified upstream.

Unsupported: arbitrary `$view`-dependent scopes, resource mechanics outside scoped
`eventName` dispatch or resource card actions, popups fired from a resource
handler, `showResource`, `dismissResource`, executing `delayed` (except `dismissResource`), `copyResource`,
dotted/meta stat targets other than `$character.stat` and `$variable.stat`,
`on_result_effect`, asynchronous branches, nested popups/rolls in sequences. These paths fail explicitly with a diagnostic, never as silent no-ops.
Commands are serialized, bounded and never execute during rendering, reopening
or backup restore. Backup format upgraded to v4 (reads v1–v4); `Character.overrides`
is optional and validated on restore.

#### Card Amount, charges and rest subscriptions, 2026-11-18

Evidence: the unchanged official 5e 0.9.1 package, SHA-256
`5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`,
and source revision `8788e3b18099e4a1b3510f02869d97f1488586b4`,
`systems/5e/system/resources/item/{display_view,stats}.rpgs` and
`mechanics/item_{add,subtract}_quantity.rpgs` within that item directory.
The card input `item_quantity` edits `edit_quantity` (default 1).
Resource actions derive their `$view` from those declared card inputs and
persisted instance values, not character fields or arbitrary form scopes.
ADD/REMOVE therefore apply Amount, and the character's `remove_empty_items`
handler removes zero-quantity references from effective equipment. Unlinking
does not delete the resource record. Desktop/mobile production acceptance
checks the independent sequence 1 → 2 → 5 → 2 → 1 → 0, then reloads and
checks that the item stays absent.

Browser verification exposed an additional UI gap: display cards had no
base-input writer, hiding Amount, and open detail cards retained their initial
resource snapshot. Cards now use the sheet's resource save/error path and
render the latest instance after each save or action. Both `resourceSection`
and popup `resourceArray` paths have always-on regression coverage.

In `resources[id=effect]`, calculated event subscriptions distinguish own
`eventName` values (USE) from plain global names (`short_rest`). Numeric writes
to calculated resource stats persist as instance `overrides`, separate from
base values; charge tickers can explicitly edit these overrides. This supports
the charge-consumption part of Second Wind, not an inferred healing roll.
Character events broadcast to owned instances subscribed by global name.
Each failing subscriber rolls back its pending writes and reports a warning;
it does not block successful subscribers. Tests cover this dispatch/isolation
and original 5e USE consumption. Since 2026-11-20 the avatar menu runs the
official long and short rest popups (see "Rests and lasting writes" below);
manual charge buttons remain available.

Tests: `resource-events.test.ts`, `resource-card-inputs.test.tsx`, and
`e2e/sheet-interactions.spec.ts` with `e2e/resource-card-actions.ts`.
No source bytes, database schema or backup version were changed in this
follow-up; resource overrides use the existing v4 backup envelope.

Tests: `character-events.test.tsx`, `sheet-actions.test.tsx`,
`e2e/sheet-interactions.spec.ts`. The current `tests/package.test.ts` diagnostic
counts and their source-verified changes are recorded in the merge corrections
above.
[showPopUp](https://docs.rpg-companion.app/Effects/showPopUp).

Stat tap/long-press actions accept one static root handler, first-true `when`
branches and static single-target forwarding retaining payload. All branches
are preflighted, with depth eight and 2,000 effect-node bounds. Cycles, multiple
targets, ambiguous/dynamic subscriptions, callbacks, sequences and override
effects remain unsupported. Long press fires after 600 ms, cancels on movement
or cancellation and suppresses the trailing pointer click. A separate native
button provides the same action for keyboard users. Resource/combat/draft events
are never implicitly forwarded to the character.

Editable popups accept only one enum `select`, explicit Save and
`should_persist_on_save`. Its `meta_stat` must resolve to a direct string base
field. Save revalidates the event, target and option against the latest owner;
Cancel writes nothing and unrelated edits survive. This is a direct user edit,
not persistent `setStat` support. A configured level-one Fighter with Dexterity
16 rolls Acrobatics as `1d20 + 3`; selecting Proficient displays +5.
The Archer regression supplies explicit source resource graphs because that
older serialization omits resource-type declarations. It does not establish
guided catalog setup or typed inventory discovery for Archer.

Eligible numeric `stat.edit_bottom_sheet_title` opens a centered delta editor,
after tap-event/detail-view precedence. Tickers require unit step and no
allowed-values list. Bounds are checked against the latest value, without
coercion; Cancel writes nothing. Original CP uses label `CP` and title `Copper`.
Formula colors in text, icons, chips and list items now share the evaluator and
palette/hex guard used by stat colors. Arbitrary CSS stays invalid.

Setup discovers explicitly typed item/weapon/armor arrays and reuses their
source edit views. Instances and links stay local until the final character
Save commits them atomically. Existing sheets retain source resource controls.
No initial equipment, compendium or equip bonus is inferred. Nested
`create_if_empty` cost/weight editors remain visibly unsupported and retain
nullable source defaults. Schema, backup versions and original bytes are unchanged.
Tests: `tests/sheet-actions.test.tsx` and desktop/mobile guided-setup acceptance.

## Support at a glance

| Area | Status | Boundary |
| --- | --- | --- |
| Monolithic JSON / gzip-JSON system `.rpg` | Supported format, partial runtime | Exact originals retained; unknown binary variants and indexes rejected |
| Sentieri example | Supported example | Original, deliberately small MIT content; not a full game-system benchmark |
| Official 5e, 5e2024 and PF2e systems | Partial | Observed packages can install under the stated compatibility policy; full gameplay is not verified |
| Formulas and sheet components | Partial | Only registered, documented handlers/fields/scopes; see the [matrix](#compatibility-matrix) |
| Source forms and selectors | Partial | Real scoped Save/Cancel, enumeration options and local-resource selection; see [views](VIEWS.md) |
| Manual character/resource editing | Supported subset | Typed base values and exact-import references, not official creation-rule validation |
| Class/race/background/ancestry/heritage JSON catalogs | Partial | Compact immutable templates, locally composed or explicitly reused system, private manual assignment; incompatible entries stay nonassignable |
| Resource links | Supported discovery, partial catalog semantics | Direct JSON, GitHub root/file/folder, web `index.json`; same strict root types and caps, no HTML crawl or CORS proxy |
| Remove an installed system | Supported subset | Exact-version confirmation; removes related resources/rolls, blocks character/encounter pins and stale concurrent creation |
| Combat | Partial | Explicit bounded initialization, initiative and turns, not general events; see [combat](COMBAT.md) |
| General events, lifecycle effects, equipment and progression | Unsupported | No inferred bonuses, effect stacking/reversal or automatic leveling |
| Split authoring trees and RPGScript | Verified 5e/5e2024 source subset | Local data-AST compilation from one pinned tree; unknown syntax blocks preparation; PF2e source error described below |
| Book/class/race resource archives | Unsupported | A system import does not install a compendium |

The default repository workflow composes JSON and RPGScript locally, then
loads catalog JSON from the same pinned GitHub commit. No compiled upload or
CORS-blocked CDN is required. Explicit local-system reuse remains optional.
See [the import flow](GITHUB_IMPORT.md#source-repositories-and-automatic-catalogs).

### Browser source compiler, 2026-11-17

User-approved scope: JSON and RPGScript directly from the repository, without a
backend, bundled game content, external executable or CORS proxy. The compiler
lowers declarations, typed constructors, formulas, conditionals, named macros,
relative/transitive macro imports, interpolation and lambda scopes into data
trees. It never executes RPGScript. Own macro definitions override imports.
Lexical file order, directory indexes and resource/stat ID merges follow the
documented split-source format; an RPGScript index overrides a JSON index.
Only macro declarations are imported from dependency files.

Evidence: revision `8788e3b18099e4a1b3510f02869d97f1488586b4`,
`systems/{5e,5e2024}/system/` and `systems/_stdlib/`, checked against the
unchanged official 0.9.1 packages. Independent comparisons cover every
character/resource stat formula and default, sheet/search/creation views,
mechanics, combat definitions, and resource display/edit/list views.
For example, `resources[id=spell].stats[id=resolved_spellcasting_class_source_id]`
requires flattened unparenthesized `else if` clauses, while grouped conditionals
remain nested. Missing root view IDs use the declaration name; explicit IDs win,
including `resources/encounter_template/edit_view.rpgs`.
`Combatant.is_defeated` is a formula in the inspected publisher output even
though the older extension schema omits it.

Small original probes independently compiled with the official extension's
executable verify constructor tags, default root IDs, arithmetic/grouping,
conditionals, lambda keys, literal event payloads and index precedence.
The distributed compiler is original TypeScript; only stripped field/type
metadata comes from extension 1.3.0 under its explicit MIT license, retained in
`docs/licenses/rpgscript-extension-MIT.txt`.

PF2e at that revision has an unmatched closing parenthesis at
`systems/pf2e/system/resources/weapon/stats.rpgs:928:3`, in `damage_bonus`.
The inspected official executable exits successfully on an isolated unmodified
copy but drops the trailing attachment, specialization and character damage
terms. PolySheet instead blocks this source import with the exact location.
It does not repair the game rule or reproduce the silent truncation. Existing
valid compiled PF2e imports remain supported under their previous partial policy.

Generated exports embed every fetched original in `polysheet_source`, not a
claim that the generated document was uploaded verbatim. Exact JSON/BOM/line
endings survive export and v4 backup integrity validation. The 1,000-file/8 MiB
source cap and existing generated-system caps still apply. Compilation parity
for the inspected trees is not complete gameplay compatibility: normal rule
diagnostics remain visible. Tests: `rpgscript.test.ts`,
`source-repository.test.ts`, `system-import.test.tsx` and browser source imports.

For omitted `sortBy.order`, PolySheet deliberately uses ascending order with a
visible warning. The user approved this policy; upstream default behavior remains
unverified. An explicitly invalid order is still an error. See the
[dated policy and original packages](#official-compiler-follow-up-2026-11-16).

## Find the evidence

- [Format boundaries](#format-boundaries): source, package and internal formats.
- [Feature matrix](#compatibility-matrix): contracts, real pointers and tests.
- [Source inspection](#inspected-sources): pinned repositories, hashes and tooling.
- [Reported HP failure](#reported-empty-class-hp-failure): manual prerequisites,
  strict errors and recovery without invented rules.
- [Extension gates](#verification-and-extension-gates): evidence needed before
  expanding the claim.
- [Verification](VERIFICATION.md): dated runs, skips and remaining gaps.
- [Notices](../NOTICE.md): licenses and redistribution restrictions.

The remaining sections retain the technical source audit and implementation
history. Their dates and pinned revisions matter; older limitations can be
superseded by a later documented increment, not by successful decoding alone.

## Source catalog increment, 2026-11-16

The inspected clean source checkout is
[8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4).
Strict mapping uses the original nested `{resource_id, stats: {field: {value}}}`
envelope, declared base types and same-import references. Source IDs remain
separate from private local IDs. No defaults, casts or rule effects repair source
data. Exact originals are retained even when a template is nonassignable.

| System | Templates retained | Assignable | Nonassignable |
| --- | ---: | ---: | ---: |
| 5e 0.9.1 | 208 (16 classes, 101 races, 91 backgrounds) | 208 | 0 |
| 5e2024 / 5.5e 0.9.1 | 74 (12 classes, 46 race/species files, 16 backgrounds) | 55 | 19 |
| PF2e 0.3.0 | 141 (9 classes, 8 ancestries, 50 heritages, 74 backgrounds) | 141 | 0 |

5e Druid and 5e2024 Druid are now assignable as complete snapshots with
validated removal history, as detailed below. The 2024 Fighter, Ranger and Rogue include
fractional item weights where the compiled definition declares an integer.
The 2024 Guard, Guide and Soldier backgrounds have the same mismatch at
`stats.selectable_equipments.value[0].stats.options.value[0].stats.item.value.stats.weight.value.stats.value`.
Thirteen 2024 species files declare `system: "5e"` rather than `5e2024`.
These originals remain visible and exportable, but are not silently coerced,
partially stripped or offered as assignable.

All templates are compact originals, not eagerly expanded instance graphs.
Even without backgrounds, the complete 5e class/race graphs contain 18,174 resource nodes, beyond the existing
10,000-instance cap. Selecting a compatible template creates only that
character's private graph; supported formulas can read it, but privileges,
bonuses and progression are not automatically executed. Catalog roots cannot be
used directly as mutable typed references or combat sources.

The batch has a separate 1,000-file/24 MiB budget; each file still obeys 8 MiB
and parser limits. Global instance and 32 MiB backup caps are unchanged.
Installation refuses a bundle that would make the bounded backup unreadable.
See [catalog use](VIEWS.md#catalogs-and-character-assignment) and
[executed verification](VERIFICATION.md) for the actual covered paths.

The resource screen accepts the same originals via direct JSON, GitHub
file/folder/root links or a web folder with an explicit `index.json`. This adds
retrieval, not new root types or RPG semantics. Web index paths cannot escape
their directory, select another host or recurse. See [link contracts](VIEWS.md#resource-links).

### Background and subrace selection

At the same pinned revision, all three compiled systems declare the character
base field `background` as a `background` resource reference. Its JSON catalogs
use the same complete nested envelope as classes and races. Assignment copies
the graph privately; it grants no equipment, bonuses or effects.

For 5e and 5e2024, `character_stats/subrace_id` is a nullable base string,
not a resource reference. The `race` resource's base `subraces` array contains
`race` children. The source
[creation selector](https://github.com/blastervla/rpg-companion-app-systems/blob/8788e3b18099e4a1b3510f02869d97f1488586b4/systems/5e/system/character_creation_flow/01_item_1.rpgs)
uses those children as options; `resources/race/stats.rpgs` finds the selected
child by comparing its `.id` with `$character.subrace_id`.

The manual catalog panel therefore stores the retained upstream child ID,
never the private UUID. It recognizes this control only when those declared
base types match and no custom `id` stat overrides instance identity. No
separate subrace catalog or PF2e equivalent is inferred. Saving rechecks the
latest assigned race transactionally. Catalog-panel race replacement/clearing
clears its dependent selection atomically, retaining the old resource graph.
An unmatched ID from existing/manual data remains visible, not silently repaired;
generic manual fields and source forms retain their separate save behavior.
Original MIT fixtures, real 5e children and backup round trips test this mapping.

### Druid removal history

The reported 5e failure is in
`systems/5e/resource_instances/class_druid_druid.rpg.json`,
`$.stats.archetypes.value[1].stats.features.remove_ids`, at the pinned revision.
It contains `["circle_spells"]`; the accompanying current `value` has six full
children and none has that ID. The 2024 Druid has the corresponding wrapper at
`$.stats.archetypes.value[0].stats.features.remove_ids`: `["natural_recovery"]`,
with five current children and no matching ID.

The repository's
[resource-instance editing notes](https://github.com/blastervla/rpg-companion-app-systems/blob/8788e3b18099e4a1b3510f02869d97f1488586b4/.claude/skills/rpg-resource-instance-editor/SKILL.md)
describe these IDs as deletion history for the original client's incremental
merge. PolySheet does not merge remote changes into existing instances: every
assignment materializes a new private snapshot. The retained current children
are therefore the independently expected six/five above, without the retired
entry. No existing graph, even one sharing an upstream ID, is deleted.

Only declared resource-array base fields accept optional `remove_ids`.
It must be a unique list of at most 10,000 nonempty string IDs, each at most
500 characters, accompanying a complete array `value`. IDs also present among
current children are rejected: upstream conflict precedence was not established.
Other wrapper properties, reference-only payloads, wrong types and partial
patches still fail. Exact originals, hashes, limits and backup format stay intact.
The public Resource page describes definitions, not these merge semantics;
the attempted `/System/ResourceInstance` page returned 404.

Old persisted blockers are derived diagnostics, not immutable source content.
Startup revalidates blocked originals offline and updates only a still-current
record's cached issue. Reimport also refreshes that cache without replacing IDs;
assignment reparses the actual source instead of trusting an obsolete blocker.
Tests cover existing blocked imports, parallel refreshes/edits, private graphs,
invalid metadata, the 10,000/10,001 gate and exact backup restoration. This adds
no class privileges, bonuses, HP, progression or event execution; its historical
479 system warnings were separate and visible. The later scoped increment's
count at that checkpoint was 339, without implying full compatibility.

## Inspected sources

Documentation was read on 2026-11-13, starting from:

- [Introduction](https://docs.rpg-companion.app/)
- [System creation and composition rules](https://docs.rpg-companion.app/GettingStarted/SystemCreation)
- [Using the dev tool](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/UsingTheDevTool)
- [RPGScript](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/RPGScript)
- The individual type/formula/view pages linked in the matrix below.
- [Hosting systems](https://docs.rpg-companion.app/GettingStarted/HostingASystem)
  and [hosting resources](https://docs.rpg-companion.app/GettingStarted/HostingAResourceRepo).

The documentation site is live and does not expose a pinned release identifier
on these pages. Tests pin example content independently; do not assume future
documentation changes apply retroactively.

The actual repository, not just its README, was inspected at
[8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4):

```text
systems/5e/
systems/5e2024/
systems/pf2e/
systems/_stdlib/              # Shared RPGScript macros, not a game system
scripts/build_starter_bundle.py
scripts/check_compiler_parity.py
scripts/format_resource_instances.py
scripts/publish_release.py
scripts/validate_resource_instances.py
```

There is no root npm project or browser runtime in that repository. The root
`AGENTS.md`, `README.md`, and `LICENSE.md` were read. PF2e source-vs-output
resource-review delegation instructions are scoped to that work; no PF2e
resource import QA or resource content changes are performed here.

### Current source structure and tool reuse assessment

The three actual systems use `system/system.rpg.json` as root metadata and
split folders. For 5e, actual paths include:

```text
systems/5e/system/system.rpg.json
systems/5e/system/character_stats.rpgs
systems/5e/system/character_sheet_sections/06_abilities.rpgs
systems/5e/system/character_sheet_sections/02_notes.rpgs
systems/5e/system/character_creation_flow/01_item_1.rpgs
systems/5e/system/macros/system_common.rpgs
systems/5e/system/resources/note/index.rpg.json
systems/5e/system/resources/note/stats.rpgs
systems/5e/resource_instances/
```

The docs distinguish root resource **instances** from resource **definitions**
under `system/resources/`. Split composition is recursive, lexicographically
ordered, with documented deep merge, array concatenation, and selected ID merge.
PolySheet does **not** reconstruct this pipeline from filename guesses.

| Tool | Actual dependencies and behavior | Reuse decision |
| --- | --- | --- |
| `build_starter_bundle.py` | Python standard library, subprocess/filesystem, `dart`, external `~/Repositories/RPGCompanionApp/dev_tool/tool/refresh_system_builder.dart` | Not a compiler implementation; unavailable external dependency; build-time only |
| `publish_release.py` | Python, filesystem/subprocess, external Dart builder, AWS CLI for publishing | Not a client runtime; never executed; no publishing requested |
| `check_compiler_parity.py` | Python, Git worktrees/filesystem/subprocess, external platform-specific `refresh_system_builder` binary | Cannot replace missing compiler; build-time parity tooling only |
| `format_resource_instances.py` | Python `gzip/json/pathlib` and filesystem; formats existing instance files | Not a system parser or compiler; not copied |
| `validate_resource_instances.py` | Python standard library; regex extraction of base stat declarations and instance checks | Not a complete RPGScript parser or browser runtime; not copied |

The full compiler and its schema are not included in the inspected checkout.
The docs describe extension/desktop dev tools, but no verified browser compiler
or standalone decoder implementation was established. README calls tools MIT,
while `LICENSE.md` does not supply that grant. Because both dependencies and
licensing need further verification, **no external tool code is reused**.

### Official compiler follow-up, 2026-11-16

With the user's permission, the Windows desktop Dev Tool was installed under
gitignored `.reference/official-dev-tool/installed`. The official RPGScript
extension package 1.3.0 also contains a Windows x64
`refresh_system_builder.exe`, despite its Marketplace README listing only
bundled macOS support. Its separate `LICENSE.txt` supplies an MIT grant for
the extension package. This does not resolve the conflicting creative-content
licenses above or grant a browser runtime implementation.

The packaged compiler cannot produce a verified complete build of the pinned
`8788e3b18099e4a1b3510f02869d97f1488586b4` source. It rejects
`systems/5e/system/combat_system/combatant_types/monster_instance/index.rpgs:8:30`
with `unknown argument "is_defeated"`. Neither downloaded tool's schema declares
that field. `scripts/publish_release.py` in the source checkout explicitly says
the authoritative compiler is inside the original app's `dev_tool` directory;
the standalone compiler is stale and lacks `is_defeated`.

The compiler can emit partial files after parse errors. Those files are not
evidence of a valid build and must not be imported as complete systems. No
source fields were removed, no schema checks were disabled, and no tool code
or game content was added to the distributed application.

The same publication script names the official content CDN. Its live
[system manifest](https://d2dmd8x0lyn9l8.cloudfront.net/systems.json) advertised
5e 0.9.1, 5e2024 0.9.1 and PF2e 0.3.0 on 2026-11-16. The user authorized
investigating these releases instead of substituting them silently for repository
sources. Exact system packages and JSON resource indexes were downloaded into
gitignored `.reference/official-releases-2026-11-16/`.

### Beginner ability generation and explicit presentation events

#### Source-derived guided advancement and remaining effect-engine investigation

`src/engine/progression.ts` and `src/persistence/progression.ts` now implement a
separate, explicitly manual level/HP assistant. They recognize the class and
health branches in the pinned 5e confirm program, evaluate its increment and
roll/average/max HP formulas against fresh staged owner/resource snapshots, and
derive the target ceiling from imported progression tables. No independent
level, prerequisite, subclass-threshold or hit-die tables are supplied.
The selected class advances to a requested total level; a new multiclass gets
a private graph, source duplicate-class rejection and explicit manual
prerequisite acknowledgement. Subclass options/thresholds come from the class.
Current HP stays unchanged. Subclass selection is applied at its threshold.

PF2e (2026-11-19): the pinned PF2e confirm program is recognized by its
single `forEach` over `level_up_selected_class_progression` that adds the
evaluated increment to `$class_progression.class_level`. The assistant applies
that increment per level and records `temp_last_level_up_class_id`; HP is not
rolled or written, because PF2e `max_hp` is calculated from levels. PF2e
classes declare no subclass list or threshold, so none is offered, and the
dialog shows no multiclass or HP-method controls. The grant and proficiency
popups that follow the increment are not executed; their choices stay on the
sheet, where the source reports pending slots. All 9 pinned PF2e classes reach
level 20 in a local check (Fighter maximum HP 181, Wizard 101).

PF2e level choices (2026-11-19): after advancing, the dialog lists the grants
of the current level that the source's `has_pending_interactive_slots` filter
reports as open (feat slots, ability boosts, skill increases) and renders each
with its own `progression_grant` edit view; each control writes that grant's
base value. «Applica le scelte» runs the creation page `post_edit` that
commits `all_interactive_progression_grants_for_current_level` (PF2e page 1:
ability scores, `committed_*` values, feat slots) on draft copies of the owned
grants under their own ids, then saves the changed values atomically; any
skipped effect aborts the command. The program compares assigned with committed
choices, so applying twice changes nothing more. Inferred, not verified
upstream: that this creation-page commit is also the edit path after creation.
Feats are now catalog roots (`feat` added to `CATALOG_ROOTS`; repository and
link imports accept `feat_*.rpg.json`, up to 2,000 files): of the pinned
catalogs, 1,034 of 1,089 PF2e feats and all 148 5e feats prepare; 55 PF2e feats
stay visible as non-assignable with the format diagnostic. The PF2e game row
opens the repository step for the publisher's compiled file, so classes,
ancestries, heritages, backgrounds and feats come from the pinned commit.
5e ability score improvements are offered after the advance, one form per
class level the source's `should_show_asi` reports in the advanced range
(evaluated with the wrapper staged at each level, as its level-up popup is;
Fighter 1 → 20: 4, 6, 8, 12, 14, 16, 19). Each form applies +1 to two
`ability` options (the same one twice for +2) to the `<id>_score` base values,
or appends a chosen feat catalog to `feats`, mirroring `level_up_asi`. That
source event adds without a score cap or feat prerequisite check, so neither is
enforced here. 5e selectable features are now offered before confirmation by
the bounded [selectable-feature command](#selectable-5e-advancement-features-2026-11-19),
without executing their original calculated-select Save callback.

The dialog now allows an explicit source-defined Roll/Average/Max choice and
saves that method with the advancement. Before confirmation it previews new
class features (Fighter level 2: Action Surge); afterward it compares readable
sheet stats (CON 14, Average: maximum HP 12 → 20), lists features/remaining
choices and explicitly states that current HP, hit dice and slots are not
restored. Unevaluable stats are omitted, not filled with invented values.

The missing parent scope reported at the earlier checkpoint is fixed for
resource-stat traversal and its resource views; see
[resource parent ownership](#resource-parent-ownership-2026-11-18).
The advancement summary no longer injects a global `$parent` workaround.

This assistant intentionally commits permanent manual base edits, not
`addToStat` modifier overrides. It does not execute `on_level_up_confirm`,
its popup callbacks, automatic proficiency/ASI/feat/spell/infusion effects or
mechanic reversal. The UI requires acknowledgement of this boundary and
retains a separate-choices checklist. Full automatic progression diagnostics
remain accurate and are not suppressed. A successful command is not evidence
of original-app override parity. Existing backup v3/readers 1/2 and Dexie v3
remain unchanged because no new persisted fields are introduced.

Writes recheck revision and class level, validate the latest graph and
subclass, reject directly shared wrappers and roll back clones/HP on failure.
Tests use the unchanged official 5e release and private Fighter/Wizard graphs:
Fighter CON 14 progresses 12 → 20 → 28 maximum HP with average gains; adding
Wizard gives 34, while current HP remains 12. Maximum and deterministic roll
branches, repeated/stale commands and duplicate/unacknowledged multiclass are
also exercised. This is source-formula verification, not complete game parity.

User decision: when an imported system omits multiclass prerequisites, allow
multiclassing only after an explicit manual-verification acknowledgement.
Do not supply independent D&D prerequisite tables or imply automatic checks.

There is a remaining source-contract blocker for persistent progression:
the inspected 5e confirm program uses `addToStat` with
`aggregation_type: "set"` for both `$class_details.class_level` and `base_hp`.
`addToStat` documents modifier overrides; the tool schema only lists
`max`, `min`, `none`, `set`, `sum`. Neither establishes how `set` combines
repeated executions or interacts with prior value/modifier overrides.
Replacing a +1 modifier on every level-up would leave a base-level-one
class stuck at level two; accumulating it or modifying base values without
evidence would also invent the missing semantics. The public sitemap has no
AggregationType/override contract, and the attempted dedicated pages returned
404. This is not resolved by the manual multiclass acknowledgement.

Before enabling durable source effects, obtain original-app evidence for
two successive level-ups of the same class (before/after records, resulting
class level and HP), or the authoritative aggregation implementation.
ADB access subsequently allowed read-only observation of an Artificer 2 at
14/14 HP, but no private export was recovered. Public `BaseStat`/`ComputedStat` documentation confirms
separate value/modifier overrides but does not resolve the `set` aggregation
case. Public search and the available official tool schema supplied no
authoritative repeated-execution contract.
No guessed effect state, schema migration or partial source-confirm execution
has been enabled. The separate guided manual assistant described above does
not resolve the override-engine question.

The later user direction is to reuse imported creation/progression definitions,
not add independent D&D multiclass or advancement tables. No replacement RPG
tables were added. The pinned 5e
`system/system.rpg.json` defines
`progression_systems.experience_levelling_system.level_up_view` and
`on_level_up_confirm`. Its view has an existing/new-class choice and a validation
message rejecting a class already present. This does not establish an
ability-score prerequisite check: none was found in that view.

The confirm effect is a sequential program using `setStat`, `addToStat`,
`when`, `forEach`, nested class-resource destinations, dice and interactive
`showPopUp`/`showResource` continuations. In particular, selecting the same
class updates its `class_level`; multiclassing appends a wrapper to `classes`.
HP uses source `hit_point_mode` and `hit_die_average`/`hit_die_max`/`roll`.
The source has proficiency/ASI popup callbacks, so silently dropping these
effects would not execute the original progression correctly.

Contracts read on 2026-11-16:
[CharacterCreationPage](https://docs.rpg-companion.app/System/CharacterCreationPage),
[ProgressionSystem](https://docs.rpg-companion.app/System/ProgressionSystem),
[ExperienceLevellingSystem](https://docs.rpg-companion.app/System/ExperienceLevellingSystem),
[setStat](https://docs.rpg-companion.app/Effects/setStat),
[addToStat](https://docs.rpg-companion.app/Effects/addToStat),
[sequence](https://docs.rpg-companion.app/Effects/sequence).
Creation saves only after the complete page flow; `pre_edit` runs once,
open/close hooks run on each visit, and `post_edit` runs on final Save.
Stat effects distinguish value overrides from modifier overrides; they cannot
be represented faithfully by overwriting base values. The current transient
presentation-event controller does not implement that persistent state or
reversal. Imported creation, creation at an arbitrary level and level up remain
unimplemented pending this runtime/persistence extension, not claimed complete
by the first-level health helper.

#### First-level health helper

New D&D characters with one selected class default to the explicitly labeled
first-level HP option. Disabling it restores manual fields; missing class
selection retains the existing incomplete/manual workflow rather than guessing
a die. Existing-character configuration never reinitializes HP. The atomic
creation command applies final scores and private class assignments first,
then sets current HP equal to the maximum. It never dispatches lifecycle
effects, rolls dice, changes originals or automatically applies special
race/background/feat bonuses.

Official [2014 character creation](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters)
and [2024 character creation](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character)
were read on 2026-11-16: at level one, use the highest result of the class Hit
Die plus the Constitution modifier. Source checkout
`8788e3b18099e4a1b3510f02869d97f1488586b4`, in
`systems/5e/system/character_stats.rpgs:26-52`, instead defines
`max_hp = base_hp + classes_hp_mods` and clamps the aggregate class bonus at
zero. `system/resources/class_details/stats.rpgs` defines `hit_die_max` from
`class.actual_hit_die`; `system/resources/class/stats.rpgs` supplies
`actual_hp_modifiers` (normally `["constitution"]`).
The helper requires exactly one level-one wrapper, an ordinary d6/d8/d10/d12,
that modifier list, and the normal Constitution formula. It derives
`base_hp = (die maximum + Constitution modifier) - classes_hp_mods` and verifies
the source's resulting `max_hp` equals the expected total before committing.
This preserves negative Constitution instead of silently dropping it or
changing immutable source formulas. Fighter with CON 14: base 10/current 12;
CON 8: base 9/current 9 in the observed 5e import. Thus base HP is not always
the raw die size. Unsupported/custom rules abort the complete creation and
leave manual entry available.

`tests/initial-health.test.ts` checks CON 3/8/10/14/20 against real 5e
Fighter/Wizard/Barbarian/Cleric and 2024 Wizard/Barbarian/Cleric. The known
2024 Fighter fractional-equipment-weight rejection is not relaxed to test HP.
It also checks higher-level rejection, unchanged existing characters and
rollback without orphan graphs. Desktop/mobile real-browser tests cover
positive/negative Constitution, cancellation, manual/automatic switching and
offline reload. This is initialization only, not later leveling or automatic
reconciliation when Constitution changes.

The local D&D helper is gated to `5e` and `5e2024` with all six declared integer
ability bases. It is not a general creation interpreter. Pinned source checkout
`8788e3b18099e4a1b3510f02869d97f1488586b4` declares point buy in
`systems/5e/system/character_creation_flow/01_item_1.rpgs`, bounds 8–15,
and `remaining_point_buy_points` in `system/character_stats.rpgs`: budget 27,
costs 0/1/2/3/4/5/7/9. The official
[character-creation rules](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character)
were read on 2026-11-16 and independently establish that table, the standard
array 15/14/13/12/10/8, and six 4d6 rolls keeping the highest three dice.
Dice/array helpers are explicit local conveniences, not source lifecycle
effects or inferred race/background bonuses. Assignment uses slot identities,
so duplicate totals cannot reuse one result. Apply and Save are separate.
Tests check every cost, overspend, tied minimum discard, unique assignment,
mode changes, cancellation and actual browser saves.

The unchanged official 5e package contains `roll_stat` and `show_information`.
Exact pinned source paths are
`systems/5e/system/mechanics/{roll_stat,show_information}.rpgs`, backed by
`systems/_stdlib/effects.rpgs` (`rollStatFromEvent`,
`showCharacterInformationPopUp`) and `sheet_sections.rpgs` (`rollStatRow`).
The serialized event is `{name:"rollStat",payload:{stat:"strength_modifier",
statName:"Strength"}}`: payload entries are literal JSON, not formulas.
The handler reads them through `$event`; the source decides normal/min/max
dice and the modifier. STR 16 and a deterministic d20 of 10 yield 13.
Normal, min and max event dice have independent numeric tests; an unsupported
later expression fails before any random draw.
Read contracts: [showPopUp](https://docs.rpg-companion.app/Effects/showPopUp),
[roll](https://docs.rpg-companion.app/Effects/roll),
[rollable](https://docs.rpg-companion.app/Stat/Formulas/rollable), and
[setStat](https://docs.rpg-companion.app/Effects/setStat).

Only one static unconditional character handler is accepted, producing a
read-only popup or explicit rollable list. Unknown fields, callbacks,
sequences, dynamic/ambiguous subscriptions and persistent effects fail closed.
`setStat` uses overrides upstream, so it is not misrepresented as a base-value
patch. No general stacking/reversal, lifecycle or resource/combat dispatch is
claimed. Each command reads a fresh readonly snapshot, prevents overlapping
clicks and never executes during rendering. Results are transient, not history.
Static import warnings remain conservative for the broader unsupported
event/mechanic surface. Tests: `tests/ability-setup.test.tsx`,
`tests/character-events.test.tsx`, `tests/e2e/sheet-interactions.spec.ts`.

### Scoped character and stat-detail increment

The later guided-setup increment lowers 5e/2024 diagnostics from 479 to 339
and PF2e from 687 to 506. Complete-array comparison removes 87/48 previously
uninterpreted detail/color fields and 58/138 character references respectively,
while adding five newly inspected nested monster-stat path warnings in each
system. Counts are not full compatibility claims: `$character` is supplied by
the character sheet and its resource views, not unassigned archives or every
combat context. `$character.$edit_mode` is not implemented as a resource stat.
General events remain unsupported, except the later character-only presentation
subset: INFORMATION and source stat rolls.

The official 5e `$.character_sheet_sections[4].view.content[2]` and `[5]`
declare speed and hit-dice details. Details use safe formula colors, source
titles, default read-only mode, and an atomic form only when explicitly editable.
A declared tap event takes precedence. Nested paths such as `monster.speed`
remain unsupported; calculated speed fields are never treated as writable bases.
`Manage hit dice` saves the declared `current_d10_hit_dice` base field.
Contracts: [stat view](https://docs.rpg-companion.app/Views/stat),
[resource](https://docs.rpg-companion.app/System/Resource), and
[creation page](https://docs.rpg-companion.app/System/CharacterCreationPage).

Browser regressions use the unchanged official 5e system and Fighter, Human,
Soldier catalogs from source revision
`8788e3b18099e4a1b3510f02869d97f1488586b4`, under
`systems/5e/resource_instances/`. Explicit STR 16, DEX 16, CON 14, base HP 10,
current HP 12 and a level-one class independently yield maximum HP 12, AC 13,
STR save 5 and CON save 4. No race bonus, current-HP synchronization or creation
event is simulated. Tests cover incomplete-state errors, configuration cancel,
atomic save, private feat selection and offline reopening in
`tests/e2e/sheet-interactions.spec.ts`; unit contracts are in
`tests/character-setup.test.ts` and `tests/resource-context.test.tsx`.

| Published system | System SHA-256 | Expanded bytes | Indexed resources | Errors / warnings, before → now |
| --- | --- | ---: | ---: | ---: |
| 5e 0.9.1 | `5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b` | 2,316,110 | 3,383 | 6 / 473 → 0 / 339 |
| 5e2024 0.9.1 | `ce0ff5a339a0412b5c5c971680c5d009c2a7e04bd9cb65b9cafd8670966c9ad6` | 2,281,156 | 2,243 | 6 / 473 → 0 / 339 |
| PF2e 0.3.0 | `a0f6f3d56e432e1f60625b06e374c21af8237ec01f3ef93024ed45c321b3e679` | 5,880,704 | 3,456 | 14 / 673 → 0 / 506 |

`prepareImport` decodes and structurally parses all three packages within existing
limits. Before the approved policy below, semantic diagnostics blocked
installation. Every error was a `sortBy` formula without `order`. Examples are
`$.character_stats[171].components` in both 5e systems and
`$.character_stats[413].components` in PF2e. The live
[sortBy documentation](https://docs.rpg-companion.app/Stat/Formulas/sortBy)
and downloaded tool schema require `order`; neither establishes a default.

The user explicitly approved **ascending order with a visible warning** when
`order` is omitted. This is an intentional PolySheet compatibility policy,
not a verified upstream default. The evaluator applies it without inserting
`order` into the definition or changing original text, gzip bytes, hashes or pins.
Explicit `asc`/`desc` keep their behavior. Explicit null, empty strings, booleans,
numbers, objects and arrays remain errors, without string coercion.

Each omission remains a path-specific warning. A separate notice appears in
the import preview and compatibility page even when its diagnostic falls beyond
the displayed first 12/100 entries. All other diagnostics remain. The three
packages can now be installed as partial systems, not as complete game engines.
Regressions pin the package digests above and verify idempotent installation,
exact bytes and backup restoration. The unchanged 5e expression at
`$.character_stats[236].components` (`race_traits`) sorts
`race.current_level_traits` by `$sortByValue.min_level`; levels `[4,1,1]`
produce `[1,1,4]` with the two level-one entries in original order.

The official bulk resource files are also not interchangeable with system
packages. HEAD responses reported 10,836,494 bytes for 5e and 10,382,321 for
PF2e, both exceeding the existing 8 MiB per-response limit. A resource integration
must use verified bounded retrieval rather than raise that limit.

Browser CORS, resource payload interchange and correspondence to the pinned
source commit remain unverified. No resources were installed. Full character
creation, progression and effect execution remain unsupported.

## Format boundaries

Public GitHub root/`.git` links now support bounded file discovery and explicit
selection at an immutable commit. This retrieves existing system distributions;
it does not change any format or runtime-rule support below. See the
[provider contract and limits](GITHUB_IMPORT.md). Public REST commit/tree
documentation was inspected on 2026-11-13; real-source checks use pinned derpsy
`00f55b2c3023c59f5857297dc933a7505c9b6aa4`, path `5e/system.rpg`.

| Kind | Input or internal data | Status |
| --- | --- | --- |
| A | One documented monolithic source JSON document | Partial, declared runtime subset |
| B | Split JSON/RPGScript authoring directory | Not supported; obtain composed JSON using verified official tooling |
| C | `.rpgs` authoring language, macros and imports | Not supported; no partial compiler |
| D | Compiled `.rpg` package | Only the verified gzip-JSON system envelope; unknown binary variants, indexes and resource archives rejected |
| E | PolySheet records and `polysheet-backup` v3, legacy v1/v2 restore | Supported, internal only, not interchangeable with A–D |

Python scripts inspect some `.rpg` files as gzip JSON, while the public dev-tool
page calls `.rpg` binary. This is evidence about those specific tool paths, not
a universal package specification. PolySheet does not infer a general decoder.

### User-provided Archer distribution evidence

The additional supplied clone URL is
[`https://github.com/WaMXXVII/Archer-class.git`](https://github.com/WaMXXVII/Archer-class),
pinned to
[378bdf68f055bae8777a233fc0ac6e4f9eb6145c](https://github.com/WaMXXVII/Archer-class/tree/378bdf68f055bae8777a233fc0ac6e4f9eb6145c).
Its tracked tree contains only four compiled artifacts, with no source tree,
compiler, README, or license:

| Exact path | Compressed bytes | Observed payload | Scope |
| --- | ---: | --- | --- |
| `systems.rpg` | 101 | gzip → JSON root with `systems` | Distribution index, not an RPGSystem document |
| `5e/system.rpg` | 104105 | gzip → 1723608-byte JSON system, ID `5e`, version `0.9.1` | 317 stats, 50 resource definitions, 21 mechanics, six dice; partial runtime only |
| `5e/resources.rpg` | 169 | gzip → JSON root with `resources` | Resource distribution index, not system definitions |
| `5e/resources.rpg.gzip` | 6971 | gzip → custom-framed content beginning with an internal resource path, not a JSON document | Not decoded or imported as a resource pack |

`scripts/inspect-archer.mjs` reads only the pinned `5e/system.rpg` Git blob,
checks the observed gzip envelope, bounds the decoded output to 8 MiB, and
validates the expected system identity/count. It writes local-only
`.reference/archer-system.json`. It is optional inspection tooling. The browser
now directly decodes the same verified gzip-JSON system variant through native
`DecompressionStream`. Neither path defines a general `.rpg` decoder, composes
split sources, or compiles RPGScript.

Unlike the historical `0.5.1` source, this extracted `0.9.1` document has no
errors under the implemented field checks. Its serialization explicitly uses
`null` for optional `sub_value_type`, `resource_type`, `character_display_name`,
resource view fields and optional view conditions. These remain null in the
stored source. A null optional condition means absent, not a false formula.
Declared formula constants and numeric types still undergo normal validation.
Unsupported fields and contextual formulas remain diagnosed.

`tests/archer.test.tsx` verifies counts, dice, diagnostics, immutable installation,
manual defaults, the real strength modifier, saving and database reopening.
Desktop/mobile browser tests import the entire extracted document, require its
partial-support warning, edit the source abilities section (`8 → -1`, `15 → 2`),
and reopen offline. This does not establish Archer class/resource-instance
support. No content from this repository is distributed because no license was
found. See [NOTICE.md](../NOTICE.md).

### Reported derpsy repository and direct package verification

[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e)
was inspected at
[00f55b2c3023c59f5857297dc933a7505c9b6aa4](https://github.com/derpsyhome/3rd-party-books-for-5e/tree/00f55b2c3023c59f5857297dc933a7505c9b6aa4).
The tracked tree lists the same index/system/resource-pack filenames, not a
JSON authoring tree. Its exact `5e/system.rpg` Git blob is 101867 bytes,
starts with gzip magic `1f8b0800`, and expands to 1690204 JSON bytes:
`5e` version `0.6.0`, 317 character stats and 50 resource definitions.
Its implemented-field diagnostics have no errors, but unsupported rules remain.

The browser adapter accepts gzip magic, bounds raw input and streamed expansion
independently to 8 MiB, requires valid UTF-8 and the existing monolithic schema,
then presents the same semantic diagnostics before confirmation. It does not
guess archive framing. `systems.rpg`, `resources.rpg`, resource archives,
truncated/checksum-corrupt gzip and unknown binary envelopes are rejected.
Exact uploaded bytes are hashed, stored and exported, including through backup
v3. JSON-only v1 and v2 backups and existing character pins remain compatible.

`tests/package.test.ts` checks both original pinned system blobs, source counts,
the unchanged strength formula, corruption, exact byte limits, source hashing,
binary round-trip, backup integrity and legacy restore. Browser tests upload
the actual files, edit abilities, reopen offline, download originals and restore
backups; exports must match the source bytes exactly. The direct pinned Raw URL
was additionally tested live in desktop and mobile Chromium, separately from
controlled HTTP fixtures. This establishes **system payload** import, not the
repository's book/class/race content or full rule execution.

## Why this slice

No system in the current checkout is a small self-contained JSON example.
The historical 5e and 5e2024 monolithic definitions both have 317 character stats,
46 resource definitions, 21 mechanics, and 16 sections. Neither warrants full
support in a first increment. 5e is selected as the deterministic tie-breaker,
not because of game popularity. Its six score/modifier pairs have a closed,
arithmetic dependency graph, and the abilities section directly names them.
The note resource adds a small independently testable text/conditional case.
PF2e's current RPGScript-driven creation, combat, progression, resource scopes
and macro compilation are unnecessary for that first closed graph.

The exact monolithic input comes from
[92b8128a1e6da7ed39406012e357d1e3d0e1792b](https://github.com/blastervla/rpg-companion-app-systems/tree/92b8128a1e6da7ed39406012e357d1e3d0e1792b),
`systems/5e/system.rpg.json`, version `0.5.1`. It requires **no compilation**.
Git history shows later split conversion (`f3952f908`) and later RPGScript stat
migration (`e6808322a`); those are different source variants, not interchangeable
input files.

### Full-system requirements, intentionally not claimed

The real file uses resource-valued stats, nested/nullable paths, contextual
variables, enumeration formulas, collections, roll events, creation effects,
mechanics, progression, rich views, and other unsupported formulas. Its creation
pages contain `post_edit`, `on_page_open`, and `on_page_close` hooks. Those hooks
are **not** run. Stat view `on_tap_event` requests `rollStat`; PolySheet does not
replace that mechanic with a guessed dice roll. The selected slice has no image
files or image URLs; the full definition includes a nullable `photo` stat.
Local photo editing/rendering is now supported under the limits below; remote
image fetching remains disabled.

## Contextual formulas and combat increment

The reported Archer `0.9.1` and derpsy `0.6.0` diagnostics led to an additional
verified subset. Source originals and existing character/version pins do not
change. `translatable` is recognized metadata; without a supplied translation
catalogue, the source name remains the fallback, not a fabricated translation.

| Feature | Verified behavior | Evidence |
| --- | --- | --- |
| `stat`, `defined`, `metaStat` | Dot/optional paths, nested local resources, declared presence, dynamic path; deprecated `for_resource` ignored; `ignore_cache` honored | Public formula docs, original contextual trees, `capabilities.test.ts` |
| `concat`, `date`, `created_at` | String/number concatenation and persisted timestamps; documented date shape, explicitly English/UTC | Real `created_at_display` returns `Created Jan 02, 2020` for the fixed test timestamp |
| `map`, `filter`, `defaultIfNull`, `joinToString` | Nested lexical bindings, strict boolean filtering, lazy null-only fallback, exact separator | Documentation examples and original character/combat trees |
| `max`, `min`, comparison/length/not/or, `trim`, `flatAppend` | Nonempty numeric extrema; strict scalar comparisons, pairwise `notEquals`, bounded flattening/set option | Documented examples and real `dice_roll.formula` |
| Photo and `avatar` | Local raster input/render/preview, inert remote URLs, source avatar name/photo fields | Source envelope, public avatar docs, typed browser acceptance |
| Typed base arrays/resources | Scalar list editor and explicitly internal same-version references; nested definitions evaluated | Integrity/backup tests and browser acceptance |
| `combat_system` | Source roster, difficulty, initialization, initiative, turns/passes/rounds, source resolution/XP summary | Real monster initialization produces HP 4 and XP pool 50 under deterministic dice |

The two pinned original systems pass the exact reported early-stat diagnostic
paths without suppressing warnings about unimplemented mechanics/views. Native
`dice_roll` base fields are used in tests, not a replacement constant `formula`.
Initialization overrides are stored separately and never rerun on read/restore.
See [combat usage and restrictions](COMBAT.md) for precise commands, contextual
scope, manual ties, date locale/timezone limits and unsupported lifecycle behavior.
This does not certify all dependencies of every character/resource formula.

## Additional collection formula increment

The six additional formula handlers follow the public
[`sortBy`](https://docs.rpg-companion.app/Stat/Formulas/sortBy),
[`isNull`](https://docs.rpg-companion.app/Stat/Formulas/isNull),
[`contains`](https://docs.rpg-companion.app/Stat/Formulas/contains),
[`findFirst`](https://docs.rpg-companion.app/Stat/Formulas/findFirst),
[`flatMap`](https://docs.rpg-companion.app/Stat/Formulas/flatMap) and
[`toLowerCase`](https://docs.rpg-companion.app/Stat/Formulas/toLowerCase) pages,
read on 2026-11-13. Pinned derpsy `00f55b2` / `5e/system.rpg` version `0.6.0`
provides unchanged examples at decoded JSON paths:

| Path | Contract and independently expected result |
| --- | --- |
| `character_stats[33].components`, `[171].components` | `sortBy`: stable, nonmutating ordering; explicit asc/desc, or the approved ascending-with-warning policy for omission described above; homogeneous string or finite numeric selector results; `$sortByValue` or custom lexical key. Numeric `[3,1,2,1]` sorts to `[1,1,2,3]`. Text uses ordinal comparison, not browser locale. |
| `character_stats[36].components` | `isNull`: null only; zero, false and empty string are not null. |
| `character_stats[144].components` | `contains`: case-sensitive substring or strict list membership, including internal resource-reference identity; no text/number coercion. |
| `character_stats[148].components`, `[208].components` | `findFirst`: optional strict-boolean filter, default `$findFirstValue`, first matching item. No match returns null, consistent with the original nullable equipped-armor use; the public prose does not explicitly specify the no-match result. |
| `character_stats[167].components.components[1]` | `flatMap`: mapper arrays flattened one level; custom `$class` binding; lexical outer bindings preserved; output limited to 10,000 items. Empty classes produce an empty array. |
| `character_stats[291].components`, `[313].components` | `toLowerCase`: strings only, Unicode lowercase, no coercion. |

Local resource paths expose the instance's internal `id` when no stat declares
that name. This implements the original `[148]` predicate
`$findFirstValue.id == equipped_armor_id`: selecting the second of two local
armor references returns that exact reference, not a definition ID or array index.
This does not implement upstream resource-pack imports.

`tests/collections.test.ts` covers these contracts, malformed operands, nested
bindings, failed-scope cleanup, output/operation bounds, full diagnostic arrays,
and both pinned source variants. The original manual defaults have no race:
required `race.traits`, `race.weapons` and `race.current_level_traits` paths
still fail visibly. No empty list is substituted to make these formulas pass.
These formula checks preceded the scoped-view increment below.

## Scoped view increment and source evidence

The public [RPGView contract](https://docs.rpg-companion.app/Views/RPGView)
requires actual input drafts and null validation messages before Save. That
contract now has a scoped implementation, not an empty `$view` registration.
The following decoded paths are from derpsy `00f55b2` / `5e/system.rpg` `0.6.0`;
the corresponding Archer `378bdf6` / `0.9.1` paths are tested separately.

| Original path | Implemented contract and independent expected result |
| --- | --- |
| `character_sheet_sections[0].view` | [avatarSection](https://docs.rpg-companion.app/Views/avatarSection): center content and corner stacks; unsupported menu/event behavior remains visible |
| `character_sheet_sections[1].view.header[0]` | [icon](https://docs.rpg-companion.app/Views/icon): source `ic_notes` maps to a local glyph, with size/color; not original artwork |
| `character_sheet_sections[1].view.header[3]` | [selectResources](https://docs.rpg-companion.app/Views/selectResources): create a `note` through its actual edit view, append to `notes`, atomically persist both records; empty title and text reject Save |
| `character_sheet_sections[1].view.content[0]` | [resourceSection](https://docs.rpg-companion.app/Views/resourceSection): original note list/display/edit views; unlink removes only the owner reference |
| `character_sheet_sections[2].view.header[3]` | [popUpButton](https://docs.rpg-companion.app/Views/popUpButton): stage condition booleans; Cancel/reopen retains false, Save persists true; source `should_persist_on_save=true` |
| `character_sheet_sections[2].view.content[0]` | [chip](https://docs.rpg-companion.app/Views/chip): `blinded` controls visibility, safe palette/style; `remove_condition` remains unexecuted and diagnosed |
| `character_creation_flow[0].view.subviews[10].content[0..5]`, `character_stats[201..206]` | Real input-ID `$view` values drive each unchanged point-buy formula. For every ability, 8 → 0, 13 → 5, 14 → 7, 15 → 9. Editing strength in the manual group shows cost 7 before Save at score 14. |
| `resources` entry `id=note`, `edit_view.subviews[0].validation_message` | Source null/string validation; text updates scope before blur; failed Save leaves inputs intact |
| Reported text/section fields | Numeric signs, visual line clamp, color/typed resource-ID display; section collapse icon defaults false (collapsed-only), true keeps it visible |

The manual creation-field editor retains each selected input object but uses an
explicit local wrapper, not the original creation page. It does not run the
group's `$is_new`/generation-mode visibility condition or lifecycle hooks.
Individual input conditions, source bounds and validation remain active.
It therefore establishes real scoped formulas, **not** official point-buy mode
selection, complete creation validation or budget enforcement.

Diagnostics now inspect nested popup/icon/avatar-stack/header views and all
creation-page view trees, not only the first 100 UI entries. Unknown events,
dynamic chip factories, unsupported menu/select controls, lifecycle and filter
behavior remain diagnosed. Known enum variants have behavioral checks; unknown
variants are not silently rendered as defaults.

See [the precise supported options and remaining limits](VIEWS.md).

## Container, selector and counter view increment

The same derpsy `5e` `0.6.0` document supplies these decoded paths. Semantics
come from the public per-view pages and their enumerated-type pages; any
uncertainty is resolved conservatively and stays visible.

| Original path | Implemented contract and independent expected result |
| --- | --- |
| `character_sheet_sections[9].view.content[0]` (`class_features_subsection`) | [resourceArray](https://docs.rpg-companion.app/Views/resourceArray): display the referenced class instances with their own display view and hidden content line; no create control in `display` mode |
| `character_creation_flow[0].view.subviews[3]` (classes editor) | `edit` mode lists the referenced instances, offers create/remove and keeps the source validation formula active through the real draft session |
| `character_creation_flow[0].view.subviews[2].subviews[2]` (`edit_character_basics_subrace_select`) | [select](https://docs.rpg-companion.app/Views/select): local `resource_options` with `options_display_stat` `name`; one stored id per single select |
| `character_creation_flow[0].view.subviews[4].subviews[1]` (`edit_character_basics_hit_point_mode_select`) | [select](https://docs.rpg-companion.app/Views/select): enumerated `options` (`hit_point_modes`) with inherited entries and `allowed_options`; the chosen entry id is stored |
| `character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view` (`edit_character_basics_see_race_bottom_sheet`) | [resource](https://docs.rpg-companion.app/Views/resource): render the referenced race through its declared display view; `create_if_empty` is reported, not executed |
| `character_sheet_sections[4].view.header[1]` (`status_hp`) | [ticker](https://docs.rpg-companion.app/Views/ticker): `plusMinus` buttons change the base `current_hp`, clamped at `min_value_allowed` 0; a direct edit below that minimum shows an error and saves nothing |
| `character_sheet_sections[0].view.bottom_right_stack[0]` (`lifecycle_events_button`) | [menuButton](https://docs.rpg-companion.app/Views/menuButton): icon and enumeration entries render; choosing one shows the unexecuted event instead of inventing an action |
| `resources[1].display_view.subviews[6]` (`armor_display_effects_collapsible`) | [collapsible](https://docs.rpg-companion.app/Views/collapsible): source title/subtitle, start-expanded state and nested content; visibility uses the real source formula |
| `resources[3].edit_view`, `resources[4].edit_view`, `resources[27].edit_view` | [viewPager](https://docs.rpg-companion.app/Views/viewPager): one page at a time with the source page names and constant color |
| `resources[1].display_view.subviews[7].subviews[0]` (`armor_display_attune_button`) | [button](https://docs.rpg-companion.app/Views/button): source text renders; the declared `event` is never executed and the control stays disabled with a visible note |

`ticker` visibility formulas that reference `$edit_mode` resolve to `true` only
inside a real draft session. A plain sheet keeps them hidden instead of exposing
an editor that would persist immediately. `button`/`menuButton` events, filter
maps, `create_if_empty` and the `diffText` view remain unsupported and diagnosed;
no source event is treated as a successful no-op.

## Explicit reduced external fixture

`externalSlice()` selects unchanged source objects:

- `character_stats[2]`: `name`.
- `character_stats[154..159]`: six `*_score` base stats, default `8`.
- `character_stats[160..165]`: six `*_modifier` calculated stats.
- `character_sheet_sections[5]`: `abilities`, including original header and events.
- `resources[39]`: `note`, including original stats and views.

Root ID/name are relabelled to `5e-polysheet-slice` / `5e · verified ability slice`.
Unrelated character stats, sheet sections and resource definitions are removed.
Creation flow, mechanics, progression and enumerations are explicitly emptied;
indexed stats are reduced to `name`. Unknown root metadata and the original
search view remain and may produce warnings. This is **selection**, not source
compilation, a parser fix, a converted full system, or proof of full playability.

The original full document remains `.reference/5e.json`. The reduced local file
is `.reference/5e-slice.json`; its filename/source and renamed identity make the
reduction explicit. External tests assert equality of retained source objects.
Neither file ships with the application. See [NOTICE.md](../NOTICE.md).

## Documented/existing-format discrepancies

All paths below refer to the historical `systems/5e/system.rpg.json` unless noted.

| Path / field | Evidence | Handling |
| --- | --- | --- |
| `character_stats`, `resources`, `enumerated_types` | Type pages show Maps but expressly say to author Lists | Accept arrays, not invented map normalization |
| Root `type` | Type-page JSON illustration includes `RPGSystem`; actual example omits it | Optional envelope tag; original text retained |
| `party_visible`, calculated `default_value` | Current tables mark fields required, but documented examples and historical data omit them | Not required by this source variant |
| Root `dice` | Current RPGSystem table lists it; historical file omits it entirely | Warning; manual app roller is explicitly separate |
| Root `currencies` | Present historically, not part of the inspected RPGSystem table | Preserve and diagnose; do not invent semantics |
| Archer `0.9.1` optional fields | Serialized `null` for optional field types, display-name/view fields, and conditions | Preserve null; skip absent optional view conditions; tested separately |
| `character_stats[46].components.clauses[0].condition.components.components[1]` and analogous skill fields | `{value: 0, value_type: "string"}` | Type error, no implicit conversion |
| `character_stats[201].components.clauses[0].components.components.components[0]` and analogous fields | `{value: -8, value_type: "string"}` | Type error, not interpreted |
| `resources[2].stats[4].components.components.components[0].components.components[0].components.components[1].clauses[0].components` and following clauses | `{value: 2.5, value_type: "integer"}` | Type error; never silently rounded |
| `Views/text`, `Views/composite`, `Views/checkbox` live pages | Only common fields are shown; SystemCreation snippets and real files show additional fields | Only cross-checked fields are used; unsupported options remain diagnosed |
| Mechanic `event_names` | Table says List; prose/examples use comma-separated strings; RPGScript also documents resource scoping | One static exact-name character handler (string or string array); no guessed comma splitting, dynamic/resource subscriptions or handler order |
| `divide.rounding_method = closest` | Enum lists value, no tie behavior supplied | Not supported; explicit diagnostic |
| README vs `LICENSE.md` | NC-SA vs NC and inconsistent tool-license statements | No external content/tool distribution; seek clarification before redistribution |

The complete historical file therefore fails interpreted-field validation.
The test suite asserts its errors. The reduced slice avoids the unrelated
defective objects without changing any retained formula's expected semantics.

## Compatibility matrix

“Supported” means tested for the stated subset, not all optional fields or all
upstream versions. Example pointers below are in
`systems/5e/system.rpg.json` at the pinned historical commit unless another
exact path is specified.

| Feature / documentation | Real example | Status and interpreter behavior | Associated test |
| --- | --- | --- | --- |
| [RPGSystem](https://docs.rpg-companion.app/System/RPGSystem), monolithic JSON | Root; `character_stats`, `resources` | Partial: original retained; required structural arrays, duplicate-ID/type/cycle diagnostics, unknown fields preserved | `import.test.ts`; `external.test.tsx` |
| [BaseStat](https://docs.rpg-companion.app/Stat/BaseStat) | `character_stats[2]`, `[154..159]` | Scalars, declared scalar/resource arrays, local references and photos; clone defaults and patch base fields; no general modifier engine | engine, persistence, capabilities, external |
| [ComputedStat](https://docs.rpg-companion.app/Stat/ComputedStat) | `character_stats[160..165]` | Partial: explicit snapshot, dependency memoization, missing refs/cycles, finite/type checks, 10k-step/64-depth budget | engine + external |
| [constant](https://docs.rpg-companion.app/Stat/Formulas/constant) | `character_stats[160].components.components.components[1]` | Partial: type-checked scalars and scalar lists; no coercion or arbitrary JS | engine + import + external |
| [stat](https://docs.rpg-companion.app/Stat/Formulas/stat) | `character_stats[160].components.components.components[0].components.components[0]` | Direct and safe nested/optional paths; explicit resource/lambda/combat scopes only; missing required contexts fail | engine + capabilities + external |
| [list](https://docs.rpg-companion.app/Stat/Formulas/list), [add](https://docs.rpg-companion.app/Stat/Formulas/add) | `character_stats[160].components.components`, nested `add` | Supported numeric subset; list node evaluates its child formulas; add consumes its result | engine + external |
| [subtract](https://docs.rpg-companion.app/Stat/Formulas/subtract), [multiply](https://docs.rpg-companion.app/Stat/Formulas/multiply) | `character_stats[207].components` (subtract), `character_stats[14].components.components.components[1]` (multiply) | Numeric-only ordered operands; mixed-type coercion rejected. `max/map` are supported, but empty lists and unsupported downstream resource dependencies still fail explicitly | engine + capabilities |
| [divide](https://docs.rpg-companion.app/Stat/Formulas/divide) | `character_stats[160].components` | Partial: ordered division; explicit down/up/none; reject zero, missing rounding, closest | engine, documented `[20,2,5] = 2`, external `8 → -1`, `15 → 2`, `9 → -1` |
| [when](https://docs.rpg-companion.app/Stat/Formulas/when), [isEmpty](https://docs.rpg-companion.app/Stat/Formulas/isEmpty) | `resources[39].stats[2].components` | Supported subset: first matching bool condition only; isEmpty accepts text/list | engine + external note default/title tests |
| [and](https://docs.rpg-companion.app/Stat/Formulas/and) | `resources[39].edit_view.subviews[0].validation_message.clauses[0].condition` | Boolean-list formula without short circuit; real scoped form validation | engine + view-session + browser |
| [eventName](https://docs.rpg-companion.app/Stat/Formulas/eventName) | Official 5e 0.9.1 `resources[11].stats[28..30].components.clauses[*].components.components[0]` (`effect` recharge and revert lists) | Evaluates to its literal `event_name` text, so a `when` branch can build the one event name an effect subscribes to; empty names fail explicitly. `for_resource` is accepted for the firing pipeline and unused by the text value | `engine.test.ts`, import diagnostics |
| [enumeratedName](https://docs.rpg-companion.app/Stat/Formulas/enumeratedName), [enumeratedAbbreviation](https://docs.rpg-companion.app/Stat/Formulas/enumeratedAbbreviation) | Supplied 0.6.0: `mechanics[17].effects.pop_up_view.subviews[1].subviews[1].text` (alignment name), `resources[5].stats[8].components.components.components[2]` (ability abbreviation) | Partial: resolves through the source `enumerated_types`, including inherited entries, with a lazy per-type cache; unknown type/entry or a missing abbreviation fails explicitly; no label fallback | engine + import + supplied-source diagnostics |
| [toNum](https://docs.rpg-companion.app/Stat/Formulas/toNum), [toSignedString](https://docs.rpg-companion.app/Stat/Formulas/toSignedString) | Supplied 0.6.0: `resources[5].stats[13].components` (hit die), `resources[27].stats[58].components.components.components[3]` (modifier) | `toNum` accepts only plain decimal text up to 64 characters and rejects whitespace, exponents, empty text or non-finite results; `toSignedString` prefixes non-negative numbers with `+` and keeps negatives unchanged | engine |
| [replace](https://docs.rpg-companion.app/Stat/Formulas/replace) | Supplied 0.6.0: `resources[5].stats[13].components.components` (`d` removed from a hit die) | Literal all-occurrence replacement with no regex or replacement-pattern syntax; empty occurrence rejected; 1 MiB result bound | engine |
| [CharacterSheetSection](https://docs.rpg-companion.app/System/CharacterSheetSection), [section](https://docs.rpg-companion.app/Views/section) | `character_sheet_sections[5]` | Partial: source order, header/content, collapsibility and responsive minimum width; no lifecycle actions | renderer + external + E2E |
| [stat view](https://docs.rpg-companion.app/Views/stat) | `character_sheet_sections[5].view.content[0..5]`; `should_auto_save` on `character_sheet_sections[3].view.content[0].subviews[2]` (death saves) | Partial: displayed stat and distinct edit_stat, names, signs, scalar editing; `on_tap_event`/`on_long_tap_event` run only with the character-sheet event gate and are visibly flagged elsewhere; `should_auto_save` false keeps the explicit-save note | renderer + external + offline external E2E |
| [text](https://docs.rpg-companion.app/Views/text) | `character_sheet_sections[5].view.header[1]`, `resources[39].display_view.subviews[0]` | Plain text/scalar editing, scoped validation, signs/clamp/colors and pinned local resource-ID display; no HTML/Markdown | renderer + view-session + browser |
| [list](https://docs.rpg-companion.app/Views/list), [composite](https://docs.rpg-companion.app/Views/composite), [checkbox](https://docs.rpg-companion.app/Views/checkbox) | `resources[39].display_view` (list), `character_search_item_view` (composite), `character_sheet_sections[2].view.header[3].pop_up_view.content[0]` (checkbox) | Source order/layout/padding, scalar checkbox drafts and original popup Save/Cancel; `should_auto_save` false on a checkbox adds the explicit-save note; unsupported options remain diagnosed | renderer + view-session + original browser acceptance |
| Interactive/resource views | Original notes, condition popup/chips, avatar and section icons | Registered subset above and in VIEWS.md; a chip's `on_tap_event` is a button in the sheet event scope and part of its no-handler fallback; unknown types/events still have visible fallbacks, not invented actions | renderer + view-session + original browser acceptance |
| [collapsible](https://docs.rpg-companion.app/Views/collapsible), [viewPager](https://docs.rpg-companion.app/Views/viewPager), [ticker](https://docs.rpg-companion.app/Views/ticker), [button](https://docs.rpg-companion.app/Views/button), [select](https://docs.rpg-companion.app/Views/select), [menuButton](https://docs.rpg-companion.app/Views/menuButton), [resource](https://docs.rpg-companion.app/Views/resource), [resourceArray](https://docs.rpg-companion.app/Views/resourceArray) | `character_sheet_sections[9].view.content[0]`, `resources[3].edit_view`, `character_sheet_sections[4].view.header[1]`, `resources[1].display_view.subviews[7].subviews[0]`, `character_creation_flow[0].view.subviews[4].subviews[1]`, `character_sheet_sections[0].view.bottom_right_stack[0]`, `character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view`, `character_creation_flow[0].view.subviews[3]` | Tested subset: accordion/pager state, bounded ticker edits, enumeration and local-resource options, resource display/edit/list and array create/remove. `create_if_empty` seeds one blank instance through the writer that owns the field, only in an editable view; a read-only view keeps the visible note. Button and menu events, resource-valued filters and `diffText` stay unsupported and diagnosed | `source-views.test.tsx` + `scoped-resource-popup.test.tsx` + renderer + view-session |
| [Resource](https://docs.rpg-companion.app/System/Resource) | `resources[39]` | Definitions, typed manual editing and safe display; notebook links distinct from typed references. Separate strict JSON class/race/background/ancestry/heritage templates support exact original export and private assignment, not general resource interchange or effects | persistence + capabilities + catalog + E2E |
| Scoped stat paths and search prefilters | `resources[4..40].stats[*].components` (`$parent.*`), `resources[30].display_view.subviews[19]` (`$resource.traits`), `resources[*].search_filters` | A stat path resolves its own scope through `$resource` and its owner through `$parent`, so only a character stat keeps the missing-context report; a nested resource field still checks the held definition's stats. `search_filters` are the local picker prefilters; `sort_options` order the archive and picker | `import.test.ts` + picker prefilter tests |
| [CharacterCreationPage](https://docs.rpg-companion.app/System/CharacterCreationPage) | `character_creation_flow[0..3]`; current `systems/5e/system/character_creation_flow/01_item_1.rpgs` | Partial: pages run as a guided draft with `setStat`, `addToStat`, `sequence`, `when`, `forEach` and a deferred `fireEvent`; `pre_edit` and other page hooks are skipped and reported, never simulated | import diagnostics + creation-focus tests |
| [Mechanic](https://docs.rpg-companion.app/Mechanic/), [Effect](https://docs.rpg-companion.app/Effects/Effect) | `mechanics[]`; `resources[*].mechanics`; stat and chip `on_tap_event` | Partial: named character events, resource card actions and declared `calculated_event_names` subscriptions execute with bounded budgets and owned-record writers; card actions without a revert subscription write base values. A resource handler that opens a popup, lifecycle order, stacking and asynchronous flows stay unsupported. Combat keeps only its explicit synchronous `on_create` | `character-events`, `resource-events`, `import` + renderer + combat tests |
| [RPGDice](https://docs.rpg-companion.app/System/RPGDice), [Rollable](https://docs.rpg-companion.app/System/Rollable) | Historical root has no `dice`; supplied Archer `5e/system.rpg` decoded JSON `dice[0..5]` defines d4/d6/d8/d10/d12/d20 | Partial: imported face definitions, `xdy +/- n` manual roller and history; no Rollable object/effect dispatch or 3D | engine dice tests, Archer integration + E2E; historical absence warning |
| [Split composition](https://docs.rpg-companion.app/GettingStarted/SystemCreation) | Current `systems/5e/system/` | Not supported; no folder/archive import or guessed merge. An unassembled authoring root is rejected with an explicit message, and its fields are never taken from sibling files | file format rejection + import + GitHub regressions |
| [RPGScript/dev tool](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/RPGScript) | Current `systems/5e/system/character_stats.rpgs` and `_stdlib/*.rpgs` | Not supported in browser; no partial compiler, external tool code not reused | documented input restriction |
| Distribution and `.rpg` | Supplied Archer and derpsy `5e/system.rpg` pinned blobs | Partial: native gzip-JSON **system** decoding only; exact original-file hash/export; 8 MiB raw/expanded limits. No repository crawling, resource-pack import, guessed framing or generic binary support | package regressions, both real files, offline/backup E2E and separate live Raw URL check |
| Internal local storage and backup | No upstream example: deliberately PolySheet-specific | IndexedDB schema v3, backup v3 with gzip originals/encounters, legacy v1/v2 restore, atomic validated replacement, offline shell/content | persistence/migration/package/capabilities + desktop/mobile E2E |

## Reported empty-class HP failure

The user-supplied `system.rpg` declares system `5e`, version `0.6.0`, with
exact-upload SHA-256
`629daf13b73eb11fc898077418ee2440ccdc75c12e59720c074780cb99e1ed9c`.
Its upstream revision was not independently established; version equality alone
does not identify a pinned repository blob.

Manual defaults set `classes` to `[]` (`$.character_stats[29]`) and `base_hp`
to 1 (`$.character_stats[10]`). The original `level` formula
(`$.character_stats[143]`) sums class levels, producing 0 for this state.
`classes_hp_mods` (`$.character_stats[14]`) contains an inner `max(map(classes))`
at `$.character_stats[14].components.components.components[1].components.components[1]`.
With no classes, that inner maximum receives `[]`. Its enclosing `max(0, ...)`
cannot protect it because evaluating the second operand already fails.
`max_hp` (`$.character_stats[12]`) propagates the error.

The public [max contract](https://docs.rpg-companion.app/Stat/Formulas/max)
explicitly requires a nonempty numeric list. The independently expected result
is therefore an evaluation failure, not 0 or the base HP. This was reproduced
against the exact uploaded file with original manual defaults, including repeated
reads and unchanged inputs. No source or evaluator fallback was added.

This is a limitation of opening an incomplete manual character, not a repaired
character-creation workflow. The initial diagnosis did not verify populated
classes. The follow-up below verifies one explicit manual path; selecting a
class is not a guarantee that all downstream formulas are supported.

### Manual class completion and `notNull`

The same exact-upload fixture is retained locally as
`.reference/reported-system.rpg`; no upstream revision is inferred.
Its `$.resources[4]` (`class`) source edit form contains duplicate
`class_edit_base_ac` view IDs, so the scoped form cannot safely open.
An explicit manual base-field editor must remain available without claiming to
execute that invalid source form or its validation/events.

Completing the class references also reaches
`$.resources[4].stats[5].components.clauses[0].condition.components.components[0]`
(`actual_hp_modifiers`), which uses
[`notNull`](https://docs.rpg-companion.app/Stat/Formulas/notNull).
The public contract defines this as exactly `not(isNull(value))`: only null
returns false; 0, false, empty text and an empty array return true. Missing
operands and unsupported nested formulas must still fail.

Independent expected values for a manually entered class with the source
default `hp_modifiers=["constitution"]`, no archetypes, class level 2,
character Constitution 14 and base HP 10 are: level 2, Constitution modifier 2,
class HP modifier 4 and maximum HP 14. No class content, die roll or HP
progression is inferred. This does not establish general creation compatibility.

`tests/resource-editor.test.tsx` verifies the unmodified original formulas,
manual resource controls, local error isolation and recovery. The production
Playwright case additionally verifies actual `Classes` assignment, maximum HP
14, offline reopening, backup replacement and retained original compressed
bytes on desktop/mobile. These cases skip explicitly without the local fixture.
Independent MIT regressions always run for `notNull`, child-render recovery,
cancelled drafts, failed-reference rollback and concurrent resource edits.

The formula evaluator and import validator now implement `notNull`. The
nonempty `max` contract is unchanged. View errors, including errors thrown by
deferred React children such as `ticker`, stay visible inside a local boundary
instead of taking down the app shell. Manual resource editing is explicitly
available when the original form fails; source form validation is not bypassed
silently or advertised as supported.

### Enumeration and string formula increment

The same supplied 0.6.0 fixture uses `enumeratedName` (39 nodes),
`toSignedString` (17), `replace` (3), `enumeratedAbbreviation` (2) and `toNum`
(2). Their public pages define: label lookup through `enumerated_types` that
fails for an unknown type or entry; signed decimal formatting; literal
all-occurrence replacement; and strict string-to-number conversion that fails
for non-numeric text. The interpreter now implements those rules, resolves
inherited enumeration entries through the existing bounded helper and caches
one resolved type per evaluator. Missing abbreviations, missing enumerations and
invalid `toNum` operands fail visibly instead of returning an empty label.

Independent regressions cover inherited entries, absent types/entries/
abbreviations, absent environments, plain-decimal acceptance and rejection,
sign formatting and literal replacement (including `$&` remaining literal).
The supplied-source diagnostics move from 1,683 to 1,601 warnings with 0 errors;
the remaining unsupported formula nodes are three `eventName` references that
need an event scope. `split` (4 nodes) is not implemented because the public
page documents a plain separator while the pinned source uses a regular
expression; its semantics remain unverified rather than guessed. Creation-flow
`replace`/`toNum` nodes are still not executed because that flow itself is not
supported. An unassembled split authoring root such as the current
`systems/5e/system/system.rpg.json` is now rejected by name instead of exposing
raw schema paths; it is never merged with its sibling `.rpgs` files.

### Reported AC, description and avatar menu diagnostics

The same exact-upload fixture reproduces
`armor_class: classes_ac: max richiede una lista non vuota` with `classes=[]`.
`$.character_stats[146].components` takes the maximum of class AC values;
`$.character_stats[144]` consumes it. No fallback for an empty maximum is
introduced. The description at `$.character_stats[28].components` ultimately
requires `race.name`; the default `race=null` at `[31]` cannot supply it.

With explicit local class, class-details and race records, class level 2,
Dexterity 14, default source base AC 10 and AC modifier `dexterity`, both
`classes_ac` and `race_ac` independently equal 12, so `armor_class` equals 12
without equipped armor or a shield. Manually naming the records `Manual class`
and `Manual race` yields description `Manual race Manual class 2`. Unit and
desktop/mobile production tests exercise this recovery without changing source
formulas. Browser tests retain AC and description offline and after backup
replacement, alongside the previously verified HP 14.

The original avatar menu at
`$.character_sheet_sections[0].view.bottom_right_stack[0]` already renders
`lifecycle_events_menu` in the current renderer. The original status section's
`$edit_mode` conditions also resolve without a missing-stat error. These two
reported errors were not reproduced on the current code. Selecting `Long rest`
now opens the official rest popup (2026-11-20).

The original serialized `bottom_right_button_event=null` no longer creates a
runtime unsupported-field note. Null-valued optional view fields are absent for
that runtime note only; stored source and conservative import diagnostics remain
unchanged. The later explicit presentation increment executes the non-null
`bottom_left_button_event` (`show_information`) as a read-only popup. On mobile,
the right-corner menu previously extended beyond
the viewport and could not be selected by pointer. It now aligns its right edge
with its trigger. An always-on original MIT browser regression checks bounds and
pointer selection on desktop/mobile, independently of the external fixture.

## Verification and extension gates

The real integration path is:

```text
pinned real Git blob
→ full structural/semantic diagnostics (including expected source type errors)
→ explicitly selected, unchanged source objects
→ JSON import preview and installation
→ manual character defaults
→ source abilities section
→ edit source score
→ independently expected modifier
→ IndexedDB save/reopen and backup round-trip
→ production browser offline reopen
```

No test infers success from JSON parsing alone. Each supported ability modifier
starts at `-1` for score `8`; score `15` produces `2`; score `9` produces `-1`.
Note display title starts as `Untitled note` and becomes the supplied title.
The original distributed example independently expects Slancio `3 → 8` when
Vigore changes `2 → 7`.

The Archer artifact provides an additional verified composed JSON variant,
not the missing compiler or full rule semantics. To extend beyond these paths,
obtain the required verified artifacts/tooling, resolve applicable licenses,
and establish the missing event/scope/override semantics with expected outputs.
Do not mark 5e, 5e2024, or PF2e as fully supported based on these tests.

Formula and view handlers have explicit registries. An effect registry/event
dispatcher is intentionally deferred beyond the bounded combat initializer;
adding an empty registry would not establish general ordering, reversal or
stacking semantics. No effects are silently treated as successful no-ops.

Executed checks and remaining verification gaps are in
[VERIFICATION.md](VERIFICATION.md).

#### Rests and lasting writes, 2026-11-20

Evidence: unchanged official 5e 0.9.1 package (SHA-256 above) and source
`systems/5e/system/mechanics/{on_long_rest,on_short_rest,trigger_long_rest,trigger_short_rest}.rpgs`.

- A character mechanic without `revert_event_names` or
  `calculated_revert_event_names` can never undo its writes. Its `setStat`
  with `set` on a base stat therefore replaces the base value, like a manual
  edit: the latest event wins and older value overrides on that stat are
  cleared. None of the 21 official 5e character mechanics is revertible, and
  several write the same stats (rests, death saves, skill sort). Previously the
  second writer failed with an unresolved-aggregation error, for example sorting
  skills twice or a short rest after a long rest. Revertible mechanics and
  `$character` writes from resources keep reversible overrides.
- `showPopUp` accepts `in_edit_mode` and exactly one `extra_buttons` entry.
  The button's event must have a supported handler, otherwise the whole entry
  stays unsupported. The popup inputs are passed to that event as `$view` and
  are never saved (`temp_short_rest_hit_dice_*` stay unchanged).
- `roll` with `on_result_effect` rolls immediately and exposes the sum of all
  rolled formulas as `$event.result`, as documented; the command stays atomic.
- `menuButton` entries fire the event named by the entry id.
- Numeric inputs flag out-of-range drafts while typing, so a form cannot submit
  more hit dice than `calculated_max_value_allowed` permits.
- `characterLoaded` fires once, right after a character is created, so the
  official first-load rest (`long_rest_when_new`, PF2e `daily_preparations_when_new`)
  fills hit dice and spell slots. It is not fired on opening a sheet: characters
  saved earlier still hold the source's "is new" default and would be rested.
  A handler that would roll dice is rolled back.
- A sheet evaluator is its own `$character` for the resources it reaches, so 5e
  race traits and background features (`$character.level`) are listed.

#### Guided creation `$view` and racial ability increases, 2026-11-20

Reported: 5e racial ability score increases did not apply. Reproduced in the
guided flow with the live pinned repository: Human with all scores 8 stayed at
8, and `old_creator_ability_score_increases` was empty. Cause: page `post_edit`
and `on_page_close` were evaluated without `$view`, while the official
`creator_ability_score_increases` reads the chosen race from
`$view.edit_character_basics_race_select`. These hooks now receive the confirmed
page inputs by view id; the same Human character gets 9 in every score and six
recorded increases. The manual setup still takes final scores as typed and does
not add racial increases.

#### Sheet feature choices, markdown descriptions and spells, 2026-11-20

- Feature cards: a `select` on a calculated stat inside a resource card is an
  unsaved local choice; the card's own button receives it as `$view`. Only ids
  of such selects declared in the card's display view are accepted. The card's
  `$parent` is rebuilt from the owned reference path (feature → class →
  `class_details`), and setStat may target a deeper owned path such as
  `$parent.current_class_details.selected_selectable_feature_ids`. This runs
  the official 5e feat `saveSelectableFeaturesChoice` (Bard Optional Features).
  Read-only cards tolerate the official duplicate view id `feat_display_effects`.
- The level-up summary lists a feature under open choices only while fewer
  options are chosen than the level allows.
- `text` views with `markdown = true` render paragraphs, `-`/`*` lists, pipe
  tables and bold/italic as React elements, never HTML. Diagnostics drop
  accordingly (5e and 5e2024 141 → 127, PF2e 245 → 213; no new ones).
- Spell catalogs join a game bundle only within the unchanged 2,000-file and
  24 MiB budget: 5e installs 538 spells (894 files); PF2e would need 2,024
  files, so its spells stay on the selective catalog search.
- Resource filters with resource-typed options (`options`, `options_display_stat`)
  match the shown label to the option records' ids: the 5e sheet filters spells
  by class name ("Bard") while spells store `bard`. Before, the filter found none.
