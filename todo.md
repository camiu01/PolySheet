# PolySheet TODO

## UX/UI review follow-up, 2026-11-18

All items below remain **to do**. Implementation was deferred at the user's
request. Evidence comes from production screenshots at 1440 x 1000 and
390 x 844 and interaction checks using the UI UX Pro Max checklist.
Preserve the charcoal/brass design, Italian application copy, original source
labels, local-first data ownership and visible compatibility limits.

- [ ] **P1 — Make the resource archive searchable and bounded.**
  The reviewed archive renders 212 cards and a roughly 58,106 px mobile page.
  Add name search, definition-type and catalog/local filters, result counts,
  clear filters and 50-record pagination. Classify catalogs by `catalogSource`,
  not private-copy metadata. Reset filters on system changes, reset/clamp pages
  after filtering or deletion, and distinguish an empty archive from no matches.
  Keep complete resource snapshots available to views/editors, even when only
  one page is rendered. Preserve export, edit, attachment and deletion behavior.
  Relevant files: `src/ui/Tools.tsx`, `src/ui/LocalResourcePicker.tsx`,
  `src/ui/it.ts`. Update existing browser assertions that expect 74 mounted
  cards to check bounded rendering and the full result count instead.

- [ ] **P1 — Make the mobile navigation drawer keyboard-accessible.**
  Opening currently leaves focus on the trigger; Escape does not close the
  drawer, and background controls remain keyboard-reachable. Move focus inside,
  contain Tab/Shift+Tab, isolate the background, provide an accessible close
  control and restore focus on dismissal. Handle destination selection and
  resizing to desktop without leaving inert content or a locked scroll.
  Relevant file: `src/App.tsx`.

- [ ] **P2 — Keep guided creation actions visible.**
  The initial wizard footer was below the viewport on desktop (y=1318) and
  mobile (y=1754). Extend the existing constrained form/scrollport layout to
  `CreationFlow`, so only fields scroll and Back/Next/Cancel remain visible.
  Preserve centered dialogs, nested draft forms and busy dismissal protection.
  Relevant files: `src/ui/CreationFlow.tsx`, `src/ui/CharacterCreator.tsx`,
  `src/styles.css`. Test footer geometry before and after scrolling.

- [ ] **P2 — Prioritize playable sheet information above profile space.**
  The profile/photo panel, headings and warnings occupy almost the whole first
  desktop viewport before HP, armor class and initiative. Compact the profile
  and surrounding spacing without dropping source content, photo actions,
  source events or compatibility warnings. Do not invent calculated values or
  reorder arbitrary imported sections by guessed game-specific labels.
  Relevant files: `src/ui/Characters.tsx`, `src/ui/SheetSections.tsx`,
  `src/ui/renderer.tsx`, `src/styles.css`.

- [ ] **P2 — Group repeated incomplete-sheet errors without hiding them.**
  The intentionally incomplete Human Fighter 20, missing Background, renders
  20 errors for `background.current_level_features`. Retain the existing
  "Completa ora" recovery action and honest non-calculable field markers;
  group duplicate technical messages with affected counts and expandable
  details. Avoid repeated live-region announcements. Verify that configuring
  the missing origin refreshes both fields and grouped errors.
  Relevant files: `src/ui/Characters.tsx`, `src/ui/renderer.tsx`.
  This evidence does not establish failure of a fully configured character.

- [ ] **P2 — Reset scroll and focus on local destination changes.**
  Navigating between mobile screens retained scroll (observed y=44), leaving
  headings partly behind the top bar. Put the new destination at its readable
  beginning and move focus to its heading/main content. Cover sheet entry,
  navigation buttons, browser Back/Forward and closing the drawer. Keep
  section-anchor scrolling and deployment base paths working.
  Relevant files: `src/App.tsx`, `src/ui/navigation.ts`.

