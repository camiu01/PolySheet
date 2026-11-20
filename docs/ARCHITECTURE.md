# Architecture

## Game selection and local navigation

The library presents verified, commit-pinned D&D 2014/2024 source shortcuts
through the existing repository preparation/review pipeline. They bundle no
third-party rules and retain partial-compatibility warnings. The known PF2e
source error and absence of a verified Daggerheart source are disclosed rather
than offered as working imports. File/link import remains available.

Each new character requires an explicit game choice; a previously selected or
sole installed Sentieri demo is never silently chosen. Imported names remain
unchanged, with separate application-owned demo notices. Setup uses declared
numeric base fields when the source has no numeric creation form.

`src/ui/navigation.ts` mirrors screen/character transitions into same-document
browser history. Back/Forward restores the ephemeral destination and selected
import without rewriting URLs or domain records. Identical destinations and
search edits add no history entries. Reload keeps the existing roster landing
behavior; Back at the entry page can leave the app normally.
Save status is visible and announced; an operation failure is not labeled saved.

## Layers and ownership

`src/engine/progression.ts` derives guided manual class/HP increments from the
imported progression branches. `src/persistence/progression.ts` prepares new
class graphs outside its write transaction and atomically validates/commits
latest-owner class levels, subclass, base HP and submitted feature selections.
`src/engine/progression-selectable.ts` reads the owning wrapper's real feature
references, source availability/limits and parent-derived selection destination.
The assistant stages checkbox choices rather than writing calculated selects;
the transaction replaces only each chosen feature's IDs and preserves other
features/classes. It is not an override/effect interpreter.
`CharacterProgression` keeps all inputs local until confirmation,
requires acknowledgement of remaining choices and never heals current HP.

`src/engine/ability-setup.ts` implements the explicit D&D generation helper;
`src/ui/InitialValues.tsx` keeps proposals separate from the setup draft until
Apply. Point-buy costs, unique result slots and bounded cryptographic rolls
are independent of imported creation lifecycle effects. Other systems retain
typed manual fields.
`src/engine/character-events.ts` preflights bounded static character handlers,
first-true branches and single-target forwarding to popup/dice results.
Editable popups accept one direct base-string enum selection and retain the
opening source event through explicit Save.
`src/persistence/character-events.ts` revalidates its target and option against
the latest owner transaction. Supported character commands persist separate
mechanic-owned reversible value/modifier layers. Lifecycle dispatch and implicit
resource/combat/draft event forwarding remain unsupported.

`CharacterInventory` reuses source forms for explicitly typed inventory arrays.
Setup holds new instances locally until its atomic character transaction.

Guided manual setup lives in `src/ui/CharacterCreator.tsx` and derives initial
numeric fields through `src/engine/character-setup.ts`. `configureCharacter`
prepares immutable catalog snapshots before one transaction creates or patches
the owner and assigns private graphs. It does not execute creation events.
For a new D&D character with one selected class, an explicit setup option calls
`src/engine/initial-health.ts` within that same transaction, after assignments
and final scores. It initializes current HP to first-level maximum and derives
a compatible base without double-counting source class modifiers. Existing
characters, missing class selections and manual mode never trigger it.
`src/ui/SourceStat.tsx` owns safe stat colors and scoped detail dialogs.
`src/persistence/diagnostics.ts` refreshes only derived diagnostics on startup,
rechecking the original/digest and previous diagnostics before writing.
It does not migrate definitions, values or exact import pins.

Formula evaluators retain per-evaluation caches and lazily index a captured
resource snapshot on first reference resolution. There is no global cache.
The character sheet supplies an explicit owning character to resource views;
an unassigned archive does not acquire a synthetic owner. Generic local pickers
render 50 matching records per page, with search over the full candidate list.
`src/engine/resource-filters.ts` evaluates declared prefilter formulas in the
parent scope and matches typed local candidate values. Its UI wrapper exposes
removable proposals without persisting filter state or changing assignment
transactions. Nullable resource predicates are handled centrally by the formula
interpreter, without resource deep equality.
Source forms and guided setup place their disabled fieldset inside a div
scrollport, leaving footer actions outside the scrolling content.
Nested source forms merge parent input-ID drafts with local input shadowing.
Validation shares that scope, and resource views resolve declared paths with
the bounded formula evaluator before checking the selected instance's type/pin.
Import-time bindings include only real, unambiguous inputs, not display labels.

