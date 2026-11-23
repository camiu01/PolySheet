# Source views and scoped editing

[← README](../README.md) · [Docs index](README.md)

This is a tested subset, not full upstream UI/event compatibility. Source
documents and version pins remain immutable. All application controls are
Italian; imported labels retain their original language.

## Selective 5e monsters

In **Risorse → Importa cataloghi → Cerca mostri 5e**, search the original
repository file names, then review and confirm one downloaded original.
The centered picker reuses 50-item local pagination, a scrollable body and
stable Cancel footer. Spaces also match underscores in file-name searches.
Search/preview/cancel write nothing. Assigning the installed template in a
companion form stages a private graph until the enclosing Save; encounter
addition creates its own separate graph. No remote portraits are requested.
See [combat use](COMBAT.md#use) and the [5e audit](DND5E_AUDIT.md) for limits.

## Guided local setup

**Avanza livello** opens a centered, local-only level/HP assistant on compatible
experience-progression sheets. Choose the existing class or a new multiclass,
the desired total level, and a source subclass when required. For a new
higher-level character, create the first-level character and then advance it.
The imported HP mode controls roll/average/max; current HP is not healed.
New-class preview creates nothing in storage. Multiclass prerequisites require
an explicit manual acknowledgement; no automatic ability checks are claimed.
For compatible 5e sources, **Capacità selezionabili** offers Fighting Style,
Artificer Infusions and analogous declared feature choices before confirmation.
Native checkbox groups show the source allowance and keep selections local.
Drafts are scoped to the class, target level and subclass, never applied to a
different advancement; reopening seeds persisted selections. Source availability and limits are rechecked
on confirmation. Other feature selections and other classes remain untouched.
The separate-choices checklist and its acknowledgement remain visible because
general proficiency, ASI/feat, spell and infusion effect callbacks do not run here.
Save applies class/HP and submitted feature selections atomically; Cancel never
rolls or writes. Invalid or stale requests leave every record unchanged.
Reopening uses persisted values, not a cached advancement.

**Nuovo personaggio** collects a name, optional compatible class/origin catalogs
and numeric base fields declared by source creation inputs, plus declared base
and current HP. Missing choices retain an explicit incomplete warning.
**Configura** also repairs an existing incomplete character. Empty choices keep
existing assignments; selecting a class appends it. Level and subrace selection
remain in **Origini e classi**. Save commits the character, values and private
graphs atomically; Cancel and failures leave storage unchanged.

For supported `5e`/`5e2024` imports declaring all six integer ability bases,
the initial-values assistant explains each ability in Italian and separates HP
from ability scores. Choose manual values, the standard array (15/14/13/12/10/8),
27-point buy (scores 8–15), or six explicit 4d6-drop-lowest rolls. Standard-array
and dice assignments use distinct result slots, even for equal totals. Rolling
occurs only on an explicit button press; the discarded die remains visible.
Agree on the method and rerolls with the Dungeon Master.

Generated scores are proposals until **Usa questi punteggi** is chosen.
Incomplete assignments and overspent point buy block Apply and character Save;
switching back to Manual preserves the last applied values. Cancel discards
everything. No race/background bonuses, HP synchronization or creation lifecycle
effects are inferred. Other systems keep their declared typed manual inputs.

For new supported D&D characters, **PF iniziali automatici · 1° livello**
defaults on. With a class selected, manual HP fields are replaced by an
explanation: Save initializes current HP to the maximum class Hit Die result
plus the final Constitution modifier, including negative modifiers. Base HP
is derived for the imported formula, so Constitution is not counted twice.
Disable the option to retain manual HP entry. Without a class, no automatic
value is guessed; existing-character configuration never resets HP. Special
bonuses, later leveling and later Constitution changes are not automated.

## Explicit character events and general effect pipeline

Stat long presses and source button `event` fields now dispatch through the
character-level mechanic dispatcher. Static single-target forwarding and
first-true `when` branches support the original skill tap and condition removal.
A single enum popup can explicitly save a direct base-string field. Reverting
an event (`revert_event_names`) removes that mechanic's reversible overrides
entirely.

Character-sheet avatar `bottom_*_button_event` and stat `on_tap_event`/
`on_long_tap_event` can execute one static root mechanic with bounded branches
to `showPopUp` or an explicit `roll` list. Official 5e INFORMATION opens its
original view; `rollStat` uses its actual source bonus and advantage/disadvantage
formula. Normal dice and bounded `min(...)`/`max(...)` pools are supported,
including signed expressions such as `1d20 + -1`. Results show dice and totals;
they do not modify the character or enter persistent roll history.

Each click reads a fresh exact-pin snapshot and is protected against overlapping
dispatch. Drafts, nested resources and combat do not forward events to the owner.
Unknown options, ambiguous/dynamic subscriptions, callbacks, sequences and
persistent override effects remain blocked. Commands are serialized, bounded and
never execute during rendering, reopening or restore. Import diagnostics remain
conservative and still report the broader mechanic/event surface.

The general effect pipeline now supports value and modifier overrides at
character scope: `sequence`, `when`, `setStat`, `addToStat`, `fireEvent`,
`forwardEvent`, `forEach`, `roll` (without `on_result_effect`), `showMessage`.
Value overrides (`setStat`) and modifier overrides (`addToStat`) are stored
separately per mechanic and combined with deterministic `sum`/`max`/`min`
aggregation; `set`/`none` clashes require an upstream user prompt and stay a
visible error. A manual base edit clears value overrides for that field;
modifiers remain additive. Terminal effects (`showPopUp`, `roll`) execute at
most one per command. Reversion removes the mechanic's override entry.

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
disponibile in PolySheet.", when the handler needs a popup form value
(`$view.`), uses calculated subscriptions or aggregation (5e `effect` use,
Second Wind), or is otherwise invalid. These scoping rules are inferred from
the 5e source, not verified upstream.

Unsupported: `$view`-dependent scopes, resource mechanics outside scoped
`eventName` dispatch or resource card actions, popups fired from a resource
handler, `showResource`, `dismissResource`, executing `delayed` (except `dismissResource`), `copyResource`,
dotted/meta stat targets other than `$character.stat` and `$variable.stat`,
`on_result_effect`, asynchronous branches, nested popups/rolls in sequences. These paths fail explicitly with a diagnostic, never as silent no-ops.

## Use

Character setup includes manual inventory creation for explicitly typed
item/weapon/armor arrays. It uses source edit views and commits new instances
only with the final character Save. Cancel discards staged objects.
Numeric `edit_bottom_sheet_title` opens a centered add/subtract editor, subject
to source precedence and numeric bounds. Formula colors share the safe palette
guard across text, icons, chips, list items and stats.

- Open a supported source popup, change its inputs, then choose **Salva** or
  **Annulla**. Save validates the entire form and patches only changed fields.
  Reopening a cancelled popup starts from persisted values.
- In a source resource section, add a local instance through `selectResources`.
  Inline creation uses the resource's original `edit_view`. Empty-note validation
  blocks creation. Resource creation and owner assignment are one transaction.
- Open **Dettagli** to see the resource's `display_view`, then **Modifica** for
  its source edit form. **Scollega** removes the reference, not the archive record.
  Reorganizable lists offer drag/drop and labelled up/down controls.
- Expand **Campi delle pagine sorgente · modifica manuale** to choose a group
  of original inputs. This is explicitly a manual projection. It does not apply
  the original group's visibility, run page lifecycle hooks, select a generation
  mode, enforce a complete character-creation workflow or trigger mechanics.
  Individual input conditions, bounds and validation remain active.
- In **Risorse**, **Apri editor manuale dei valori base** remains available even
  when a resource's source form fails. Its warning explains that switching
  discards the unsaved source draft. Manual editing validates types and exact
  system references, not source form rules, events or official creation.

## Resource links

In **Risorse**, select the installed system/version and use the always-visible
**Link JSON, cartella o repository GitHub** field. **Importa risorse da link**
prepares a preview; **Conferma importazione** installs it atomically.
Cancelling or a later failed download leaves every installed record unchanged.

Accepted links:

- Direct HTTPS `.json`: one original resource envelope or a folder index.
- Public GitHub repository/clone root: for the supported source layout, selects
  the installed system's class/race/background/ancestry/heritage files automatically.
  A catalog-only repository works without a system file.
- GitHub `tree/<ref>/<folder>`: JSON files below that directory, including
  subdirectories, without siblings or symlinks. A conventional
  `systems/<id>/resource_instances` folder selects only the five supported root
  categories; unrelated standalone compendia are not claimed as supported.
- GitHub `blob/<ref>/<file.json>`: only that file. For refs containing `/`,
  enter the full ref in **Branch, tag o commit (facoltativo)** to disambiguate it.
  All files come from one resolved immutable commit.
- An HTTPS web-folder URL, with or without a trailing slash: reads its
  `index.json`. The web server must provide browser CORS access.

A web index has this exact application-defined envelope:

```json
{"files":["class_viandante.rpg.json","nested/race_collina.rpg.json"]}
```

Paths are unique, relative to the index directory and end in `.json`. Parent
paths, outside hosts, query/fragment paths and recursive indexes are rejected.
No HTML directory listing is parsed. A generic web folder without an index cannot
be enumerated; a CORS-blocked source is not proxied.

Remote batches allow 1,000 files/24 MiB total, still at most 8 MiB per file;
a web index counts toward its batch byte budget. Declared GitHub sizes are checked
before and after download. Unknown web sizes are read sequentially against the
remaining budget. Each request retains the existing 15-second timeout.
Provenance is shown before confirmation and retained without URL queries.

This is still the strict class/race/background/ancestry/heritage catalog format, not arbitrary
JSON, ZIP/gzip archives, source compilation, automatic equipment or rule effects.

## Catalogs and character assignment

Use the [repository flow](GITHUB_IMPORT.md#source-repositories-and-automatic-catalogs)
to retrieve all recognized catalogs for a selected system. Alternatively, in
**Risorse → Importa cataloghi**, select individual `.rpg.json` files,
review the preview and confirm. Local batches accept 100 files/8 MiB total;
this is separate from the bounded repository batch.

Each template keeps its exact original and digest. **Esporta catalogo originale**
downloads those bytes as UTF-8 text, including a retained BOM. Templates with
unsupported wrappers, wrong source system IDs or invalid typed values show
**Originale conservato, non assegnabile** and cannot be selected.

On a character, use **Origini e classi**:

1. Choose a compatible race/background/ancestry/heritage, or select **Classe da aggiungere**
   and choose **Aggiungi classe**.
2. Assignment creates a private copy of the nested graph. The immutable template
   and other characters' copies do not change.
3. Edit **Livello manuale** explicitly. No leveling hooks, privileges, equipment
   bonuses or general effects execute. Existing supported formulas may now read
   the assigned base values.
4. **Rimuovi classe** unlinks its wrapper, retaining local records. Deletion of
   an unused graph removes its nested copies together; external references block
   deletion. Backups retain templates, private copies and assignments.

When the source declares the 5e race/subrace contract, **Subrace ID** lists only
children of the assigned race, using their source labels. It saves the original
child ID, not its private local UUID. No available children is shown explicitly.
Changing or clearing the race in this panel clears that dependent choice in the
same transaction. Existing unmatched IDs remain visible until explicitly changed.
This is manual selection, not execution of the official creation flow or effects.

Druid's complete source snapshot can include resource-array `remove_ids`
history. Valid history no longer blocks assignment. Existing cached blockers
refresh on app startup, including offline, without replacing the original or
any private copies. Conflicting or malformed metadata remains blocked; this
does not enable automatic class rules.

Compact templates are not ordinary mutable resources and are excluded from
generic reference/combat selectors. Other root compendia and packaged archives
remain unsupported. Read [source-specific limits](COMPATIBILITY.md#source-catalog-increment-2026-11-16)
before treating a named class as usable.

### Completing the reported 5e HP prerequisites manually

For the exact uploaded `5e` `0.6.0` fixture documented in
[compatibility](COMPATIBILITY.md#reported-empty-class-hp-failure):

1. In **Risorse**, create a local `Class` using the manual base editor.
   Set its archive name and source `Name`; enter actual class values yourself.
   No class compendium or game content is imported automatically.
2. Create a local `Class details` through the manual editor, assign its `Class`
   to that instance and enter `Class level`.
3. Reopen the character and expand **Valori base · modifica manuale**. In
   `Classes`, select the **Class details** instance, not the Class instance.
   The archive's **Collega** button only adds notebook metadata and is not
   equivalent to assigning the typed `Classes` field.
4. Enter the actual `Base HP` and `Constitution`. The original source calculation
   now has its prerequisites. The tested example uses level 2, Constitution 14
   and base HP 10, producing maximum HP 14. Those numbers are regression inputs,
   not defaults or advice about a particular class.

The empty-class error remains honest until the required records are assigned,
but it no longer blocks navigation or editing. Other unsupported source features
remain visible; this is not an official character-creation or leveling workflow.

The selected group contains the unchanged source input objects inside a local
wrapper. Its original group validation is retained. Other source properties
remain unchanged in the immutable import and export.

## `$view` and transactions

Each form owns a draft dictionary keyed by its source input IDs. Text and numeric
keystrokes update drafts immediately; booleans, tickers, selects and resource
selections do too. Source formulas see those values through `$view`. No empty
global `$view` or cached copy of committed character values stands in for
interactive state. Outside a session, optional `$view?.field?` access can return
null; required access still fails.

Validation formulas must return null for validity or a visible string otherwise.
Wrong result types, evaluator failures and invalid numeric inputs prevent Save.
Source-calculated stats with direct dependencies on the current form's input
IDs render as read-only draft results. Point-buy costs therefore update before
persistence. No independent point-buy rule or budget is invented.

Nested popups have separate scopes. Their Save stages into the enclosing form;
the outer Save commits. Closing/cancelling the outer form discards all staged
changes and newly created instances. Existing resource record editing is not
offered from inside a draft list; close the draft and edit from its saved list.

Character/resource/combat forms patch latest owners in Dexie transactions.
Array append/unlink/reorder reads latest values. New instances must match the
owner's exact system import. Invalid references, missing owners or failed
validation roll back the entire command, including newly created resources.
Same-field conflicts use transaction order. Different-field updates are retained.
No initializer, roll, event or mechanic runs during form rendering or restore.

## Verified rendering

| View/field | Implemented behavior |
| --- | --- |
| `avatarSection` | Center content and left/right stacks; event button titles stay visible with an unsupported-event label |
| `icon` | Explicit source-name mapping to local Lucide glyphs; small/medium/large sizes and safe source colors, not original upstream artwork |
| `selectResources` | Correct definition/pin, scalar or array assignment, append/replace, preserve-ID or local clone, inline creation, selected labels; non-autosave selection waits for explicit form Save |
| `stat` details/colors | Safe formula colors; centered detail forms and numeric-title editors; supported character tap/long-press commands take precedence, with markers for unsupported handlers |
| `resourceSection` | Original list/display/edit views; read-only controls, base target guards, preview expansion, responsive width/alignment, unlink and drag/keyboard reordering |
| `popUpButton` | Icon/text trigger, source title/button text, source validation and Save/Cancel; both source dialog variants stay centered on desktop/phone; root persistence requires `should_persist_on_save=true`, or an enclosing draft owner |
| `chip` | Plain or resource-backed text, compact/full size, whitelisted background/border colors; no guessed tap event |
| `text` | Plain text, numeric sign, visual line clamp, safe color, local resource IDs resolved against exact type/pin and display stat |
| `listItem` | Source title/subtitle and first/second-line extras with formula colors; dynamic `chips`/`createChip` remain unsupported |
| `collapsible` | Source title/subtitle, `start_expanded` state and nested subviews |
| `viewPager` | One page at a time with source page names and the declared palette/hex color; page state is local presentation only |
| `ticker` | Numeric base stat with `plusMinus`/`upDown` buttons, `left`/`right`/`sideToSide` placement, label and alignment, fixed or calculated bounds, `allowed_values`, `change_amount` (including 0), `always_show_sign`, `hide_value`, direct edit and headline/title/section/subhead text styles |
| `select` | Enumerated `options` with `extends_type` inheritance and `allowed_options`, local `resource_options` or resource-type instances, `multi_select`, `max_selection_amount`, dropdown/list styles, `meta_stat`, `options_display_stat` and `resource_saved_stat` |
| `menuButton` | Source icon name/size/color and enumeration entries; choosing an entry fires the event named by its id when a supported handler exists, otherwise a visible not-executed note |
| `button` | Source text and `enabled` state; declared `event`/`event_names` stay disabled with a visible note |
| `resource` | One referenced instance through its `display`, `edit` or `list` view; direct field edits outside a draft session; an empty `create_if_empty` is reported, not executed |
| `resourceArray` | Referenced instances with `display`/`edit`/`list` views, `left_view`, centered detail dialogs for either source variant, create/remove, `auto_add_first`, `hide_line` and hidden content lines |
| `section` | `always_show_collapse_icon`: false/default shows the marker only while collapsed; true retains it when expanded |
| `list`, `checkbox` | Per-edge padding; bool labels/alignment and checkbox style inside scoped forms |

Colors are documented palette names mapped to PolySheet theme tokens, or bounded
hex literals. Imported CSS, URLs and arbitrary style expressions are rejected.
Text line clamping is visual and never truncates persisted source/user values.
Resource-backed text accepts ID strings/string arrays, not an upstream resource
archive or an arbitrary global ID lookup.

Generic local resource selection searches all matching names but mounts at most
50 choices per page, retaining source order. A non-preserving clone excludes
immutable catalog identity metadata; this is not a recursive graph clone.
Source `filters` propose removable, typed search filters in the parent context,
including 5e's class-name spell preselection. Matching is strict scalar equality
or any array overlap, with all active fields combined. Null/empty preselection
does not restrict the list. Invalid/unknown filters stay visible as errors.
Reopening restores the source proposal; changing a filter alone writes nothing.
Search stays available while scrolling, and no-result searches can be cleared.
Stat details default to read-only, without draft `$view`; editable details use
the ordinary validated Save/Cancel session and never overwrite calculated stats.
Long forms scroll in a div around the disabled fieldset so footer actions remain
outside the scrollport on Chromium desktop and phone.

The character sheet explicitly supplies its owning `$character`, including
resource bodies and forms. Nested character drafts expose staged values without
mutating the committed character. Unassigned archive records have no invented
owner. This does not establish combat-wide owner wiring or support for nested
special contexts such as `$character.$edit_mode`.

## Remaining limits

- General events and page lifecycle effects remain unsupported and diagnosed,
  apart from the explicit character presentation subset above.
  Buttons and menu buttons render their source text and options, keep the declared
  event visible and never execute it. A visible condition chip is not a substitute
  for its unimplemented removal event.
- `$edit_mode` is true only inside a real draft session and false on rendered
  sheets. It does not simulate the original app's global edit toggle.
- Selection is from local records, explicitly not an external compendium.
  Resource-valued filters, unknown enum variants and unsupported optional fields
  remain diagnosed; the implemented scalar/list prefilters are not a compendium
  importer or rule-prerequisite validator.
- Nested stat write paths are not implemented by these forms. Open the actual
  referenced resource for editing; calculated target fields cannot be overwritten.
- `resource` inline creation (`create_if_empty`) is not executed and stays
  diagnosed instead of silently inventing a record.
- Popup `extra_buttons`, `in_edit_mode`, `dismissible`, checkbox-specific autosave
  and dynamic list chips are not accepted as supported.
  Stat and ticker `calculated_min/max_value_allowed` are enforced; a literal
  bound takes precedence and a non-numeric result fails visibly.
  The documented subset uses explicit root Save, or an enclosing draft session.
- Resources with or without a source edit view can use the explicit manual
  editor. Existing-record saves patch changed fields against the latest record;
  unrelated concurrent fields and untouched archive names survive. Same-field
  changes remain last-committed-write wins. Failed saves retain the draft and
  leave stored data unchanged; saving disables inputs and modal dismissal.
- Rendering failures remain confined to the failing source view, including
  exceptions thrown by deferred React child components. Changed input/context
  snapshots retry rendering without weakening formula errors or form validation.

See [source evidence](COMPATIBILITY.md) and [executed checks](VERIFICATION.md).