- [ ] **P2 — Associate validation with its fields and screen.**
  Rejected guided creation shows three alerts but no corresponding
  `aria-invalid`/`aria-describedby`, and focus stays on Next. Use unique
  per-rendered-instance description IDs, mark the actual editable controls
  and focus the first actionable invalid field. Include resource selectors,
  nested drafts and collapsed sections; provide a focusable summary for errors
  without a mounted control. Preserve local numeric errors and source rules.
  Show dice syntax errors beside the formula, not as a stale banner on Combat;
  retain genuine persistence failures rather than silently dismissing them.
  Relevant files: `src/ui/renderer.tsx`, `src/ui/SourceForm.tsx`,
  `src/ui/SourceStat.tsx`, `src/ui/SourceValueViews.tsx`,
  `src/ui/SourceViews.tsx`, `src/ui/SourceResourceViews.tsx`, `src/ui/Tools.tsx`.

- [ ] **Validate the completed UX fixes before marking them done.**
  Add regressions for all seven items, cancellation/no unintended writes,
  system/filter changes, repeated navigation and nested source validation.
  Inspect fresh desktop/mobile screenshots in both themes, keyboard focus,
  footer geometry and horizontal overflow. Run `npm run check`,
  `npm run build`, `npm audit --omit=dev`, then isolated production
  Playwright on port 4183 with `PLAYWRIGHT_BASE_PATH=/PolySheet/`; also test
  `/` because navigation changes are in scope. Preserve the preview on 4173
  and record actual results/skips in `docs/VERIFICATION.md`.

## What remains before this delivery

- [x] Finish and test bounded character tap/long-press handlers and editable
  proficiency popups. Keep unsupported effects and resource scopes diagnosed.
- [x] Verify titled numeric adjustments and formula colors against real 5e input.
- [x] Add manual inventory creation to character setup, with atomic Save/Cancel.
- [x] Run type/unit, production build, dependency audit and desktop/mobile
  acceptance checks; record current evidence and remaining limits.
- [x] Review all project changes for the authorized commit and push.
  Delivery revision and push outcome belong in Git history and the delivery
  report, not this pre-commit checklist. A push to main triggers the existing
  gated GitHub Pages workflow; successful deployment must be verified separately.

Updated 2026-11-16. This records remaining work, not authorization to implement
everything or a claim that any imported game is fully playable.

Current evidence: [compatibility](docs/COMPATIBILITY.md),
[source views](docs/VIEWS.md), [combat](docs/COMBAT.md) and
[executed verification](docs/VERIFICATION.md).

## Current priorities

The unchanged official 5e system now has 333 warnings (previously 338 / 339 / 479).
Repeated paths often describe one missing feature, not separate implementations.
The displayed list is truncated, so it cannot establish the complete backlog.

### P1: Rules and source interactions

- [x] Add explicitly guided manual advancement using imported level/HP formulas,
  subclass options and ceiling, with transactional multiclass/private graphs
  and a manual prerequisite acknowledgement. Other choices remain a checklist;
  this is not the general persistent-effect pipeline below.

- [x] Support nullable resource predicates used by race weapons/attunement,
  without introducing arbitrary object equality.
- [x] Apply visible, removable source prefilters to local resource selection,
  including the original Spells class-name filter. Keep unsupported types and
  invalid formulas visible; this does not install a spell compendium.

- [x] Implement the general event/effect pipeline after verifying source scopes,
  execution order, aggregation, reversal and failure behavior. Existing combat
  initialization and explicit character showPopUp/roll commands are bounded
  subsets, not this pipeline.
- [ ] Connect source-defined class/origin privileges, bonuses, proficiencies,
  equipment and HP effects through that pipeline. Do not invent rules or infer
  automatic effects from manual catalog assignment.
- [x] Implement bounded character stat tap and long-tap actions, including the reported
  `$.character_sheet_sections[2].view.content[0..14].on_tap_event`,
  corresponding actions in sections 4, 5 and 6, and
  `$.character_sheet_sections[7].view.content[0].content[*].on_tap_event` /
  `on_long_tap_event`. Verify source-defined rolls rather than substitute a
  generic dice roll. General effects and resource-scoped events remain separate work.
- [x] Execute the original INFORMATION avatar event through a read-only
  `showPopUp` command, without automatic effects or editable popup semantics.
- [ ] Extend avatar events beyond the verified read-only popup/roll subset.
  Verify each handler and the right-button contract before adding it.