| Location | Responsibility |
| --- | --- |
| `src/domain/model.ts` | Passthrough source schemas and explicitly separate internal records |
| `src/importing/system.ts` | Bounded JSON parsing, structure, semantic diagnostics, provenance/hash |
| `src/importing/package.ts` | Bounded native gzip-JSON decoding and exact binary-source retention |
| `src/importing/url.ts` | Direct HTTPS downloads, URL/HTML/HTTP/timeout/network diagnostics |
| `src/importing/github.ts` | Public GitHub metadata discovery, explicit file choice and commit-pinned download |
| `src/importing/repository.ts`, `src/importing/catalog.ts` | Source metadata discovery and strict, bounded catalog templates; no proxy |
| `src/importing/source-repository.ts`, `src/importing/rpgscript/` | Commit-pinned JSON/RPGScript retrieval, bounded data-AST compilation and split-source composition; no imported code execution |
| `src/importing/catalog-url.ts` | Direct JSON, commit-pinned GitHub file/folder and confined web-index catalog previews |
| `src/importing/monsters.ts`, `src/ui/MonsterImport.tsx` | Metadata-only 5e monster search and one selected commit-pinned original through normal catalog review |
| `src/persistence/catalog.ts` | Atomic compact templates, private character graphs and explicit manual assignment |
| `src/engine/formulas.ts` | React-independent formula registry and bounded evaluator |
| `src/engine/character-origins.ts` | Declared race/subrace contract and upstream-identity choices |
| `src/engine/dice.ts` | Bounded manual dice expression and unbiased random faces |
| `src/persistence/db.ts` | Dexie schema, migrations, immutable imports and transactional writes |
| `src/persistence/backup.ts` | Backup v4, legacy v1/v2/v3 restore, integrity/relation checks, atomic restore |
| `src/engine/combat.ts`, `src/persistence/combat.ts` | Pure combat evaluation and atomic, source-pinned commands |
| `src/ui/CombatTracker.tsx`, `src/ui/FieldInput.tsx` | Encounter controls and typed base editors |
| `src/domain/photo.ts`, `src/domain/references.ts` | Bounded raster images and exact-version reference integrity |
| `src/ui/renderer.tsx` | View registry, safe plain-text rendering, scalar inputs and fallbacks |
| `src/engine/view-session.ts`, `src/ui/SourceForm.tsx` | Scoped input drafts, source validation, explicit Save/Cancel |
| `src/ui/SourceViews.tsx`, `src/persistence/views.ts` | Popup/local resource controls and atomic latest-owner patches |
| `src/ui/SourceLayoutViews.tsx`, `src/ui/SourceValueViews.tsx`, `src/ui/SourceResourceViews.tsx`, `src/ui/view-support.tsx` | Collapsible/pager layout, ticker/button/select/menu controls, `resource`/`resourceArray` bodies and shared safe helpers |
| `src/engine/enumerations.ts` | Bounded enumerated-type resolution with inheritance and allowlists |
| `src/ui/store.ts` | Only ephemeral navigation, selection and search, not copies of DB data |
| `src/ui/it.ts` | Initial Italian UI catalogue |
| `src/ui/Library.tsx`, `src/ui/SystemImport.tsx`, `src/ui/library.css` | File/link choices, optional GitHub references, grouped import review and explicit confirmation |
| `src/ui/Characters.tsx` | Manual character creation, source sheet, manual base editor |
| `src/ui/Tools.tsx` | Local resources, notebook links, dice, diagnostics, settings, backup |
| `vite.config.ts` | Manifest, update-prompt worker and shell precache |
| `src/importing/external-slice.ts` | Test-only explicit source projection; not imported by the application |

## Source mapping

