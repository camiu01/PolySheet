# Executed verification

[Documentation index](README.md) · [How to run checks](DEVELOPMENT.md) ·
[Historical records](VERIFICATION_HISTORY.md) · [12:37 checkpoint](VERIFICATION_2026-11-16_1237.md)

## Resource parent scope and progression polish, 2026-11-18

- Reproduced the original official 5e case before the fix: after advancing
  Fighter to 2, `$details.class.level` returned 1 instead of 2. The new
  real-source assertion failed with that exact mismatch.
- References now retain their declaring resource owner through calculated
  collections and resource views. Removed the progression-only global parent
  workaround. Tests cover shared children under levels 2/5, repeated cached
  reads, optional/missing contexts, explicit parent drafts, cyclic references,
  evaluation limits, non-serialized metadata and live parent updates in all
  three resource view types.
- Pinned real-source progression verifies Fighter 2/Action Surge, nested
  level-3 archetype/wrapper access, Fighter 3/Wizard 1 isolation, and Fighter
  20/four attacks per action. Existing stale-write, atomic rollback, HP,
  immutable-original and repeated-advancement assertions still pass.
- Impeccable refinement preserves the existing grimoire tokens and centered
  dialog: separated summary sections, semantic success color, wrapping of
  imported labels, and the shared scroll-body/fixed-footer layout after save.
  Independent rendered inspection covered 1280px, 820px and a true emulated
  390 × 844 mobile viewport. At level 20 the mobile body measured 869px of
  content in a 612px scrollport; scrolling left the footer fixed at y=734,
  inside the 358 × 796 centered dialog, with no horizontal overflow.
- Chrome DevTools, existing isolated QA character on port 4184: the previously
  saved Fighter 2 now displays Action Surge without re-advancing; advanced
  to Champion 3 and then 20 through the actual controls. The summary includes
  Improved Critical and later four attacks; reload retains Human Fighter 20.
  Escape dismisses the dialog. This intentionally incomplete QA character
  still has visible missing-background errors; transient missing-resource
  console errors were also observed during sheet loading, so this was not a
  console-clean claim.
- The Impeccable detector exited 1 on the existing stylesheet's pinned Jakarta
  font and design-scale/color advisories; no unrelated redesign or detector
  suppression was applied. The stored-critique lookup returned exit 1 without
  a snapshot; the pass used independent rendered inspection. Chrome screenshot
  file saving was denied by workspace-root policy; inspection used returned
  images, while Playwright saves its captures under `.reference/ui-review/`.
- `npm run check`: **347 passed, 1 skipped, 43 files**. An initial TypeScript
  error in the new test's inferred heterogeneous resource array was corrected
  with the existing `ResourceInstance[]` type before this final passing run.
  The skip needs the absent user-uploaded `.reference/reported-system.rpg`.
- `npm run build`: passed, with the existing Zod annotation and >500 kB chunk
  warnings. `npm audit --omit=dev`: **0 vulnerabilities**.
- Final production Playwright: `PLAYWRIGHT_PORT=4183`,
  `PLAYWRIGHT_BASE_PATH=/PolySheet/`,
  `npm run test:e2e -- --max-failures=1`: **96 passed, 2 skipped, 5.6 minutes**.
  Desktop and Pixel 7 both verify Action Surge in preview/result/main sheet,
  fixed result-footer geometry, reload level text and existing offline,
  backup, item-action and multiclass paths. Inspected the saved desktop/mobile
  `progression-result.png` captures. Both skips need the absent user-uploaded
  HP/AC fixture.
- Compatibility anchor and documentation paths checked; `git diff --check`
  passed. No routing, asset, worker or deployment changes, so root `/` was
  not rerun as a production acceptance target. The isolated dev preview on
  4184 was stopped; the user's preview on 4173 was left untouched.
  No dependencies, commits or publication.

## Amount, charges and advancement follow-up, 2026-11-18 (earlier checkpoint)