- [ ] Implement official character creation and progression, with original
  choices, validations, page lifecycle effects and level-dependent changes.
  Test repeated operations, cancellation, rollback and incomplete characters.

### P2: Remaining source controls

- [ ] Implement the unsupported controls' `should_auto_save` behavior reported
  under `$.character_sheet_sections[3].view.content[0..1].subviews[1..3]`.
  Preserve validated drafts and explicit Save/Cancel where required. This is
  not a blanket missing feature: select/ticker already support their documented
  autosave subset.
- [x] Implement scoped stat-detail `bottom_sheet_view`, `bottom_sheet_in_edit_mode`
  and `sheet_title`, starting with
  `$.character_sheet_sections[4].view.content[2]` and `[5]`.
  Honor the source content while keeping dialogs centered on desktop and phone,
  as requested; do not restore bottom-anchored phone dialogs.
- [x] Implement dynamic `stat_color` and `name_color`, including section 7's
  nested stat controls, through the existing safe color handling.
- [ ] Complete the other documented view gaps: dynamic chips, selection filters,
  resource search/sort, nested draft-resource editing, inline `create_if_empty`
  and remaining popup options. Verify each contract separately.

### P3: Root fields and compatibility policy

- [ ] Inspect and implement the verified `$.currencies` contract. Do not invent
  denominations, exchange rates or automatic inventory effects.
- [ ] Inspect `$.macros` and establish its actual runtime/data semantics before
  implementation. Do not confuse it with RPGScript authoring macros or execute
  imported JavaScript.
- [ ] Determine what `$.live_session_enabled` requires and whether it has any
  meaningful local-only behavior. Networked sessions, accounts or a backend
  need a separate product decision and explicit approval; they are not approved
  by this TODO.
- [ ] Verify upstream behavior when `sortBy.order` is omitted, at the reported
  `$.character_stats[171].components.order`, `[236]` and `[237]`.
  Sorting is already implemented using the user-approved ascending policy.
  Keep the warning unless evidence resolves the difference; do not list this
  as an unimplemented sort.
- [ ] Distinguish compatibility-policy warnings from unimplemented features in
  diagnostic labels. Do not hide either category or treat import success as
  proof of playable rules.
- [ ] Audit the complete diagnostic array and group remaining warnings by
  feature and dependency. Record pinned source paths and expected behavior
  before extending support.

## Catalogs and import follow-up

- [ ] Recheck the 19 blocked 5e2024 originals against verified upstream changes:
  three classes and three backgrounds with fractional weights declared as
  integers, plus 13 species with a different system ID. Preserve originals
  and blockers; do not cast constants or rewrite system IDs to make them pass.
- [ ] Verify resource-archive framing, tooling and licensing before supporting
  full item/spell/book compendia beyond the current JSON catalog roots.
- [ ] Source compilation remains deferred. Establish usable, current official
  tooling before proposing a desktop or browser workflow. The approved current
  flow remains compiled-system file once plus automatic GitHub catalogs.

## Remaining verification

- [ ] Obtain the missing original `.reference/reported-system.rpg` and rerun
  the three skipped HP/AC regression cases without substituting another file.
- [ ] Compare complete creation, leveling, equipment, spell, rest and combat
  workflows against independently verified upstream behavior.
- [ ] Check Safari/Firefox and actual mobile installation, not only Chromium
  desktop/phone emulation.
- [ ] Test assistive technology, keyboard flows and full-interface accessibility
  beyond the checked palette pairs and existing focus assertions.
- [ ] Test storage quota/eviction behavior and a deployed two-version worker
  update without losing local data.
- [ ] Run a full development-dependency audit separately from the completed
  runtime-only audit.
- [x] Obtain explicit authorization for commit and push of all project changes.
  The existing workflow gates Pages publication; local checks alone do not prove deployment.

## Completed in the latest increment

- [x] Optional automatic first-level D&D HP on new character creation: final
  class die plus Constitution, current HP equals maximum, negative modifiers
  preserved, manual fallback and no resets of existing characters.

- [x] Beginner ability explanations, manual/standard-array/point-buy/dice
  methods, unique roll assignment and explicit draft application for supported
  D&D systems. Other systems retain manual typed values.