The runtime does not invent a normalized game schema. The validated definition
retains the original names and unknown properties through passthrough schemas.
The exact imported text is retained separately as `StoredSystem.original`.
For gzip-JSON uploads, `original` holds exact decoded JSON and
`StoredSystem.artifact` holds `{format: "gzip-json", base64: "..."}` containing
the exact compressed upload, not a recompression. Export emits the retained bytes.
For repository source imports, `original` is explicitly a generated monolithic
JSON document containing `polysheet_source: {format: "rpgscript-v1", root, files}`.
Each file retains its repository-relative path and exact UTF-8 `original`,
including BOM, whitespace and line endings. This is not an original compiled
upload. Source export and existing v4 backups retain that entire generated
document and its SHA-256 identity. Files are sorted deterministically before
serialization; neither restore nor ordinary offline opening needs a network read.
The compiler is lazy-loaded and precached with the app shell. Source downloads
are explicit, four at a time, at most 1,000 files/8 MiB, including transitive
relative macro imports in the same pinned Git tree. The generated export still
must fit the existing 8 MiB, 400,000-node and depth-64 system limits.
`definition.character_stats` supplies stat definitions;
`character_sheet_sections[].view` supplies sheet nodes. Resource definitions
remain in `definition.resources`, not in the mutable local instance table.

An import key is `source-id@source-version:sha256-exact-upload`. For JSON this
hashes the exact UTF-8 text, including an optional BOM; for gzip it hashes the
compressed file. Whitespace-only
changes are distinct snapshots. Identical imports are idempotent. Version strings
are identifiers, not upgrade instructions: no automatic source replacement or
character migration occurs. `min_app_version` is an original-app constraint,
not a PolySheet minimum version.

`Character.values` contains base values only. The evaluator reads that explicit
snapshot and the immutable definition. Calculated character values are not persisted
or written back into the source. Combat instances separately persist only the
verified `on_create` overrides, never source changes. A new evaluator is created after
each persisted edit; memoization is limited to that snapshot.

`ResourceInstance` contains a local definition ID and base values. Its shape is
**not** the original app's resource export format. `Character.resourceIds` links
local notebook records without triggering effects. Typed resource base fields
use an explicitly internal `{resourceId: string}` reference, not a claimed upstream
instance format. Nested/optional paths resolve local records and declared resource
definitions under a shared evaluation budget. Lambda bindings retain outer scopes.
Local resource instances expose retained upstream `sourceId` through `.id` when
available, otherwise their local ID, unless a source stat declares that name.
Collection formulas use this identity for
resource membership and original `findFirst` predicates. Stable sorting never
mutates a persisted base array; flat mapping retains the same collection limits.
Catalog assignment also supports declared background references. Subrace choices
come only from an assigned race's typed children and persist the retained upstream
scalar identity. Dependent catalog-panel changes are atomic; stale writes fail
against the latest race. No creation events or effects run.
Complete resource-array snapshots can carry validated `remove_ids` history,
never commands to delete existing graphs. Startup refreshes obsolete catalog
blockers against unchanged originals; concurrent writes recheck the latest
record before updating only derived diagnostic metadata.
Only explicit combat commands receive combat variables and a roll capability;
rendering never rolls. `$view` exists only in an explicit form session and
contains actual input values keyed by source view IDs. General parent/event
scopes remain unsupported.

## Interface and local assets

System import has separate file and link entry points, with no duplicate header
action. GitHub references are progressively disclosed only for repository
inputs. Discovered catalog repositories still require a compatible compiled
system or an existing local version; no compilation or proxy is introduced.
Import review counts all diagnostics by topic, expands blocking errors, and
renders at most 100 details per group with an explicit truncation note.
Provenance and original-app version metadata remain in a technical disclosure.
Dialog bodies scroll independently of their action footer. Source selection
and cancellation never install records; the final existing confirmation command
still owns the write transaction.

The UI uses one charcoal/brass token system with a light variant. The default
preference is dark; existing saved preferences are not migrated. Fonts in
`public/fonts/` ship with OFL licenses and join the same-origin PWA precache.
There are no remote font requests. Desktop navigation remains persistent;
phones add a bottom shortcut bar while retaining the complete drawer.
Dialogs stay centered on both. Saving has a screen-reader status, without the
removed decorative profile, workspace switcher or top-right online/local badges.

## Mutation flow

```text
file/direct HTTPS bytes → compressed/raw byte bound
  → optional verified gzip envelope → expanded byte bound
  → strict UTF-8 → JSON depth/node bounds → source schema → diagnostics
  → review/confirm → immutable IndexedDB import
  → manual character defaults → source view registry
  → scalar input blur → validated field patch in transaction
  → Dexie live query → new evaluation snapshot → derived display
```

Each field patch rereads the latest character in a transaction, so overlapping
updates to distinct fields do not overwrite stale state. Same-field updates
use transaction order, last committed write wins. Invalid drafts remain visible
in the input, are not saved, and are not presented as successful writes.