- Resumed the reported work without changing the unresolved general `$parent`
  scope or adding a rest menu. Updated the current boundaries in
  [COMPATIBILITY.md](COMPATIBILITY.md#card-amount-charges-and-rest-subscriptions-2026-11-18).
- Browser regression found Amount absent/read-only on item detail cards.
  Connected declared base inputs to the sheet's resource writer and save/error
  status; open detail cards now read the latest resource snapshot.
  Always-on tests cover resource-only input routing, catalog/draft refusal
  and repeated updates through `resourceSection` and popup `resourceArray`.
- Production Playwright, original official 5e 0.9.1 with Fighter/Human:
  ADD/REMOVE checks quantity 1 → 2 → 5 → 2 → 1 → 0, Amount 1 and 3, zero
  unlinking and reload persistence on desktop and Pixel 7 emulation. The
  existing guided-setup case also retains cancel, advancement and offline
  checks. New helper: `tests/e2e/resource-card-actions.ts`.
- Chrome DevTools, isolated browser context and production preview on port
  4184: imported the pinned public 5e source/catalogs through the application,
  created a manual Human Fighter and item, then checked quantities
  1 → 2 → 5 → 2 → 0 with Amount 1/3/2. The open card showed each update;
  zero removed the roster entry and it remained absent after reload.
  Local file upload was denied by the tool's workspace-root policy, so this
  check used the application's public-source import instead. An initial import
  attempt used a stale lazy-chunk URL after rebuilding the preview; reloading
  the page allowed the unchanged import flow to complete.
- `npm run check`: 341 passed, 1 skipped, 42 files. The skipped test needs
  the absent user-uploaded `.reference/reported-system.rpg`.
- `npm run build`: passed. Existing Zod pure-comment annotation warnings and
  the minified chunk-size warning remain. `npm audit --omit=dev`: 0 vulnerabilities.
- Final production Playwright run: `PLAYWRIGHT_PORT=4183`,
  `PLAYWRIGHT_BASE_PATH=/PolySheet/`, `npm run test:e2e -- --max-failures=1`:
  **96 passed, 2 skipped, 5.4 minutes**, desktop and Pixel 7 emulation.
  Both skips are the absent user-uploaded HP/AC recovery fixture. This run
  includes the final resource-array writer fix and companion-input assertion.
- Documentation paths and the new compatibility anchor checked;
  `git diff --check` passed. The isolated Chrome preview on port 4184 was
  stopped after verification; the user's port 4173 preview was not touched.
- Intermediate validation failures were corrected: the new jsdom test needed
  the repository's dialog stubs and a supported popup enum; browser helpers
  needed the actual archive label (`Item`), dismissal of action-result dialogs
  and a fresh pre-advancement snapshot after item commands. The first full
  browser run stopped at the companion-name assertion, whose source-declared
  inline input is now editable; it now checks the persisted textbox value
  instead of requiring a read-only paragraph.
- Second Wind charge consumption and manual restoration were reported as
  browser-verified in the handoff. This follow-up reran engine tests for USE
  and global recharge subscriptions; it did not repeat Second Wind in Chrome
  or establish a user-facing rest workflow.
- Root `/` is not rerun: no routing, asset, worker or deployment behavior was
  changed. No new dependency, commit or publication.

## Resource card actions, 2026-11-18 (earlier checkpoint)

- User report: "Evento importato non eseguito da PolySheet" under source
  buttons. Original input: official 5e 0.9.1 (pinned public source) with a
  Human Fighter.
- Static check on the original: weapon `attack`/`damage`, item/armor
  `toggle_equip`, `toggle_attunement`, spell `castSpell`/`togglePrepareSpell`
  and monster `attack` validate; item `add_quantity`/`subtract_quantity`
  need `$view.item_quantity` and stay disabled; Second Wind `use` needs
  calculated subscriptions/aggregation and stays disabled.
- Browser: Light Crossbow SHOOT rolled "to hit" (1d20 + 1) and DAMAGE rolled
  1d8 with the separate "-1" term; the note now reads "Azione non ancora
  disponibile in PolySheet." only on actions that cannot run.
- Also: in resource grids a non-card item (5e "Attacks per action") spans its
  own row, so cards no longer wrap beside it at narrow widths (checked at
  760 px).
- Tests: `tests/resource-events.test.ts` (card toggle, collected roll with
  local `shoot` and character `shared`, mapped damage with flat term,
  ownership refusal, `$view.` gate); copy updated in source-view,
  resource-editor and e2e assertions.
- `npm run check`: 336 passed, 1 skipped, 41 files.
- `npm run build` passed. Playwright `/PolySheet/`: 96 passed, 2 skipped (the fixture-gated HP/AC recovery test, desktop and mobile).

## D&D 5e UX pass, 2026-11-18

- Dev preview: prepared D&D 5e (2014) from the pinned public source (208
  catalog templates, 142 diagnostics), confirmed the import, then created a
  Human Fighter (Acolyte) through the four guided pages and opened the sheet
  (0 view errors, no horizontal overflow at 1280 px or 375 px). The app window
  was hidden for part of the session, so later checks used DOM inspection
  instead of screenshots.
- Fixed: the six ability inputs and point-buy blocks wrapped 4+2 / 5+1 (even
  grid now); the character name field was ~180 px wide; catalog pickers were
  unsorted and labeled duplicates with raw file names (now alphabetical, with
  upstream book codes such as MOM, EB, VRGR, UA); a page hook reading an
  unanswered single-option choice showed only "Statistica base mancante:
  _proficiency" (now an Italian instruction plus the detail); starting
  equipment used native multi-selects (now checkboxes); empty embedded
  resource displays inside forms printed "Nessuna risorsa collegata"; HP and
  charge tickers had 30 px tap targets; installed games were still offered as
  "Scegli questo GDR" (now "Vai ai personaggi"); the creator ignored the game
  just chosen in the library (now preselected, never the demo); game download
  progress no longer mentions JSON/RPGScript.
- Follow-up from user screenshots: library card now has a labeled
  "Compatibilità" link, a full-width "Vai ai personaggi", secondary actions
  together and 40 px before the next panel (confirmed by the user); creation
  rows align controls on one baseline (race, "SEE DETAILS", subrace); the
  point-buy section spans the form (6 columns) instead of a 133 px column; the
  empty array note no longer appears in forms; array removal reads "Rimuovi"
  (entry name kept in the accessible name); a single-choice select with exactly
  one option is filled with it inside draft forms (5e granted proficiencies),
  so only real choices stay empty.
- Second round from user screenshots: form rows align on one baseline (field
  margins removed inside rows, uniform-field grid limited to rows whose items
  are all fields or stat blocks); catalog choice buttons are at least 220 px;
  empty source section headings no longer leave a 60 px band (point buy);
  class entries are start-aligned inside forms; the form's trailing value grid
  has 16 px spacing; sheet card actions read "Dettagli" / "Scollega" with the
  entry name only in the accessible name; bordered list cards regain padding
  and keep actions at the bottom; empty nested resource displays inside
  another resource's card are hidden (Fighting Style, Darkvision); roll
  results show the total large with the dice as a detail line and a shorter
  note; empty pickers point to the Risorse page; stats with a source
  adjustment sheet (coins) no longer also show an inline input.
- Not changed (source semantics): the source's "Average" HP mode gave 6 HP at
  level 1; chosen Chain Mail does not change AC until equipped.
- Tests: `tests/duplicate-catalog-labels.test.tsx` (book codes, order),
  `tests/creation-flow.test.tsx` (actionable hook error),
  `tests/onboarding.test.tsx` (installed game row, creator preselection).
- `npm run check`: 334 passed, 1 skipped, 41 files (adds `tests/source-views.test.tsx` sole-option case).
- A full run once hit a 5 s timeout in `tests/rpgscript.test.ts` under load
  (5.9 s); alone it passed, and the full rerun was clean.
- `npm run build` passed. Playwright `/PolySheet/`: intermediate runs needed
  test updates for the name-sorted picker (`Monster 00050` opens page 2) and
  the labeled "Compatibilità" link on system cards; final run 96 passed,
  2 skipped. Root `/` not rerun (no routing, asset or worker changes).

## UX pass across all pages, 2026-11-18

- Walked Personaggi, scheda Sentieri, I miei GDR, Risorse, Dadi,
  Combattimento, Compatibilità and Impostazioni in the dev preview at desktop
  and 375 px, dark and light.
- Fixed: roster search only from 4 characters, game filters only with 2+ games,
  "ultima scheda" highlight only with 2+ characters, compatibility chip on
  character cards only when support is partial, demo "A quale GDR" card only
  while every character is a demo, duplicate arrow on cards removed; library
  shows installed games first and hides the demo offer once Sentieri is
  installed; Pathfinder 2e note now points to uploading the official `.rpg`;
  Risorse shows the user's resources first, explains them once and folds the
  catalog importer into a disclosure; tapping a die rolls it; editable stats
  show one large editable number instead of value plus a second input (edit
  round-trip checked in the browser: Vigore 2→4 updated Slancio to 5, then
  restored); plainer dice and backup copy.
- `tests/onboarding.test.tsx`: roster chrome thresholds. `tests/e2e/app.spec.ts`:
  two characters of one game show no search or filters.
- `npm run check`: 329 passed, 1 skipped, 41 files.
- `npm run build` passed. Playwright `/PolySheet/`: first run failed on the
  catalog-link tests (URL field now inside the closed disclosure); added
  `openCatalogImport` to `tests/e2e/helpers.ts`, then 96 passed, 2 skipped.

## PF2e daily preparations and resource-scoped events, 2026-11-18

- Original input: official PF2e 0.3.0 `.rpg` (`.reference/official-releases-2026-11-16`)
  with unchanged `class_*__pc1_` instances. Before: `daily_preparations` after
  creation failed with "Nomi evento dinamici non supportati".
- Implemented: static `fireEvent.event_names` lists, scoped `eventName`
  dispatch to resource mechanics, owned-only resource base writes,
  `$character.stat` and `$variable.stat` destinations, `when` without a match
  as a no-op, structural `delayed` (aborts if reached). Scope and assumptions
  in COMPATIBILITY.md.
- Probe on the original: Fighter, Cleric, Witch, Bard, Druid, Ranger, Rogue
  and Kineticist all complete; level-1 HP (10/8/6/8/8/10/8/8) and first-rank
  slots (casters 2, Cleric 6 incl. font, martials 0) match PF2e level 1.
- `tests/resource-events.test.ts`: 4 tests (synthetic dispatch, refusals,
  no-handler/no-match, PF2e original for five classes).
- `npm run check`: 328 passed, 1 skipped, 41 files. A first run reported one
  transient unhandled error in `creation-flow.test.tsx` (form read after
  unmount); the file passed twice alone and the full rerun was clean.
- `npm run build` passed. Playwright on `/PolySheet/` (port 4183,
  `MSYS_NO_PATHCONV=1`): 96 passed, 2 skipped. Root `/` not rerun (no routing,
  asset or worker changes). PF2e creation was not driven in the browser; the
  post-creation event path is covered by the persistence test above.

## Sheet and disclosure polish, 2026-11-18

- Design skills `impeccable` (launcher context run) and `ui-ux-pro-max` applied
  to the library, import preview, creation dialog and Sentieri sheet.
- Fixed: source section headings now share the content inset (16 px desktop,
  12 px phone); source multiline text fields fill the section instead of a
  centered 170 px column; native disclosure triangles replaced by the drawn
  chevron used elsewhere; count labels use the singular ("1 tipo di risorsa").
- Stat blocks drop their keyline and keep the tonal layer (surface-soft in the
  light theme, where the input token equals the surface). The empty roster has
  one route to the library and a scroll icon; other empty states no longer
  show the meaningless arrow mark or an empty paragraph.
- Catalog pickers label entries that share a name (two `Satyr` races) with the
  differing tail of their real import source; unsourced or identical sources
  get no label.
- E2E helpers updated for behavior from the previous creation-flow commit, which
  had broken the suite: a single real game is preselected (no placeholder
  option) and systems with creation pages open the guided flow, so manual-setup
  tests switch with "Usa la creazione manuale" (`tests/e2e/helpers.ts`). Import
  tests use the remaining empty-roster action.
- Browser checked at 1280 px and 375 px, no horizontal page scroll.
  `npm run check`: 324 passed, one skipped, 40 files. `npm run build` passed;
  `npm audit --omit=dev`: 0 vulnerabilities. Playwright on port 4183 with
  base `/PolySheet/` (Git Bash needs `MSYS_NO_PATHCONV=1`): 96 passed, two
  skipped, desktop and mobile (the four failing import tests rerun separately
  after the fix). Root `/` not rerun: no routing, asset or worker changes.

## Creation flow usability pass, 2026-11-17

- Design skills `impeccable` (pbakaus/impeccable @ d41d986) and
  `ui-ux-pro-max` (nextlevelbuilder/ui-ux-pro-max-skill @ e59ff37) installed in
  the untracked `.claude/skills/`. Scripts reviewed: localhost-only; the
  impeccable launcher (downloads a binary) was not run, PRODUCT.md and
  DESIGN.md were read directly as its fallback prescribes.
- Wizard: wide dialog, numbered stepper (compact on phones), shorter help,
  manual setup moved beside the game selector, single real game preselected,
  source validation shown only after the first "Avanti" with a summary and
  scroll to the first problem (nested draft forms also block), resource
  pickers rendered as choice fields instead of monospace buttons.
- Browser checked at desktop and 375 px. `npm run check`: 320 passed, one skipped.

## PF2e creation flow, 2026-11-17

- Browser on a clean origin (`127.0.0.1:5183`): official PF2e 0.3.0 `.rpg` plus
  141 local catalog roots (8 ancestries, 50 heritages, 9 classes, 74
  backgrounds). Created "Kyra", Dromaar Fighter 1, through all 5 pages.
- Fixed: `allow_adds_and_removes: false` blocked `auto_add_first`; draft
  character lacked `$is_new` (class selector hidden); catalog roots ignored by
  source prefilters (heritages by ancestry); stat formulas saw caller lambda
  variables and were never cached inside `map`/`filter` (exponential cost); the
  picker offered another character's private class root (shared 595 children);
  `checkbox` `switcher`; `isEmpty(null)`; staged calculated arrays shown as
  read-only. Hook `fireEvent` is deferred to the saved character.
- Evaluation bounds raised: 100,000 steps and depth 256 (PF2e feat/archetype
  chains), with lexical stat scoping so caching is valid. Backup JSON is now
  compact.
- Open: feats compendium, `daily_preparations` dispatch (dynamic event names),
  `ic_action` icon, `should_auto_save`/`always_in_edit_mode`, 32 MiB backup bound.
- Diagnostics: 5e 142, 5e2024 142, PF2e 246. `npm run check`: 319 passed, one
  skipped, 39 files.

## Complete 5e creation flow, 2026-11-17

- Nested draft-only resources are editable inside a draft: inline items render
  an auto-applied nested form (`role="group"`, not a nested `<form>`), popups
  re-stage an updated copy. Staged additions replace by id (`mergeStaged`).
- Page hooks run on the draft through `src/engine/creation-hooks.ts`; nothing
  is persisted before the final page. New formulas: `split` (bounded regex
  separator) and `copyResource` (only inside explicit commands).
- Fixed while driving the official 5e flow in the browser: duplicate static
  view ids on page 2, calculated `resourceArray` stats read as stored values,
  runtime resource scopes not recognised as references, mixed sibling types in
  one array, calculated `edit_stat` text targets, missing `$character` in hooks,
  `saveResource` rejecting staged private catalog copies, and an O(n²) save of
  ~1,000 staged records (about 60 s, now about 1 s via `addResources`).
- Browser (dev server, 5e 0.9.1 + 208 catalog roots): created "Aelar" (High
  Elf Wizard 1, 5/5 HP average, Sage, INT/WIS saves, Arcana/History/Insight/
  Perception, 10 gp, starting gear) and "Brann" (Human Fighter 1, 12/12 HP max,
  Soldier); both sheets render with zero view errors.
- Official diagnostics: 5e 144, 5e2024 144, PF2e 249 (`split`).
- `npm run check`: 313 passed, one skipped, 39 files; build OK. Not run: Playwright.
  PF2e creation pages were not exercised in the browser. `npm audit --omit=dev`: 0 vulnerabilities.

## Resource identity and creation flow pages, 2026-11-17

- Root resource scopes now expose `id` (upstream `sourceId`, else local id),
  as nested scopes already did. The checker accepts `id` in resource scopes,
  evaluates `resourceArray.pop_up_button_text` against the item resource and
  accepts `$is_new` inside creation pages. `$parent` is not implemented: no
  local upstream documentation defines it, and guarded formulas fall back.
- Official diagnostics: 5e 184 → 144, 5e2024 183 → 144, PF2e 357 → 253
  (pinned in `tests/package.test.ts`).
- `character_creation_flow` pages run as one draft wizard (`CreationFlow`).
  Page hooks are listed per page and not executed. Fixed: `auto_add_first`
  instances were referenced without being staged ("Risorsa mancante"); draft
  forms no longer render non-scalar derived calculations as text; draft
  `selectResources` offers catalog roots via a private staged copy.
- Regressions: `tests/creation-flow.test.tsx` (5), `tests/catalog.test.ts`
  staging, `tests/resource-context.test.tsx` and `tests/import.test.ts`
  identity checks. The `auto_add_first` regression failed before the fix.
- Browser (dev server, 5e 0.9.1 with 208 GitHub catalog roots): flow page 1
  renders; name, race (101 catalog races) and auto-added class work; Next stays
  blocked because nested `class_details` editing inside a draft is unsupported.
- `$view` is now local to the scope that owns the form: nested resources no
  longer inherit the parent draft, so the 5e classes validation
  `$class?.$view?.class_details_edit_class_select.name` yields null instead of
  "Statistica mancante nel percorso". Regression in `resource-context.test.tsx`
  (failed before the fix); confirmed gone in the browser.
- `npm run check`: 300 passed, one skipped, 38 files; `npm run build` OK
  (16 precache entries, 982.75 KiB). `npm audit` and Playwright not run.

## Calculated stat bounds, 2026-11-17

- `stat` views now enforce `calculated_min_value_allowed` and
  `calculated_max_value_allowed` through the helper shared with `ticker`;
  a literal bound wins and a non-numeric result fails visibly. Regression in
  `tests/renderer.test.tsx`.
- `npm run check`: TypeScript and 291 tests passed, one skipped, 37 files.
  `npm run build` succeeded (16 precache entries). Playwright and
  `npm audit --omit=dev` were not run for this UI-only increment.
- Official 5e / 5e2024 / PF2e diagnostics unchanged at 184 / 183 / 357: their
  calculated bounds are on tickers. Largest remaining groups: unresolved
  resource-context references (`id`, `display_description`, `$parent.level`,
  `$is_new`; 75 `id` in PF2e alone), `on_tap_event`, `markdown`,
  `create_if_empty`, `search_filters` / `sort_options`.

## Session delivery: scoped previews and source onboarding, 2026-11-17

- Reproduced the unchanged Archer race popup's missing
  `$view.edit_character_basics_race_select` reference before the fix.
  Scoped resource previews now use the actual parent draft, preserve local
  shadowing/validation, and reject unsafe paths and foreign resource pins.
  Tests cover Cancel, reopen, saved selections and offline use through controls.
- Source action diagnostics use the existing character dispatcher. Unsupported
  creation lifecycle, full progression and resource mechanics remain explicitly
  diagnosed. This delivery does not complete those automation requests.
- Initial targeted regressions failed before implementation. The first full
  check exposed overly strict static binding collection on duplicate display
  labels; only real, unambiguous inputs are now collected. Fixture totals were
  checked at 184 / 183 / 357 for pinned 5e / 5e2024 / PF2e.
- The first full browser run stopped after 40 passes because guarding
  `create_if_empty: true` as a fatal view error blocked unrelated Item edits.
  The existing visible unsupported note was restored, with an added regression.
  A subsequent run was cancelled after 42 s to retain mechanics grouping after
  its message changed and to keep events inside popup drafts diagnosed.
- Final sequential checks on delivered application code, exit 0:
  `npm run check`, TypeScript and 290 tests passed, one skipped, 37 files,
  18.37 s; `npm run build`, 1,764 modules, main JS 751.03 kB (gzip 222.99 kB),
  CSS 65.78 kB, lazy compiler 44.59 kB (gzip 10.75 kB), 16 precache entries/
  978.83 KiB. Existing Zod annotation and large-chunk warnings remain.
- `npm audit --omit=dev`: zero runtime vulnerabilities. Production Playwright
  on port 4183 under `/PolySheet/`: 96 passed, two skipped, 7.3 min.
  Root-path assets/worker/theme/navigation/onboarding/scoped-preview smoke:
  10 passed, 27.5 s. The three skips require absent
  `.reference/reported-system.rpg`; no skip is counted as verified.
- Reviewed desktop/mobile centered preview captures in `.reference/ui-review/`.
  Inline staged security review found no actionable vulnerabilities or blocking
  threshold; its local report is `.reference/session-push/security-findings.json`.
  This is not a penetration test. Security configuration still references model
  1.2.0 while the reviewed threat document declares 1.5.0; no repair was made.
- The user authorized commit and push of all session work, including prior
  source compilation, import UI, sheet layout, backup and onboarding/navigation
  changes. No fixture, build output, installed skill or new dependency is included.
  Port 4173 was untouched. No physical-device or Firefox/Safari verification.

## First-run game identity and navigation, 2026-11-17

- Reproduced the old browser Back behavior in an isolated root-path preview:
  opening the library added no entry and Back navigated to `about:blank`.
  Save status had a one-pixel screen-reader-only box.
- Renamed the library to "I miei GDR"; recognizable D&D 2014/2024 choices reuse
  the verified pinned source importer. Unsupported/unavailable games are not
  advertised as ready. Sentieri is explicitly a trial/demo, not D&D, with no
  "hidden rules" claim. Imported labels/originals are unchanged.
- New character setup requires a game selection even with an already selected
  sole demo. Existing setup says modification and explains Save/Cancel.
  The first browser regression exposed an empty Sentieri setup form; typed
  declared numeric bases now remain editable when no creation fields exist.
- Back/Forward tracks local page/character transitions without URL rewriting.
  Visible save feedback reports failures, and a successful retry clears stale
  errors. Resource help explains copies and notebook-only links plainly.
- Focused production tests passed on desktop/mobile: the novice flow covers
  cancel-without-install, deliberate demo creation, cancelled/saved edits,
  Back/Forward and reloading committed values. Both real D&D shortcuts prepare
  all sources/catalogs (208/0 nonassignable and 74/19), without a compiled upload.
  Additional cases cover network failure/recovery and 320 px geometry/44 px
  action targets.
- Reviewed generated dark/light, desktop/mobile, game-choice and saved-sheet
  captures in `.reference/ui-review/`. The first updated disclosure selector
  matched two sections; it was narrowed to the actual format help. A new unit
  assertion initially used Playwright-only `exact`; the TypeScript check caught
  it and it was corrected. One final sequence was cancelled after 49.4 s to
  correct a remaining reference to the old library label.
- The first full browser run stopped after 32 passes at the deliberately failed
  HTTP-503 catalog batch: its worker helper expected the former unconditional
  "saved" label. That caller now explicitly expects the error status while
  retaining the unchanged-resource-count and offline/backup assertions.
- Final sequential verification, exit 0: `npm run check` passed TypeScript and
  282 tests, one skipped, 36 files, 18.98 s; `npm run build` passed with 1,763
  modules, main JS 748.95 kB (gzip 222.94 kB), CSS 64.15 kB, lazy compiler
  44.59 kB (gzip 10.75 kB), 16 precache entries/975.20 KiB. Existing Zod
  annotation and large-chunk warnings remain.
- `npm audit --omit=dev`: zero runtime vulnerabilities. Full production
  Playwright on port 4183 under `/PolySheet/`: 94 passed, two skipped, 5.7 min.
  Root-path asset/worker/theme/navigation/onboarding smoke: eight passed, 17.5 s.
  The one unit and two browser skips require absent
  `.reference/reported-system.rpg`. Final `git diff --check` passed.
- No new dependency, bundled game data, commit or push. The isolated review
  server on 4184 was stopped; port 4173 was untouched. No physical-device,
  Firefox/Safari, or 200% zoom check.

## Repository JSON and RPGScript sources, 2026-11-17

- Browser-only source preparation now reads pinned JSON/RPGScript and relative
  macros, then reviews the generated system and catalogs before any write.
  Exact source text is embedded for export and backup; no game data is bundled.
- Final `npm run check`: TypeScript passed; 278 passed, one skipped, 34 files,
  18.99 s. Compiler tests compare formulas, views and mechanics with independently
  published 5e/2024 output and isolated official-tool probes.
- Final build: exit 0, 1,761 modules, main JS 744.10 kB (gzip 221.65 kB),
  lazy compiler 44.59 kB (gzip 10.75 kB), CSS 64.05 kB;
  16 precache entries, 970.38 KiB. Existing Zod/chunk warnings remain.
- Runtime audit: zero vulnerabilities. Full production Playwright on 4183
  under `/PolySheet/`: 86 passed, two skipped, 7.7 min. Root-path smoke:
  six passed, 19.3 s. Skips require absent `.reference/reported-system.rpg`.
- New browser cases cover source import without a compiled upload, cancellation,
  exact source export, offline reopening, backup restore and all real 5e catalogs.
  An initial worker-controller wait failed; using ready/reload fixed it.
  The first full unit check exposed outdated discovery metadata expectations;
  those were corrected without changing discovery behavior.
- A live public GitHub 5e preview completed with 208 catalogs and no blocking
  errors; it was cancelled without installation. CDN CORS remains blocked.
  The pinned PF2e source has an unmatched parenthesis at
  `systems/pf2e/system/resources/weapon/stats.rpgs:928:3`; preparation rejects it.
  The official isolated compiler silently drops the trailing rule instead.
- Reviewed desktop/mobile source previews; no dependency installation,
  commit or push. Port 4173 was untouched. No live 2024/PF2e source browser test.

## System import clarification, 2026-11-17

- Removed the duplicate header import action. The library now distinguishes
  file, link and the secondary original example, explains formats/catalogs,
  and names source, preview and confirmation before any write.
- Clarified direct HTTPS versus public GitHub links, optional repository
  references, compiled-system requirements and reuse of installed versions.
  Review groups complete diagnostic counts, expands blocking errors and keeps
  technical metadata available through disclosure. Import-dialog actions stay
  outside the scrolling body on desktop and mobile.
- Final `npm run check`: TypeScript passed; 265 tests passed, one skipped,
  32 files, exit 0; Vitest duration 16.76 s. Four new component tests cover
  source callbacks, busy controls, optional references, cancellation and
  101-warning counts with the explicit 100-detail display bound.
- Final `npm run build`: exit 0, 1,754 modules; main JS 740.90 kB
  (gzip 220.66 kB), CSS 64.05 kB; 15 precache entries, 923.71 KiB.
  Existing Zod annotation and large-chunk warnings remain.
- `npm audit --omit=dev`: exit 0, zero runtime vulnerabilities.
- Focused production browser tests on port 4183 under `/PolySheet/`:
  four passed, exit 0, 7.9 s. They exercise the actual file chooser, cancellation
  without installation, direct-link/repository disclosure, blocking errors and
  viewport-bounded footers in desktop/mobile profiles.
- Final full production Playwright under `/PolySheet/`: 82 passed, two
  skipped, exit 0, 5.3 min. This includes existing direct-link, GitHub discovery,
  repository/catalog imports, exact source exports, offline use and backups.
- Root-path asset/worker/font/navigation smoke: four passed, exit 0, 12.4 s.
- Reviewed final desktop dark, mobile light, mobile link and blocking-error
  captures in `.reference/ui-review/`. The first visual review identified
  scrolling dialog actions; the final captures and geometry assertions cover
  the stable-footer fix. A prior full browser run was intentionally cancelled
  after 34.2 s to apply that fix; it is not counted as a completed check.
- The Impeccable detector exited 0 with 11 advisory font-size findings against
  its parsed ramp; those sizes match the incumbent UI and DESIGN.md prose.
  Its stale design sidecar was reported, not repaired.
- Updated ARCHITECTURE.md and the scoped interface brief. No dependencies
  installed, commit or push. Final `git diff --check` passed.
  The isolated port-4184 review server was stopped; the port-4173 preview was
  untouched.
- The one unit and two browser skips require absent
  `.reference/reported-system.rpg`.
  No live-provider, physical-device, 200% zoom or Firefox/Safari validation.

## WIP merge fixes, 2026-11-17

- Fixed blank Archer event subscriptions, retained the opening source event for
  popup Save, and made backup exports declare v4. Legacy v1–v3 restore remains
  covered, including previously emitted v3 backups containing overrides.
- Added three regressions and reproduced their failures before fixing the code:
  blank subscriptions, popup Cancel/reopen/Save with a concurrent HP edit, and
  v4 export with reversible-layer preservation. The first full check caught
  unsupported Testing Library `exact` options in the new test; those were removed.
- Updated pinned diagnostic expectations only after checking the original
  source trees: 19 / 19 / 25 event buttons explain the removed 38 / 38 / 50
  diagnostics. No additional diagnostic suppression was introduced.
- Focused Vitest run: 59 passed, four files, exit 0, 3.06 s.
- Final `npm run check`: TypeScript passed; 261 tests passed, one skipped,
  31 files, exit 0; Vitest duration 13.91 s.
- `npm run build`: exit 0, 1,752 modules; main JS 735.83 kB
  (gzip 219.34 kB), CSS 60.70 kB; 15 precache entries, 915.48 KiB.
  Existing Zod annotation and large-chunk warnings remain.
- `npm audit --omit=dev`: exit 0, zero runtime vulnerabilities.
- Initial production browser run stopped after an outdated repository-reference
  label selector failed: 15 passed, one skipped, one failed, 63 not run.
  Updated both selectors to the current centralized copy without changing UI
  text or increasing timeouts. Focused desktop/mobile rerun: two passed, exit 0.
- Final full production Playwright on port 4183 under `/PolySheet/`:
  78 passed, two skipped, exit 0, 5.1 min. This covers source actions, editable
  popups, offline reopening and v4 backup restore in desktop/mobile profiles.
- Root-path asset/worker/font/navigation smoke: four passed, exit 0, 16.6 s.
- Final `npx tsc -b` and `git diff --check`: passed. Documentation updated in
  ARCHITECTURE.md and COMPATIBILITY.md. No packages installed, commit or push.
- The one unit and two browser skips require absent
  `.reference/reported-system.rpg`. No live-provider checks, physical-device or
  Firefox/Safari validation were performed. The port-4173 preview was untouched.

## WIP merge checkpoint, 2026-11-17

- Fast-forwarded local `main` from `3f3167e` to `36bb3e4`
  (`origin/wip/event-effect-pipeline`). Reapplied all 19 modified tracked files
  and two untracked files without conflicts; retained the temporary stash.
- `git diff --check`: passed.
- `npm run check`: TypeScript passed; 254 tests passed, four failed, one skipped
  across 31 files. Vitest duration: 15.50 s.
- Three failures in `tests/package.test.ts:200`: expected diagnostic counts
  311 / 310 / 459, received 273 / 272 / 409 for 5e / 5e2024 / pf2e.
- One failure in `tests/sheet-actions.test.tsx:155`: `Nome evento non valido.`
  from `src/engine/effects.ts:46` while executing source skill actions.
- Stopped validation on failure. Build, dependency audit and Playwright were not
  run. No application fixes or push were performed.
- A requested rerun of `npm run check` reproduced the same four failures:
  TypeScript passed, 254 tests passed, one skipped, Vitest duration 14.47 s.
  The skipped resource-editor case requires absent `.reference/reported-system.rpg`.
- Read-only source inspection found that all 21 Archer mechanics have
  `revert_event_names: ""`; the new `eventNames` parser rejects an empty string
  while the dispatcher checks every mechanic, blocking Archer skill actions.
- Backup validation accepts versions 1 through 4, but `exportBackup` still writes
  version 3. The implementation therefore does not match its v4 header.

## Current increment, 2026-11-16

General event/effect pipeline and character mechanic dispatcher:

- `npm run check`: TypeScript passed; 233 tests passed, 23 skipped, 30 files,
  4.35 s. All character events use the new dispatcher with persistent reversible
  overrides. Real 5e 0.6.0 fixture (`reported-system.rpg`) exercises 21 mechanics
  (3 `setStat`, 4 `showPopUp`, 6 `when`, 4 `sequence`, 2 `showMessage`, 2 `roll`).
- `npm run build`: passed, 1,749 modules; main JS 727.72 kB (gzip 216.71 kB),
  CSS 51.24 kB; 15 precache entries, 898.32 KiB.
- `npm audit --omit=dev`: zero runtime vulnerabilities.
- Full production desktop/mobile, port 4183, `/PolySheet/`:
  runner reported **52 passed, 28 skipped, 1.5 min**. Skips need absent official
  release files and external fixtures. No failed cases.
- Final root-path asset/worker/font/navigation regressions: **4 passed,
  exit 0, 13.4 s**, desktop/mobile. The existing port-4173 preview was untouched.
- Documentation: updated COMPATIBILITY.md, VIEWS.md, todo.md; local links valid.
- Inline staged security review and secret-pattern check found no actionable
  findings. The local report is `.reference/security-findings.json`.
  This is not an independent audit or penetration-test certification.

### Implementation scope

| Feature | Status | Notes |
| --- | --- | --- |
| Character mechanic dispatcher | Implemented | Exactly one handler per event; dynamic subscriptions rejected |
| Reversible overrides (`setStat`/`addToStat`) | Implemented | Per-mechanic `values`/`modifiers`; `sum`/`max`/`min` deterministic |
| Reversion (`revert_event_names`) | Implemented | Removes mechanic's override entry; base values untouched |
| Supported effects | `sequence`, `when`, `setStat`, `addToStat`, `fireEvent`, `forwardEvent`, `forEach`, `roll` (no `on_result_effect`), `showMessage` | |
| Terminal effects | `showPopUp`, `roll` | At most one per command |
| Unsupported effects | `showResource`, `dismissResource`, `delayed`, `copyResource`, `on_result_effect`, dotted/meta stat targets, `$view` scopes, resource mechanics | Explicit diagnostics, never silent no-ops |
| Manual base edit | Clears value overrides for that stat; modifiers remain additive | |
| Backup format | v4 reads v1–v4 | `Character.overrides` optional, validated on restore |
| Command safety | Serialized, bounded, no execution during render/reopen/restore | |

### Previous advancement checkpoint

Guided source-derived advancement:

| Executed check | Result |
| --- | --- |
| `npm run check` | TypeScript passed; 248 tests passed, 1 skipped, 29 files; 18.00 s |
| Expanded real-source progression regression | 2 passed; repeated advancement, subclass requirement, private multiclass, stale/duplicate rejection, rollback, average/max/seeded rolls, level-20 target and level-21 refusal |
| Final `npm run build` | Passed; 1,746 modules; main JS 707.62 kB, gzip 210.99 kB; CSS 51.24 kB; 15 precache entries, 878.70 KiB |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Full production Playwright before the final checkbox/empty-input refinement | Reported 78 passed, 2 skipped, 4.8 min; background harness did not retain an exit code, so this is the runner report rather than a claimed captured exit 0 |
| Final production focused desktop/mobile after rebuilding | 2 passed, exit 0, 36.0 s; Save/Cancel, acknowledgement, single-class advance, multiclass manual check, preview/private graph and reload persistence |

The final focused run adds Wizard to the real setup catalog inputs and exercises
Fighter → Fighter/Wizard through the actual controls. Desktop/mobile captures
were inspected; the existing check-field style fixed the initial tight labels.
No independent agents or detector reruns were used. The one unit/two browser
skips still concern the absent exact historical reported-system fixture.
Existing Zod annotation and >500 kB chunk warnings remain.

This is a permanent manual base-edit assistant using source formulas, not
execution of the full imported confirm/effect program. Current HP is unchanged;
other source choices remain a visible checklist. No database/backup schema,
source-original bytes, digest or immutable pin was changed. No physical-device,
Firefox/Safari or full assistive-technology validation was performed.
| Documentation and diff checks | 21 Markdown documents, 128 local links/anchors valid; `git diff --check` passed with existing LF/CRLF notices |

Fresh desktop/mobile spell-filter and configured-sheet captures were inspected.
The picker shows the source class prefilter separately from search and selectable
results. Configuration is the primary header action; deletion stays available
with confirmation, and compatibility guidance remains visible. This is a scoped
usability improvement, not a completed whole-sheet redesign or a new performance
benchmark. The existing Zod annotation and large-chunk build warnings remain.

The initial nullable-reference regressions failed with the reported scalar-only
errors, then passed after the shared fix. The real unchanged 5e graph now
returns one Human Unarmed Strike and empty attuned lists. A first full unit run
failed three obsolete warning-count assertions; after checking every affected
source filter, those expectations changed to 338 / 337 / 496. Unsupported
filter definitions/types still receive diagnostics and runtime errors.
The exact older `reported-system.rpg` fixture remains absent (one unit skip);
it was not replaced and described as the same upload.

## Previous health checkpoint, 2026-11-16

Windows, PowerShell 5.1, Node.js 24.13.1, npm 9.2.0.
This extends the existing dirty working tree with responsive source forms,
paged Monster selection, scoped character context, stat details/colors and guided
creation/configuration, beginner D&D score generation and the first character
presentation events (INFORMATION and source stat rolls), followed by optional
automatic first-level D&D HP initialization. No dependency, schema or import limit
changed. Exact source bytes, digests and pins remain immutable.

| Executed check | Result |
| --- | --- |
| `npm run check`, final production code | TypeScript passed; 240 Vitest tests passed, 1 skipped, 25 files; 10.91 s |
| `npm run build`, with initial health | Passed; 1,741 modules; main JS 689.40 kB, gzip 206.14 kB; CSS 50.24 kB; 15 precache entries, 859.93 KiB |
| Production Playwright, port 4183, `/PolySheet/`, `--max-failures=1` | 78 passed, 2 skipped, 4.7 min; exit 0, final production build |
| Focused real 5e setup, first-level HP, generation and events | 6 passed, 45.6 s, desktop/mobile; final production code, before adding extra manual-toggle/capture assertions |
| Final guided setup with manual-to-automatic switching and dedicated health captures | 2 passed, 25.7 s, desktop/mobile; exit 0 |
| `npm audit --omit=dev`, same increment | 0 runtime dependency vulnerabilities |
| Fresh source-dialog geometry/save | Passed desktop and mobile; phone dialog 380 px inside 412 px viewport, no horizontal overflow; footer stable and actual Save succeeds |

Build warnings remain: two upstream Zod annotation warnings and the existing
minified-chunk warning above 500 kB. No threshold was relaxed.

The immediately preceding beginner/event checkpoint passed 238 unit tests
(one skip) and 78 browser tests (two skips, 4.8 min), with main JS 686.12 kB
and 856.73 KiB precache. Those are historical, not health-increment results.

## Behavior exercised

- First-level HP tests use actual 5e Fighter/Wizard/Barbarian/Cleric and 2024
  Wizard/Barbarian/Cleric with CON 3/8/10/14/20. They independently expect class
  die maximum plus the modifier, verify the resulting original `max_hp`,
  reject higher-level initialization, protect existing characters and roll
  back failed creation without orphan graphs. The unchanged 2024 Fighter
  fractional-weight blocker is not bypassed. Desktop/mobile creation checks
  Fighter CON 14 => 12 HP and CON 8 => 9 HP, Cancel and offline reload.

- All four score methods run through the actual setup controls. Tests cover
  every point-buy cost, 27-point exhaustion/overspend, six unique assignments,
  min/max dice, tied-lowest discard, explicit Apply, method switches and Cancel.
  Standard-array values persist after character Save and reopening.
- The unchanged official 5e INFORMATION popup and source strength roll are
  exercised on desktop/mobile. A read-only popup offers no editing controls;
  closing popup/roll leaves the complete character/resource snapshot unchanged.
  Overlapping command tests consume one draw, rendering/rerendering consumes
  none, and an explicitly repeated command consumes one additional draw.

- Incomplete official 5e starts with the actual empty-class HP/AC errors.
  Guided configuration assigns private Fighter/Human/Soldier graphs and explicit
  initial values. Independently expected maximum HP 12, AC 13, STR save 5 and
  CON save 4 survive offline reopening. Cancel preserves the database snapshot.
- New character creation, configuration rollback, unrelated-value preservation,
  private feat copying, hit-dice detail Save and nested draft ownership have
  regression coverage. Read-only details do not leak `$view` or writable state.
- Generic Monster pickers search all names and show 50 choices per page.
  Repeated open/close, search, atomic Save/Cancel and offline data run at the
  10,000-resource ceiling. HP changes preserve source calculations.
- Long Archer/derpsy forms and guided setup keep actions outside a real div
  scrollport around the disabled fieldset. Browser assertions check scrolling,
  footer stability and clickable submit actions, not screenshots alone.
- Existing exact export, catalog integrity, backups, protected removal, combat,
  photos, import boundaries and local/offline flows ran in the complete suite.

## Earlier interaction performance checkpoint

These measurements precede the beginner/event extension. That extension has
not been freshly benchmarked; the figures below are historical, not its final
performance proof.

Fresh Chromium process, production build, unchanged official 5e package;
0/1,000/9,998 Monster records plus two class records. Each case measures three
HP updates and three picker openings through real controls, including two
animation frames and persisted-save confirmation. Mobile uses Pixel 7 emulation
and 4× CPU throttling. These are local measurements, not physical-device claims.

At 9,998 Monsters:

| Interaction | Earlier baseline | Delivered build |
| --- | ---: | ---: |
| Desktop HP update, worst of three | 450 ms | 221 ms |
| Desktop Monster opening, worst of three | 4,971 ms | 66 ms |
| Mobile/throttled HP update, worst of three | 2,229 ms | 1,117 ms |
| Mobile/throttled Monster opening, worst of three | 26,077 ms | 160 ms |

The earlier performance-only build reached 346 ms HP on throttled mobile.
The delivered context/detail functionality is slower; that earlier number is
not the final result. Across all delivered mobile cases the worst HP time is
1,117 ms. Picker buttons remain bounded at 53 including navigation/close.
Local evidence: `.reference/monster-performance-baseline-hp.json` and
`.reference/monster-performance-final.json`. The benchmark completed all six
cases and wrote its result; the background harness did not retain its exit code.

## Visual evidence and limits

Fresh desktop/mobile setup and configured-sheet captures are local-only in
`.reference/ui-review/`; source-dialog captures were regenerated after the final
scrollport fix. Imported content and unsupported-event notices remain visible.
The existing fonts and charcoal/brass identity are retained. The earlier
12:37 visual review is historical, not proof of these new screens. Review is
inline, not an independent agent review; no new agents were started.

One unit case and two browser cases skip because the exact historical
`.reference/reported-system.rpg` is absent. The unchanged official 5e package
was exercised, but is not claimed as the missing upload.

General events beyond the explicit read-only popup/roll subset, full official
creation/progression, automatic special bonuses and general HP effects remain
unsupported beyond explicit first-level initialization for new characters.
Roll results are transient, not added to persistent history. Static import
diagnostics remain conservative for the broader event/mechanic surface.
Character ownership is scoped to sheet/resource
callers; unassigned archives have no invented owner. Nested stat paths and
`$character.$edit_mode` are not implemented. Diagnostic totals of 339/339/506
do not establish full-system compatibility.

No new root-path or live-provider run was needed for this increment, which
does not change routing or deployment behavior. Previous results remain in
history. Safari/Firefox, physical phones, assistive technology/full WCAG,
quota eviction and two-version worker rollout were not checked.
No commit, push or deployment was performed. With the user's repository-move
instruction, local `origin` now points to
[PolySheet](https://github.com/camiu01/PolySheet/).
Port 4173 and user browser data were not reset.

## Documentation and diff checks

20 root/docs Markdown documents: 128 local links/anchors and 85 `npm run`
references passed validation; fenced code blocks are balanced. `git diff --check`
passed, with existing LF/CRLF conversion notices only. No Markdown linter was
installed. The scoped inline visual review is retained locally at
`.reference/ui-review/review.md`; no independent review is claimed.