- [x] First source-event presentation effects: character INFORMATION and
  source stat rolls, using fresh snapshots without persistent mutation.

- [x] Background catalog discovery, private assignment, saving and backup.
- [x] Source-declared subrace selection using original scalar IDs, with stale
  selection guards and dependent clearing on catalog-panel race changes.
- [x] Druid assignment for 5e and 5e2024, validated `remove_ids` history and
  offline refresh of old cached blockers without changing originals.
- [x] The supplied charcoal/brass direction, dark default with persisted light
  option, local fonts, phone navigation and centered dialogs.
- [x] Requested workspace/profile/status/sidebar-footer/settings-panel removals.
- [x] Guided manual creation/configuration, scoped character ownership, private
  feat copying, stat details/colors and stable scrolling source forms.
- [x] Current unit/build checks: 240 unit tests passed with one skip; build and
  runtime audit passed. Complete final browser results are recorded in
  `docs/VERIFICATION.md`, not combined with earlier root/live runs.
- [ ] Further reduce the earlier measured throttled-mobile HP latency of
  1,117 ms at 10,000 resources (Monster opening 160 ms). Rebenchmark after the
  beginner/event extension before treating those figures as current.

## Historical 5e 0.6.0 compatibility backlog

The following detailed checklist is retained from 2026-11-14. Its counts and
source-specific gaps describe that older snapshot, not the current 339-warning
report. Recheck each open item against current code and the target source before
implementing it; it is not a new full audit.

Scope: full runtime support for the inspected `5e` version `0.6.0` system,
not universal RPG-system compatibility. Original checkpoint: 2026-11-14.

The supplied `system.rpg` matches the pinned derpsy distribution: 101867
compressed bytes, 317 character stats and 50 resource definitions. SHA-256:
`629daf13b73eb11fc898077418ee2440ccdc75c12e59720c074780cb99e1ed9c`.
The current diagnostic snapshot contains 1,601 warnings, many repeated or about
null optional fields. This is not a count of distinct missing features.
Measured on 2026-11-14 after the enumeration/string formula increment: 0 errors,
1,601 warnings — 1,421 uninterpreted fields, 0 unsupported view instances, 3
unsupported formula nodes of 11,792, 129 unresolved formula references, 21
mechanics, 9 resources with mechanics, 4 creation pages, 46 enumerated types.
The increment reduced the total from 1,875 by implementing `resourceArray`,
`select`, `collapsible`, `button`, `resource`, `ticker`, `viewPager` and
`menuButton` rendering; declared events and `create_if_empty` stay reported.

Existing collection formulas, scoped drafts, supported source popups, atomic
saves and combat initialization are not listed as missing. Their limits remain
documented in [VIEWS](docs/VIEWS.md) and [COMPATIBILITY](docs/COMPATIBILITY.md).
Public GitHub root/`.git` retrieval is implemented separately; it does not
complete external content-archive support. See [GitHub import](docs/GITHUB_IMPORT.md).

### 1. Contexts, references and incomplete characters

- [x] Implement the `$edit_mode` view scope: false on rendered sheets, true inside
  a real draft session.
- [ ] Implement real `$character`, `$parent` and `$is_new` scopes
  with verified ownership, nesting, cache isolation and lifecycle semantics.
- [ ] Support required nested resource read/write paths, preserving exact
  system pins and patching the latest owner atomically.
- [ ] Resolve the empty-class saving-throw failure: `classes=[]` currently
  produces null proficiency, which fails the strict boolean `when` condition.
- [ ] Handle unselected race/class states through verified source behavior and
  creation flow. Reproduce `race.current_level_traits` and `race.name` failures;
  do not fabricate an empty race or coerce null conditions to false.
- [ ] Resolve the 13 unresolved stat references left by missing scopes:
  `$view.<select>_select` popup targets, `$resource.traits`/`actions`/`reactions`/
  `legendary_actions` on the monster view and `monster.photo`/`armor_class`/
  `initiative`/`speed`, plus `current_hp`/`max_hp` in resource stat scopes.
  Confirm whether each is a diagnostic scope gap or a real source feature.

### 2. Remaining formulas and resource operations