The manual creator does not execute original creation pages. A separate manual
editor projects each selected group's unchanged input nodes into a new local
form, without applying the original group's visibility or lifecycle hooks.
Individual input visibility, bounds and validation remain enforced. Original
calculated stats whose direct `$view` dependencies exist in that form are shown
as source-derived read-only results, including the six point-buy costs.

Source resource edit views and popups use independent draft dictionaries.
Nested popup Save stages into the enclosing draft, not directly into the DB.
Cancellation discards drafts and newly staged instances. Every source validation
must return null before Save; non-null text and evaluator failures block Save.
Forms retain input on failed persistence and display the error. Their Save
button stays busy and dismissal is blocked until the transaction completes.

Character, resource and combat form patches reread latest owners inside Dexie
transactions. Resource creation and assignment commit atomically; append/unlink/
reorder callbacks operate on latest arrays. Only changed fields are patched.
Combat forms preserve linked-PC and initializer-override ownership. The manual
resource editor is also explicitly available when an original edit view cannot
run. It validates data types and references, not source form rules; switching
discards only the unsaved source draft after a visible warning. Existing manual
resource saves merge changed fields into the latest record in a transaction,
including preservation of concurrent archive-name edits when the name was untouched.
See [view contracts and limitations](VIEWS.md).

Each rendered source view has a React error boundary as well as synchronous
evaluation guards. Errors in child components remain visible in that view and
cannot replace the app shell or unrelated controls. A changed input or context
snapshot retries the view; no source values are fabricated to make it render.

## Safety limits

| Boundary | Limit |
| --- | --- |
| System text | 8 MiB UTF-8 |
| Gzip system | 8 MiB compressed and independently 8 MiB expanded |
| Backup text | 128 MiB UTF-8; 4,000,000 visited values |
| Stored resource records | 100,000 across the archive (a 5e character clones 300–2,300) |
| Parsed document | 400,000 visited values; nesting depth 64 |
| Character stats per system / stats per resource | 2,000 |
| Resource definitions per system | 1,000 |
| Sheet sections / creation pages | 200 each |
| System mechanics | 5,000 |
| Dice definitions | 100; 2–1,000,000 faces |
| Formula evaluation | 10,000 operations and depth 64 per call |
| Dependency chains | Maximum 64 before import error |
| Roll | 1–100 dice; one expression and one signed modifier |
| Global roll history | User-configurable 1–1,000 |
| Backup records | 100 systems, 10,000 characters, 100,000 resources, 1,000 rolls, 1,000 encounters |
| Encounter | 100 combatants, 100,000 rounds, 10,000 passes; initiative magnitude at most 1 billion |
| Initialization | 1,000 effects, nesting 32, 100 roll expressions; atomic or no added instance |
| Computed collections/text | 10,000 elements / 1 MiB text |
| Local photo | 1 MiB PNG/JPEG; dimensions 1–4,096 per axis; remote URLs never requested |
| URL import | HTTPS, no credentials, omitted cookies/referrer; 15 s timeout; streamed size bound |
| GitHub discovery | 8 MiB per response; 20,000 tree entries, 100 candidates; complete tree required; no clone |
| Repository catalogs | 2,000 files, 24 MiB total source bytes, four simultaneous reads; each file still at most 8 MiB |
| Resource links | Same remote batch/file caps; web index bytes included, sequential unknown-size reads and no recursive indexes |
| Local catalog batch | 100 files, 8 MiB total |
| Local folder import | 20,000 directory entries, 100 system candidates; only `.json`/`.rpg` are read, under the system and repository-catalog caps |
| Input text | Generally 10,000 characters; source `max_length` can tighten supported text inputs |

These are application safety limits, not claims about upstream format limits.
GitHub discovery resolves a commit before listing files and downloads only a
selected regular blob. It does not compile authoring trees or import resource
archives. See [GitHub import boundaries](GITHUB_IMPORT.md).
Prototype-related keys are rejected at every parsed object depth. The interpreter
does not execute source code or load remote images. Plain React text escapes
HTML. No HTML or Markdown interpretation is offered. Numeric operations require
finite numbers; division by zero fails; integer results must be safe integers.