- [x] Implement `notNull`, `enumeratedName`, `enumeratedAbbreviation`,
  `toNum`, `toSignedString` and `replace`. Enumeration labels resolve inherited
  entries and fail for unknown ids; `toNum` rejects non-decimal text and
  `replace` is literal, all-occurrence and bounded.
- [ ] Verify `eventName` upstream semantics; only the static `fireEvent.event_names`
  list form is implemented, not `eventName` as a general formula (`map` mappers).
- [ ] Verify and implement `split`; the public page documents a plain separator
  while the pinned source passes a regular expression, so semantics are unverified.
- [ ] Verify and implement `copyResource`, including identity, references and
  clone ownership; do not assume shallow or deep copying semantics.
- [ ] Implement `createChip` and dynamic `listItem.chips` evaluation/rendering.
  `chips` is declared on 21 list/search views and holds the 18 `createChip` nodes.
- [ ] Verify and implement `forEach` (9 nodes, effect iteration), `append` (1 node)
  and the `copyResource` clone semantics used by creation `post_edit` effects.

### 3. Missing source views and controls

Implemented in the view increment: `resourceArray` display/edit/list rendering
with create/remove, `pop_up_type`, `left_view`, `hide_line`, `auto_add_first`;
`resource` display/edit/list rendering; enumerated and resource-backed `select`
(including `multi_select`, `max_selection_amount`, `style: list`); `ticker`
(bounds, step, direct edit, styles, `$edit_mode` visibility); `collapsible`;
`viewPager`; `menuButton` options; `button` text/enabled state.

- [x] Implement `resourceArray` rendering, including `class_features_subsection`.
  Nested editing of instances created inside one draft session remains missing.
- [ ] Implement the validated operands editor `value_calculator_edit`.
- [x] Implement `resource` and enumerated `select` controls.
- [ ] Implement `menuButton` event dispatch, including `skills_section_menu` and
  `lifecycle_events_button`. Source options already render; choosing one does not
  run its event.
- [x] Implement `viewPager`, `ticker`, `collapsible` and `button`. `diffText`
  and button event dispatch remain unimplemented.
- [x] Implement dynamic stat bounds on `stat` views: `calculated_min_value_allowed`
  and `calculated_max_value_allowed`, sharing the ticker resolution (literal wins).
- [ ] Implement stat interactions: `on_tap_event` and `on_long_tap_event`.
- [ ] Implement stat sheets: `bottom_sheet_view`, `bottom_sheet_in_edit_mode`,
  `sheet_title` and `edit_bottom_sheet_title`.
- [ ] Implement `stat_color` and `name_color` using safe source color handling.
- [ ] Complete checkbox `switcher` and `should_auto_save`, vertical dividers,
  selection `filters`, resource `search_filters` and `sort_options`.
- [ ] Verify and implement remaining popup options: `extra_buttons`,
  `in_edit_mode` and `dismissible`.
- [ ] Implement avatar `avatarSection` action hooks `bottom_left_button_event` and
  `bottom_right_button_event`, and the checkbox `style: switcher` variant.
- [ ] Verify the behavior of resource metadata `is_encounter_template` and
  `is_combatant_entry` before treating those fields as supported.

### 4. General events, effects and mechanics

- [ ] Establish event scopes, execution order, aggregation, reversal and
  failure semantics from upstream documentation and pinned examples.
- [ ] Implement the general effect pipeline, including iteration, stat changes,
  event forwarding, delayed effects, messages and resource/popup actions.
  Existing combat initialization supports only its documented subset.
  Source evidence: 101 `setStat`, 24 `sequence`, 16 `roll`, 14 `addToStat`,
  11 `fireEvent`, 5 `delayed`/`showMessage`/`dismissResource`/`forEach`,
  4 `showPopUp`, 3 `copyResource`, 2 `forwardEvent`/`showResource`.
- [ ] Execute and verify all 21 system mechanics and the resource mechanics,
  including rests, daily events, condition removal, proficiency changes and
  source-defined stat rolls.
- [ ] Keep commands bounded and atomic. Never trigger events, initialization
  or rolls during rendering, reopening or backup restoration.

### 5. Official character creation and progression

- [x] Execute original creation pages, navigation and validations as one draft
  (`CreationFlow`): `$is_new` is true, Back discards the current page, Cancel
  writes nothing, the final page saves atomically. Manual setup stays available.
- [x] Offer catalog roots in draft `selectResources`, staging a private graph copy
  until Save (5e race selection in the creation flow).
- [x] Stage the `auto_add_first` instance with its draft (5e classes editor).
- [x] Edit nested draft-only resources inside a draft (inline auto-applied
  forms or popups re-stage an updated copy; 5e `class_details` class select).
- [x] Run page hooks on the draft (`setStat`, `addToStat` incl. list append,
  `sequence`, `when`, `forEach`, `meta_stat`, nested staged targets,
  `copyResource`, explicit `roll`, `$updated_stats`). `pre_edit` and other
  effects (`fireEvent` in PF2e) are skipped and shown.
- [x] Browser: full 5e creation (High Elf Wizard, Human Fighter) saves in ~1 s.
- [x] Verify PF2e creation pages end to end with the official 0.3.0 `.rpg` and
  141 local catalog roots (Human Dromaar Fighter saved in ~2 s).
- [ ] PF2e feats: the 1,089 `feat` instances are not importable catalog roots,
  so ancestry/class feat slots stay empty.
- [x] PF2e `daily_preparations` after creation: resource-scoped `eventName`
  dispatch, owned resource writes and `$character.stat` overrides (verified on
  Fighter, Rogue, Witch, Bard and Druid). Upstream scoping semantics remain
  assumptions documented in COMPATIBILITY.md.
- [ ] Backup bound: 32 MiB is exceeded by 5e + PF2e catalogs plus a few
  characters (each copies its whole class graph). Needs a decision before
  raising the limit or sharing immutable graph members.
- [ ] Decide whether the app may fetch official releases from the content CDN
  (new network endpoint: CSP and threat-model review required).
- [ ] Confirm upstream `$updated_stats` semantics (assumed: base stats changed
  by the confirmed page).
- [x] Label duplicate catalog names by source (e.g. two `Satyr` races).
- [ ] Implement `on_page_open`, `on_page_close`, `pre_edit` and `post_edit` with
  verified draft, confirmation, cancellation and repeated-operation behavior.
- [ ] Integrate race, class, background, abilities and related resource choices
  through the actual source workflow, not a replacement ruleset.
- [ ] Implement `experience_levelling_system` and `point_progression_system`,
  including confirmation, resource assignment and level-dependent effects.
- [ ] Retain the explicit distinction between manual source-input groups and
  the official creation/progression workflow until this section is complete.

### 6. External content archives, separate from system import

- [ ] Verify archive framing, upstream tooling and redistribution rights before
  implementing external resource-pack import.
- [ ] Extend the implemented class/origin/background JSON catalog subset to
  verified item/spell and archive formats, with correct definition/version
  references, duplicate handling and source provenance.
- [ ] Connect imported content to selection/search without confusing system
  definitions, distribution indexes, content archives and internal backups.

This section is needed to use external compendia. Successful `system.rpg`
import alone neither imports those contents nor establishes archive support.

### 7. Evidence and completion gates

- [ ] For each feature, record upstream semantics, pinned source paths,
  uncertainties and independently expected results in `docs/COMPATIBILITY.md`.
- [ ] Add regression tests on the original system, including null/empty states,
  nested scopes, cancellation, repeated actions, concurrent edits and rollback.
- [ ] Compare complete character workflows with verified upstream behavior:
  creation, leveling, equipment, spells, rests and combat.
- [ ] Exercise desktop/mobile controls, offline reopening, exact original export
  and backup restoration without changing imported originals or character pins.
- [ ] Run `npm run check`, `npm run build`, `npm audit --omit=dev` and production
  Playwright on isolated port 4183 as required by `AGENTS.md`.
- [ ] Inspect the complete diagnostics, not only the first 100 displayed items.
  Resolve each relevant unsupported path through implementation and evidence,
  never warning suppression or acceptance-only registry changes.
- [ ] Update `docs/VERIFICATION.md` with actual results and remaining limits.
  Zero static errors or passing import tests alone do not prove compatibility.