Some source fields are only partially supported. For example `divide` requires
explicit `down`, `up`, or `none`; `closest` tie behavior is not guessed.
`add`/`subtract` reject mixed nonnumeric operands instead of guessing coercions.
The compatibility matrix states this restriction.

## Database and backup

Catalog templates use optional metadata on the existing resource records, without
a schema reset. A template stores one exact original/digest, no mutable base
graph, and any assignment-blocking diagnostic. Assignment materializes a private,
bounded graph with remapped local references and retained upstream IDs.
Templates cannot be edited or used directly as mutable references/combat sources.
Explicit instanced-combat addition may materialize a compatible monster template
into a new private graph; that graph and initialization share one transaction.
The 5e bestiary search downloads only one chosen original after metadata
discovery, rather than exceeding the existing remote-batch byte budget.
Backup validation rehashes/reparses originals, checks template identity/shape and
recomputes diagnostics. Bundle installation also checks the projected backup
inside the transaction; failure rolls back both system and templates.

System removal deletes only the selected immutable import and its resources and
rolls. Any current character or encounter pin blocks the whole operation. Removal
and character/encounter/roll creation share system-table transactions, preventing
stale forms or concurrent tabs from creating orphan records. Preferences and
other import keys are never removed. The UI requires explicit confirmation and
recommends exporting a backup first.

Dexie schema version 1 defines systems, characters, resources, rolls and
preferences. Version 2 fills missing `revision` and `resourceIds` on existing
characters. Migration does not reset values. A migration test creates a real v1
IndexedDB database and opens it with the current implementation.
Version 3 adds the independent `combats` table without changing existing records.

Backup envelope:

```json
{
  "format": "polysheet-backup",
  "version": 4,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "systems": [],
  "characters": [],
  "resources": [],
  "combats": [],
  "rolls": [],
  "preferences": []
}
```

Exports read all tables in one transaction and reject output exceeding the
restore schema/size/node limits. Systems export exact JSON text, provenance and
optional original gzip bytes, not duplicated evaluated definitions. Restore reparses every
source, recomputes hashes/diagnostics, validates IDs, values, versions, system
pins and resource links, and only then opens a single replacement transaction.
Any failure leaves the archive unchanged. The UI previews counts and requires
explicit replacement confirmation. All backup versions are internal, never
advertised as an RPG Companion character format.

Backup v2 adds optional gzip originals. Restore accepts legacy JSON-only v1
without changing its source identity; a v1 envelope with binary originals is
rejected. Gzip records are decompressed sequentially during validation to limit
peak memory. Their raw digest, decoded JSON and declared source identity must
agree before replacement. Unknown/invalid/checksum-corrupt/oversized packages
fail without changing live data. No Dexie schema bump is necessary for the
optional, non-indexed artifact field; existing v2 database records remain valid.

Backup v3 adds encounters, source/character/resource pins, initialization overrides,
initiative and turn state. Restore validates references and active-state invariants
before replacement; it never reruns initialization. Legacy v1/v2 backups restore
with an empty encounter table. Base editors use transaction-safe field patches;
the “saving” indicator remains active until the transaction commits.

Backup v4 adds optional mechanic-owned character override layers. New exports
declare v4; readers still accept v1–v3, including v3 exports carrying overrides
produced by the initial event-pipeline implementation. Restore preserves those
layers without rerunning events or merging them into character base values.

Public GitHub repository roots support commit-pinned discovery and explicit file
selection. GitHub `tree` and `blob` pages are rejected before download, rather
than mislabelled as CORS failures. Direct Raw links remain allowed. HTTP status,
HTML responses, network/CORS failures, timeouts, invalid UTF-8 and malformed
payloads have separate diagnostics. No repository is crawled or merged.

## PWA and UI

Workbox precaches the production app shell, generated JS/CSS and local icons.
Imported content resides in IndexedDB. No remote image caching is implied.
A waiting worker triggers an update notice instead of silently replacing an
active session. Service-worker update code is implemented; browser tests cover
activation and offline reopening, not a deployed two-version upgrade rollout.

Native semantic buttons, labelled inputs, `<dialog>` focus trapping, a skip
link, visible keyboard focus, reduced-motion support, and responsive navigation
avoid an additional component framework dependency. Tailwind is installed via
its Vite plugin; the original visual system uses CSS tokens and component
classes. Zustand does not duplicate the persistent domain state.
