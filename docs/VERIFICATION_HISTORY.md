# Historical verification records

These are preserved checkpoint records, not current results. Read
[latest verification](VERIFICATION.md) first. Dates, environments, warnings,
availability claims and words such as "current" below apply only to their
original run. No previous check was rerun by moving this text.


## Background/Subrace, visual and Druid implementation history

The [12:37 full checkpoint](VERIFICATION_2026-11-16_1237.md) preserves the
211-unit/72-browser result and its visual/documentation evidence. It predates
guided setup, scoped owning-character context and the final form scrollport fix.

- The initial Background/Subrace build passed 207 unit tests with one skip and
  72 browser cases with two skips. A first root-path subset passed 14 cases.
  These predate the Druid follow-up and are not final-code results.
- Catalog expansion found three additional invalid 2024 backgrounds, rather
  than the previously counted 17 class/species blockers. Guard, Guide and
  Soldier hold fractional weights in integer fields; their constants were not
  coerced. The pre-Druid blocked count was therefore 20.
- The Druid metadata reproduction first failed on the unsupported
  `remove_ids` wrapper. The parser fix then passed the real 5e assignment but
  exposed the same supported history in 2024 Druid, reducing its blocked count
  from 20 to 19. Both source paths were inspected before updating expectations.
- Earlier UI checks caught native dialog placement after the CSS reset,
  an accessible-name expansion from the nested hint, and a screenshot during a
  theme transition. Explicit centering, separated accessible descriptions and
  settled/animation-disabled capture fixed those cases without weakening source
  validation. The final review removed decorative heading labels and captured
  normal views after dismissing transient notices through their actual controls.
- A first final live-check command used an anchored title filter and selected
  no tests, after the 16-case root subset had passed. The corrected unanchored
  filter ran both live browser profiles successfully; no application edit was
  needed. The runtime audit then completed successfully.

## Before the Background/Subrace and visual increment

The following record predates those changes and the Druid snapshot fix.

## Source catalogs, links and removal checkpoint, 2026-11-16

Windows, PowerShell 5.1, Node.js 24.13.1, npm 9.2.0. Uncommitted working tree:
source-system discovery with one-time compiled-file selection, compact catalogs,
private manual assignment, resource-link imports and protected system removal.
No dependencies, deployment configuration or license texts changed.

The final application check started at 11:10:23. No production code changed after
the checks below. A later live-test-only edit adds an explicit resource-query
readiness assertion before comparing reimport counts.

| Executed check | Result |
| --- | --- |
| `npm run check` | TypeScript passed; 202 Vitest tests passed, 1 skipped, 17 files; 8.16 s |
| `npm run build` | Passed; main JS 657.82 kB, gzip 197.08 kB; CSS 37.59 kB; 11 precache entries, 714.27 KiB |
| `npm audit --omit=dev` | 0 runtime dependency vulnerabilities; not a full dependency audit |
| Production Playwright, port 4183, `/PolySheet/`, `--max-failures=1` | 68 passed, 2 skipped, desktop Chromium and Pixel 7 emulation; 3.3 min |
| Live GitHub API/Raw, `LIVE_REPOSITORY_IMPORT=1`, `/PolySheet/` | 2 passed, no skips, 20.3 s; actual source/catalog reads and the resource-folder link, without interception |
| Root `/`, resource-link/removal/asset-worker subset | 10 passed, no skips, 25.3 s, desktop/mobile; not a complete root-path suite |

Build warnings remain: two upstream Zod annotation warnings and the existing
minified-chunk warning above 500 kB. Thresholds and dependencies were not changed.

## Covered behavior

- Public repository metadata identifies 5e, 5.5e and Pathfinder 2e without a
  browser compiler. A matching compiled local system is selected once, then
  reused. Preview cancellation writes nothing; confirmation is atomic.
- Real local source checkout
  [8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4)
  was clean. All 117/58/67 originals for 5e/5e2024/PF2e were retained, with
  1/17/0 visibly nonassignable entries. Local compiled originals were unchanged.
  Browser cases exercised each full collection, private class/ancestry assignment,
  offline reopening, exact original export and complete backup restore.
- Resource links accept direct JSON, catalog-only GitHub roots, file/folder
  links and web `index.json` folders. Tests cover confinement, duplicates,
  size mismatch, no recursive indexes, HTML/CORS/HTTP errors and no partial
  writes. The new browser cases cover cancel, repeat import, failed later
  download, offline reopening and backup restore on both profiles.
- Exact remote gates: 1,000 files accepted, 1,001 rejected; 24 MiB accepted,
  one extra byte rejected; per-file 8 MiB remains. Web indexes count toward
  their aggregate and unknown-size reads use the remaining streamed budget.
- Templates retain exact BOM/source bytes and upstream IDs. Assignment creates
  private graphs; originals cannot be mutated or used as direct combat sources.
  Tampered backup/template shape, incorrect pins and global-record overflow
  fail without partial writes. Concurrent class appends preserve both edits.
- System removal requires confirmation, preserves other exact imports and
  preferences, and removes the selected version's resources/catalogs/rolls.
  Character/encounter pins block every deletion. Tests exercise rollback,
  stale creators, concurrent creation/removal in both orders and offline backup
  recovery, including another same-version import that still has a character.
- Earlier import, formula, form, photo, combat, package, offline and backup
  regressions ran in the same complete suite. Archer, derpsy, official packages
  and the reduced historical source fixture ran rather than skipping.

The focused new link/removal tests also passed independently: 18 unit tests and
8 desktop/mobile browser cases. These are separate runs, not extra complete-suite
tests.

## Skips and remaining limits

- One Vitest case and two desktop/mobile browser cases require absent
  `.reference/reported-system.rpg`. The historical uploaded HP scenario was not
  reverified. Optional fixture preparation is in
  [development](DEVELOPMENT.md#external-fixtures); clean-checkout counts differ.
- The initial CDN browser attempt failed CORS for both the index and compiled
  systems. The user chose compiled-file-once plus automatic GitHub catalogs,
  without a backend/proxy. No claim of CDN fetch support remains.
- Arbitrary public web hosts were not live-tested. They must supply the stated
  index format and permit CORS. HTML directory crawling, private/authenticated
  GitHub, packaged resource archives and source compilation remain unsupported.
- Full character creation, general effects, automatic progression and complete
  third-party gameplay remain unverified or unsupported. Invalid source values
  and unsupported merge wrappers are retained with visible assignment blockers.
- No new full development-dependency audit, Safari/Firefox, physical mobile
  installation, assistive-technology/WCAG, eviction/quota stress or deployed
  two-version worker update was checked.
- No commit, push, deployment or GitHub setting change was performed. The local
  preview on port 4173 and user browser data were not reset. Public demo
  availability does not identify its revision or prove these hosted workflows.
- No Markdown linter is configured. External documentation links are not
  exhaustively checked; local documentation checks are recorded separately below.

## Documentation checks

- 18 Markdown documents: 113 local links passed existence, exact-case and
  heading-anchor checks, including one retained image. Fenced blocks are balanced.
- 81 `npm run` references match configured scripts; seven referenced Node tools
  exist. No linter or dependency was installed for these checks.
- Retained original Sentieri screenshot: 1440 × 1000, 106,643 bytes, unchanged
  SHA-256 `46c01f82ad6228450e8c639a07b39bedbb7c1cc8238ff77972e9b9225e5bca37`.
- `git diff --check` passed. Existing Git LF/CRLF notices are not whitespace
  errors. License, dependency/lockfile and deployment configuration diffs are empty.

The documentation-only reorganization and the earlier sort-order checkpoint
remain in [history](VERIFICATION_HISTORY.md), with their original counts and
scope. The retained Sentieri screenshot is from the earlier local production
test, not a new live-site capture. No third-party game content is distributed.

## Catalog and resource-link implementation history, 2026-11-16

This records intermediate attempts, not the final check result.

- Real browser reads of the official CDN index and all three compiled system
  URLs failed CORS. The repository has no GitHub releases. The user explicitly
  chose a compiled system file once plus automatic GitHub catalogs, without a
  backend or proxy. The earlier CDN-fetch design was replaced, not bypassed.
- Real catalog inspection found unsupported `remove_ids` wrappers, integer
  fields holding fractional weights, and 2024 species declaring the other
  system ID. An initial Fighter-2024 assignment assertion failed correctly.
  The regression now explicitly checks its blocker and assigns a compatible
  Wizard original instead; no source value or validator was weakened.
- The first complete file-once browser run lost the ephemeral URL field after
  an intentional reload; the test now refills the input, as a user must.
  Its next focused run passed all six system/profile cases.
- Before the removal/link follow-up, the complete checkpoint passed 184 unit
  tests with 1 skip, build, runtime audit, 60 browser cases with 2 skips and a
  separate 2-case live GitHub run (18.1 s).
- The first removal UI test used an exact label lookup that did not resolve the
  native selector. It was corrected to its actual combobox role/name. All eight
  new link/removal desktop/mobile cases then passed in 26.0 s.
- The extended live test initially counted resource cards before Dexie's query
  rendered, producing a false expected count of zero despite 58 correct cards.
  It now waits for the independently known 58 originals before reimport.
  Production code did not change for either test-locator/readiness correction.

## Documentation checkpoint before catalog implementation

The two records below predate the completed catalog and resource-link work.
Their incomplete-work warnings describe that earlier state only.

### Documentation-only review, 2026-11-16

Environment: Windows, PowerShell 5.1, Node.js 24.13.1, npm 9.2.0.
The checkout contains pre-existing uncommitted application/test changes.
This review edits documentation and a documentation screenshot only.

The public [PolySheet demo](https://camiu01.github.io/PolySheet/) returned HTTP 200
with the PolySheet title and Italian empty-character screen. This establishes
page availability only, not its deployed revision, hosted import/backup/offline
flows or a successful GitHub Actions deployment.

Application checks, build, dependency audit and Playwright were not rerun for
this documentation-only change. The two application checkpoints below predate
the documentation edits and cover different working-tree states.

#### Documentation checks executed

| Check | Result |
| --- | --- |
| Local Markdown validation | 18 documents; 101 local link references, including heading anchors and one image, passed existence/case/anchor checks |
| Commands and tools | 80 `npm run` references matched configured scripts; referenced `node scripts/*.mjs` tools exist; fenced blocks are balanced |
| Screenshot | Inspected original Sentieri-only production-test image; retained PNG matches the source exactly, 1440 × 1000 |
| Diff review | `git diff --check` passed; Git emitted existing LF/CRLF conversion notices, not whitespace errors |
| Change scope | Pre-existing application/test changes retained; no application code, dependency, workflow, configuration or license text edited by this review |

The image comes from the existing 2026-11-16 browser run, not a new screenshot
session or hosted-demo acceptance run. No Markdown linter is configured, so
none was installed or run. External links were not exhaustively retested.
The three public editorial references actually read were
[BenchCore](https://github.com/camiu01/BenchCore),
[Haguruma](https://github.com/camiu01/Haguruma) and
[OTA-Bot-Mochi](https://github.com/camiu01/OTA-Bot-Mochi): plain product-first
introductions, practical startup steps, linked deeper guides, restrained badges
and explicit validation boundaries. Their licenses and project-specific claims
were not copied into PolySheet.

### Preliminary application check: partial catalog working tree, 2026-11-16

Windows; the recorded `npm run check` started at 10:11:28.
Vitest reported 5.39 s.

| Check actually executed | Result | Scope |
| --- | --- | --- |
| `npm run check` | TypeScript passed; 161 Vitest tests passed, 1 skipped, 13 files | Existing suite after preliminary catalog edits |

There were no dedicated catalog regressions or acceptance tests. No build,
runtime audit or browser suite ran after those edits. A passing existing suite
does not establish catalog import, assignment, immutability or backup correctness.
Catalog work is incomplete and must not be described as delivered.


This is a development verification record, not a compatibility certification.

## Approved omitted-sort-order compatibility policy

Executed on 2026-11-16 on Windows after the tooling investigation below.
The user explicitly approved ascending ordering with a visible warning when
`sortBy.order` is absent. This does not establish upstream engine parity.

- Before the fix, the new regressions reproduced six blocking errors in each
  official 5e package and fourteen in PF2e. The first targeted run returned
  exit 1: 38 passed, 5 failed, including the interpreter and diagnostic cases.
- After the fix, `npm run test -- tests/collections.test.ts tests/package.test.ts`
  passed **43/43**, without skipped fixtures. An intermediate test used a
  different real stat, `racial_traits`; inspection identified the intended
  omitted-order expression as `race_traits` at `character_stats[236]`, and the
  corrected test executes that unchanged expression.
- All three official package digests match the recorded originals. Installation
  is idempotent; backup restore retains exact decoded text, compressed bytes,
  digest and complete diagnostics. Current errors/warnings: **5e 0/479,
  5e2024 0/479, PF2e 0/687**. The 6/6/14 omissions remain explicit warnings.
- Numeric, string, empty and stable tied sorting are covered, including a custom
  binding and nonmutation. Explicit invalid orders, including null and arrays
  containing `asc`/`desc`, are rejected by both interpreter and import validation.
- Final required checks, in order:
  - `npm run check`: TypeScript passed; **161 passed, 1 skipped** across 13
    Vitest files.
  - `npm run build`: passed. Rollup reported two third-party Zod annotation
    warnings and the existing large-chunk warning (main bundle 627.79 kB).
  - `npm audit --omit=dev`: **0 vulnerabilities**. This is not a full
    development-dependency audit.
  - `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1`:
    **46 passed, 2 skipped**, desktop Chromium and emulated Pixel 7, in 1.6
    minutes. Port 4173 was not stopped.
- Browser tests import all three unchanged official files, show the specific
  compatibility notice and partial badge, confirm installation, reopen offline
  and export identical gzip bytes. The always-on original fixture verifies
  notice visibility beyond both diagnostic-list cutoffs, cancel without
  installation, null-order rejection, numeric recalculation, offline reopening
  and backup restore with exact BOM text. Desktop/mobile 5e preview screenshots
  are local-only under `test-results/`; both were visually inspected.
- The skipped unit case and two browser cases require the absent historical
  `.reference/reported-system.rpg` HP fixture. The new official-file tests and
  existing Archer, derpsy and external-subset tests all executed.
- No live provider/CORS checks, deployment, root-path rerun or full development
  audit were performed. Routing, assets and worker behavior were not changed.
  General effects, class/race catalog imports and full creation/progression
  remain unsupported. No original source, browser user data or limits changed.

## Complete-system request: official tooling investigation

Executed on 2026-11-16 on Windows, before the approved policy above. During this
investigation, application code and external source files were not changed.
No complete-system compatibility was implemented or verified.

- Read the current official Dev Tool and hosting documentation. With explicit
  user authorization, downloaded the Windows installer linked from
  [the official download page](https://rpg-companion.app/dev). The installer is
  11,063,206 bytes, reports product version 1.0.0 and has no Authenticode
  signature. SHA-256:
  `dda4c850f41dc5122a496c797f331dd889b9e042b86a0992e05620650240a1ba`.
  Installation under `.reference/official-dev-tool/installed` returned exit 0.
  No Windows protection was disabled. The opened application window was closed.
- Downloaded official Marketplace extension `BlastervlaEnterprisesLLC.rpgscript`
  1.3.0, 65,631,631 bytes, SHA-256
  `b1f5d98172d4fd8c17e318fbc6de5c753851b941c68cb1309a56969c68e6cb2b`.
  Extracted only its Windows builder, schema, package metadata and MIT license,
  outside the distributed app. Builder SHA-256:
  `b998cf0635773b5d63b9d9591b8489fc4b335da51aa29349e9ea377657ef5162`.
  `refresh_system_builder.exe --help` returned exit 0 and documents `--base`,
  `--output` and `--structured-diagnostics`.
- Attempted compilation of all three systems at source commit
  `8788e3b18099e4a1b3510f02869d97f1488586b4`, without `--clean` or source edits.
  The first attempt reported `unknown argument "is_defeated"` at
  `systems/5e/system/combat_system/combatant_types/monster_instance/index.rpgs:8:30`.
  PowerShell's native-stderr handling stopped that wrapper with exit 1.
  A second attempt through Python avoided that shell behavior but timed out
  after 120 seconds and was terminated. Partial output files appeared for all
  three systems; none were accepted as valid. No successful native compiler
  exit or complete release manifest was obtained. This session's invalid
  generated output directory was subsequently removed.
- Inspected `scripts/publish_release.py`, which explicitly identifies the
  standalone compiler's missing `is_defeated` support and points to the
  original app's internal compiler. Both downloaded schemas omit the field.
  The extension's linked GitHub source page returned HTTP 404.
- After explicit user approval to use the published releases, downloaded the
  three official `system.rpg` packages and `resources.json` indexes, retaining
  exact local bytes. Ran the actual `prepareImport` entry point through Vite's
  SSR loader with dependency discovery disabled, without a listening server.
  All gzip envelopes decoded and all system schemas parsed, but semantic
  installation gates failed: **5e: 6 errors / 473 warnings; 5e2024: 6 / 473;
  PF2e: 14 / 673**. The inspection command returned exit 1, not a passing
  integration result. Complete diagnostics, not the first 100, are retained
  locally in `.reference/official-releases-2026-11-16/import-audit.json`.
  An earlier inspection with dependency discovery enabled also emitted an
  unrelated unresolved virtual-PWA-module warning; the final inspection did
  not emit it.
- All 26 semantic errors are absent `sortBy.order` fields. The live official
  documentation and downloaded schema mark that field required; no verified
  fallback was found. No default was applied at this stage. The subsequent
  user-approved policy is recorded above. Exact package digests, sizes, counts
  and example paths are recorded
  in [compatibility](COMPATIBILITY.md#official-compiler-follow-up-2026-11-16).
  These checks do not establish publisher authenticity or engine parity.
- Resource indexes contain 3,383 entries for 5e, 2,243 for 5e2024 and 3,456 for
  PF2e. HEAD responses show that the 5e and PF2e bulk resource files exceed
  the 8 MiB download limit. No bulk packs or individual resource payloads were
  downloaded, and no limits were raised.
- Browser CORS, resource interchange and engine parity were not tested. Same
  version strings do not establish source-commit identity. Postman CLI 1.75.0
  is installed and exposes simulation help, but `postman status` returned
  `unknown command 'status'`. No Postman workspace, owner search, collection
  or simulation was used or published.
- This investigation changed documentation only. Full application checks, build,
  audit and browser tests were not rerun. No content was published, and no
  character, backup or other browser data was uploaded or modified.

## Enumeration/string formulas and split-authoring diagnostics

Executed on 2026-11-14 on Linux against the delivered application code.

- Reproduced the reported `https://github.com/blastervla/rpg-companion-app-systems`
  selection failure. Its `systems/5e/system/system.rpg.json` (41,628 bytes,
  version 0.9.1) is an unassembled authoring root: `character_stats`,
  `character_sheet_sections`, `character_creation_flow`,
  `character_search_item_view`, `mechanics`, `resources` and `enumerated_types`
  live in sibling files/folders. The importer now names that condition and tells
  the user to use a compiled monolithic system; it never merges `.rpgs` sources.
  A partially populated document still receives field-level schema errors.
- Implemented the documented `enumeratedName`, `enumeratedAbbreviation`,
  `toNum`, `toSignedString` and `replace` formulas. Enumeration labels resolve
  `enumerated_types` including inherited entries, with one bounded cache per
  evaluator; unknown types/entries and missing abbreviations fail explicitly.
  `toNum` accepts only plain decimal text (≤64 characters); `replace` is literal,
  all-occurrence and bounded to 1 MiB; `toSignedString` prefixes non-negative
  numbers. `split` was left unimplemented because its documented plain separator
  conflicts with the pinned regular-expression usage, and `eventName` still needs
  an event scope.
- Supplied 0.6.0 fixture after the increment: **0 errors, 1,601 warnings**
  (previously 1,683), with 3 unsupported `eventName` formulas and 129 unresolved
  formula references. No warning was suppressed to obtain this count.
- `npm run check`: strict TypeScript passed, **146 passed, 11 skipped** across
  13 files. Skips are absent historical external fixtures. New independent
  regressions cover inherited enumeration entries, absent types/entries/
  abbreviations/environments, decimal acceptance and rejection, signed output,
  literal `$&` replacement, the reported 10,577-entry tree and the authoring root.
- `npm run build`: passed; main JS 627.36 kB (189.02 kB gzip), CSS 37.59 kB,
  11 precache entries (684.50 KiB). Existing Zod annotation and >500 kB chunk
  warnings remain. `npm audit --omit=dev`: zero known runtime vulnerabilities.
- Production Playwright on port 4183, `/PolySheet/`: **30 passed, 10 skipped**,
  matching the current baseline, including the supplied-system import case.

## Reported GitHub tree-size limit follow-up

Executed on 2026-11-14 on Linux against the delivered application code.

- Reproduced the report with `https://github.com/blastervla/rpg-companion-app-systems`:
  its recursive tree is complete (`truncated: false`, matching root tree SHA)
  but holds 10,577 entries, so the former 10,000-entry ceiling rejected the
  repository before listing its three `system.rpg.json` candidates.
- The discovery bound is now an exported `MAX_TREE_ENTRIES` of 20,000, sized to
  the existing 8 MiB streamed-response ceiling. Truncated or larger trees still
  fail explicitly; candidate, path, size and commit checks are unchanged.
- A read-only check of the public API confirmed 10,577 entries, 10,330 regular
  blobs, no unsafe paths or invalid sizes, and exactly three candidates
  (`systems/5e`, `systems/5e2024`, `systems/pf2e`), each about 41 kB. No clone,
  archive download or installation was performed.
- `npm run check`: strict TypeScript passed, **140 passed, 11 skipped** across
  13 files. The new regression reproduces the reported 10,577-entry tree and
  expects the three sorted nested candidates; the declared tree and candidate
  boundaries are exercised at 20,000 entries and 100 candidates.
- `npm run build`: passed; existing Zod annotation and >500 kB chunk warnings
  remain. `npm audit --omit=dev`: zero known runtime vulnerabilities.
- Production Playwright on port 4183 with `PLAYWRIGHT_BASE_PATH=/PolySheet/`:
  **30 passed, 10 skipped**, matching the current baseline; skips are absent
  historical external fixtures and the optional live provider case. The limit
  itself is covered by contract fixtures and the existing controlled GitHub
  browser flows, which were rerun unchanged.

## Pre-push root-hosting check

Executed on 2026-11-14 on Linux without application-code changes.

- `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/ npm run test:e2e -- --max-failures=1 --grep "production assets"`:
  **2 passed**, desktop/mobile. Verified root asset URLs, manifest, service-worker
  scope and offline reload. The existing production build was used.
- The full application checks and subdirectory browser suite remain recorded
  below; they were not repeated for this commit-only request.

## Reported AC, race and avatar menu follow-up

Executed on 2026-11-13 on Linux against the delivered application code.

- `npm run check`: TypeScript passed; **139 passed, 11 skipped** across
  13 files. Skips are absent historical external fixtures. The exact local
  reported upload was present and exercised.
- `npm run build`: passed; main JS 624.43 kB (188.20 kB gzip), CSS 37.59 kB,
  11 precache entries (681.64 KiB). Existing Zod annotation and >500 kB chunk
  warnings remain.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright, port 4183, `/PolySheet/`: **30 passed, 10 skipped**
  across desktop/mobile. Skips are absent historical fixtures and the optional
  live provider case. No port-4173 preview was stopped.
- Reproduced original empty-class AC and null-race description errors. Actual
  manual controls create and assign class, class-details and race records;
  Dexterity 14 gives AC 12 and the source-derived description. HP 14, AC,
  description and exact compressed source bytes survive offline/backup restore.
- Current original menu and `$edit_mode` rendering were already functional;
  their reported unsupported/missing-stat messages were not reproduced.
  Imported lifecycle and information events remain unexecuted and visible.
- A red renderer regression reproduced a false runtime warning for a null
  avatar event. Non-null unsupported event warnings remain after the fix.
  Import diagnostics and immutable source content are unchanged.
- An initial browser selector matched two menus and was scoped to the avatar.
  The next run exposed a real mobile menu overflow/pointer failure. Right-edge
  alignment fixed it; both the exact-source case and an always-on MIT
  viewport/pointer regression passed in the complete final browser run.
- Root hosting, live providers, deployment and general event/creation support
  were not verified. No game-rule fallback, migration or dependency was added.

## Reported HP recovery increment

Executed on 2026-11-13 on Linux against the delivered application code.

- `npm run check`: strict TypeScript passed, **138 tests passed, 11 skipped**
  across 13 files. The skips are pre-existing absent real-source fixtures;
  the user-provided HP fixture was present and its regression ran.
- `npm run build`: passed; main JS 624.42 kB (188.22 kB gzip), CSS 37.52 kB,
  11 precache entries (681.56 KiB). Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies, database schema or stored imports changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright on isolated port 4183, `/PolySheet/`: **28 passed,
  10 skipped**, desktop/mobile. The skips are absent historical Archer/derpsy
  and external-subset fixtures or their optional live source case.
- The exact reported upload reproduced the empty-class failure. Completing
  `Class` and `Class details` through actual manual resource controls and
  assigning the character's typed `Classes` field produced maximum HP 14 for
  independently entered level 2, Constitution 14 and base HP 10. Both browser
  profiles retained that result offline and after backup replacement; the backup
  retained exact original compressed bytes.
- Always-on regressions cover strict `notNull` behavior, invalid/missing nested
  formulas, lambda cleanup, local child-render error isolation and retry,
  discarded source drafts, Cancel, failed-reference rollback, retained failed
  drafts, busy state and unrelated concurrent field/archive-name preservation.
- The original class source form has duplicate `class_edit_base_ac` IDs.
  It remains invalid rather than being rewritten. The manual editor explicitly
  distinguishes typed data validation from source-form rule validation.
- Initial red tests confirmed the missing manual control and unsupported
  `notNull`; an intermediate type check and a test database reopening failure
  were corrected. Initial browser attempts used an unsuitable label selector
  and immediate checkbox-state check; final acceptance uses accessible roles
  and waits for the persisted assignment. The complete final suite above passed.
- No port-4173 preview was stopped. Root-path acceptance, live providers,
  deployment and general creation/archetype/leveling compatibility were not
  verified for this increment.

## Previous contributor guide and diagnosis-only investigation

Checked locally on 2026-11-13 on Linux.

- Root `AGENTS.md`: 367 words; required title and linked paths checked.
  The previous detailed instructions were retained in
  `docs/AGENT_INSTRUCTIONS.md`, including existing uncommitted project renames.
- An assertion harness loaded the actual import, initial-value and evaluator
  modules through Vite and read the user-provided `system.rpg` without changing
  it. The upload hash and exact formula paths are recorded in
  [compatibility](COMPATIBILITY.md#reported-empty-class-hp-failure).
- Original defaults independently checked: `classes=[]`, `level=0`, `base_hp=1`.
  Both reads of `max_hp` reproduced
  `max_hp: classes_hp_mods: max richiede una lista non vuota`.
  Repeated direct reads of `classes_hp_mods` also failed as expected; the
  complete input snapshot remained unchanged.
- Full static diagnostics: 0 errors, 1,683 warnings. The public `max`
  documentation was read and explicitly requires a nonempty numeric list.
  No arbitrary fallback, source mutation or compatibility claim was added.
- The first harness run also emitted a dependency-scanner error for the
  app's virtual PWA module, despite completing the assertions. The final run
  disabled unrelated dependency discovery and passed without that error.
- No application code changed. Application suites, production build, runtime
  audit and browser tests were not rerun. Populated-class behavior, browser UI,
  live source providers and deployment were not verified.

## Source-view increment (historical)

Historical run on Windows, Node.js 24.13.1, npm 9.2.0.

- `npm run check`: passed strict TypeScript and 144 tests in twelve files;
  11 skips are local-only real-source fixtures absent from a clean checkout.
  The new `tests/source-views.test.tsx` covers enumerated `select` options with
  inherited entries and allowlists, `collapsible`/`viewPager` paging, `ticker`
  bounds and direct edits, `$edit_mode` visibility, `button`/`menuButton` events
  staying disabled and visible, and `resourceArray` display mode.
- `npm run build`: passed; main JS 622.54 kB, 187.63 kB gzip; CSS 37.49 kB;
  11 precache entries, 679.70 KiB. Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies or database schema changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright on port 4183 with `PLAYWRIGHT_BASE_PATH=/PolySheet/`:
  **26 passed, 10 skipped**, matching the previous baseline; the skips are the
  external fixtures that are not present locally.
- Pinned `system.rpg` diagnostics after the increment: **0 errors, 1,683
  warnings** (previously 1,875), with 0 unsupported view instances, 85
  unsupported formula nodes, 129 unresolved references and explicit reports for
  the 19 source button events, `resource.create_if_empty` and `diffText`.
  This is not a claim of full runtime compatibility.

## Previous GitHub retrieval increment

- `npm run check`: passed strict TypeScript and 137 tests in eleven files,
  no skips. Eleven GitHub groups verify URL normalization, default/explicit
  references, commit pinning, selection, byte/tree/candidate bounds at their
  declared limits, unsafe/incomplete metadata, public-API failures, exact
  originals and immutable character pins through backup restoration.
- `npm run build`: passed; main JS 601.03 kB, 181.99 kB gzip; CSS 34.41 kB;
  11 precache entries, 655.69 KiB. Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies or database schema changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Final production Playwright on port 4183: **36/36 passed at `/PolySheet/`
  and 36/36 at `/`**, no skips. The two suites and the live check below took
  168.4 seconds for all three sequential commands.
  Controlled GitHub/Raw responses exercise the real clone-URL UI, reference
  encoding, file selection, invalid-content rejection, cancellation before
  installation, confirmation, exact export, offline reopening, rate limits,
  missing repositories and authoring-only trees. Existing acceptance passed.
- Separate intentional live public GitHub check: **2/2 passed**, desktop/mobile,
  9.8 seconds reported by Playwright, no intercepts. The real API resolved
  derpsy commit `00f55b2c3023c59f5857297dc933a7505c9b6aa4`, listed the tree,
  downloaded `5e/system.rpg`, and displayed version `0.6.0` with 317 stats.
  This establishes the observed public API/Raw availability and browser CORS,
  not continued availability or full RPG runtime compatibility.
- Pre-commit review reproduced a reserved view-ID validation failure:
  `__proto__` lost its error in a normal object dictionary. A null-prototype
  dictionary now retains validation for that ID, `constructor` and `toString`.
  The new regression verifies blocked Save. All final checks above ran after
  this correction. The focused security review records no remaining confirmed
  findings in the reviewed changes; it is not a penetration test.
- The existing preview on port 4173 was retained. Hosted deployment was not
  verified. Private repositories, non-GitHub Git hosts, arbitrary cloning,
  split-source compilation and resource archives remain unsupported.

See [GitHub contract and usage](GITHUB_IMPORT.md).

## Previous scoped-view increment

- `npm run check`: passed strict TypeScript and 125 tests in ten files, no skips.
  Eleven scoped-view regressions cover immediate draft validation, failed saves,
  nested Save/reopen/Cancel with combat overrides, exact-pin resource lookup,
  concurrent appends, invalid multi-field rollback, foreign additions, linked-PC
  combat writes and immutable backup originals. Both pinned original systems'
  six point-buy inputs and source cost calculations are exercised.
- `npm run build`: passed after the final application change; main JS 594.43 kB,
  179.75 kB gzip; CSS 34.37 kB; 11 precache entries, 649.21 KiB.
  Existing Zod annotation and >500 kB chunk warnings remain.
- Final production Playwright on isolated port 4183: **34/34 passed at
  `/PolySheet/` and 34/34 at `/`**, desktop/mobile, no skips; 147.8 seconds for
  the two sequential commands. The existing user preview on 4173 was retained.
  Tests use original Archer/derpsy popups, condition Save/Cancel, the six source
  point-buy inputs, validated note creation, local resource ordering/unlinking,
  offline reopening, exact source exports and backup restoration.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
  No dependencies or database schema changed.
- Earlier intermediate browser assertions/builds are not the final evidence.
  Nested popup reopening was corrected to prefer staged preview values over
  original combat overrides; final unit/build/browser checks ran afterwards.
- Full diagnostics for the attached derpsy `5e` `0.6.0` original were inspected,
  not just the first 100 displayed entries: 1,875 warnings and no static errors.
  This is not full runtime compatibility. Empty `classes` reproduces a null
  saving-throw proficiency and a strict boolean-condition error; null `race`
  reproduces required `race.current_level_traits` lookup failure. Neither was
  disguised with invented defaults.

General events, official creation/progression, nested resource contexts and
additional views/formulas remain unsupported. The manual source-input groups
are explicitly not an official character-creation workflow. See
[view contracts and limits](VIEWS.md).

Live public-provider checks and hosted deployment were not rerun for this
increment. URL tests used controlled responses. No commit, push or remote
settings change was performed.

## Previous collection-only increment

- `npm run check`: passed TypeScript and 114 tests in nine files, no skips.
  Seven new grouped regressions include both pinned original source variants,
  populated armor selection by actual local instance ID, strict input failures,
  lexical bindings, bounded flattening and required missing-race errors.
- `npm run build`: passed; main JS 562.21 kB, 171.07 kB gzip; 11 precache
  entries, 616.54 KiB. Existing Zod annotation and >500 kB chunk warnings remain.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright with port 4183 and `/PolySheet/`: 32/32 passed,
  no skips, 67.5 seconds including the command. Desktop and mobile exercise
  all six new handlers through real imported views and a saved text input;
  expected `1,3|2|no|si` becomes `1,3|2|si|si`, and survives offline reopening.
  Existing source export, backup/restore and combat acceptance also passed.
- Initial new integration assertions incorrectly assumed that manual defaults
  with a null race produced empty derived collections. They failed on required
  original paths. The tests now explicitly require those failures; the evaluator
  was not weakened or supplied invented defaults.
- One intermediate TypeScript test assertion failed; replaced it with an actual
  array guard. All final checks above ran after the final application change.

At this earlier checkpoint, the requested views and `$view` edit sessions were
not yet implemented. The current scoped-view results above supersede that
limitation. Root-path browser and live provider checks were not rerun at this
earlier checkpoint. No dependencies, database schema or original source records
changed.

## Previous combat and deployment baseline

The following results predate the collection increment above.

| Check | Executed result |
| --- | --- |
| `node scripts/inspect-archer.mjs` | Passed; pinned gzip-JSON system extracted locally |
| `node scripts/package-fixtures.mjs` | Passed; both pinned original `.rpg` blobs exported locally |
| `npm run test:external` | Passed; two required historical-source integration tests |
| `npm run check` | Passed strict TypeScript and all 107 tests in eight files; external tests ran, none skipped |
| `npm run build` | Passed; production PWA, 11 precache entries, 613.40 KiB total precache |
| `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1` | Passed all 30 tests under a Pages-style subdirectory, no skips, 53.5 seconds |
| `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/ LIVE_RPG_IMPORT=1 npm run test:e2e -- --max-failures=1` | Passed all 30 tests at the origin root, no skips, 54.8 seconds; includes two actual public Raw imports |
| `PLAYWRIGHT_PORT=4183 LIVE_RPG_IMPORT=1 npm run test:e2e -- --grep 'direct raw .rpg'` | Passed two additional unmocked public Raw import checks, desktop/mobile, 9.0 seconds |
| Workflow YAML and configuration checks | Parsed YAML and verified triggers, job dependencies, privileges, action SHA pins, artifacts; three valid and eight invalid path/port cases passed |
| `npm audit --omit=dev` | Rechecked after combat integration: zero known runtime dependency vulnerabilities |
| Targeted pre-commit security review | Reviewed 27 security-relevant modules/configurations; no remaining confirmed application finding; threat model and report retained |
| `npm audit --json` | Six build-tool dependency advisories: four moderate, two low, zero high/critical |

The inline environment assignments in the table describe the run; Windows
PowerShell uses `$env:NAME = 'value'` as shown in the README. Port 4183 isolates
acceptance runs from the user's active preview on 4173; no existing server or
user database was stopped or cleared. The full build-chain audit is from the
earlier dependency review; these features add no dependencies.

## Browser coverage

Playwright ran production `dist/` in Chromium at desktop 1440 × 1000 and Pixel 7
mobile emulation. Each profile covered:

1. Real file input, including retained UTF-8 BOM, import preview/confirmation,
   manual character creation, source fields, saved edits and derived values.
2. Worker activation, offline reload, character reopening, resource creation and
   notebook link, dice history, downloaded backup, confirmed deletion and restore.
   The restored backup retained values, resources, links, and rolls.
3. Malformed file rejection, unknown component fallback, and no imported code
   execution.
4. Locally intercepted HTTP 404, network/CORS failure, and permitted HTTPS JSON
   response. These are controlled browser fixtures, not public-provider tests.
5. Three manually created characters, persisted dark/light theme, keyboard focus,
   responsive layout, and no horizontal overflow on the tested screen.
6. The real historical ability slice and the entire extracted Archer `0.9.1`
   JSON document: visible partial support, source score `8 → 15`, modifier
   `-1 → 2`, save, offline reload, reopen.
7. The exact reported GitHub repository URL: identify an HTML/repository page
   before any download instead of labelling it an invalid URL/CORS failure.
8. Original Archer `0.9.1` and derpsy `0.6.0` `.rpg` files: real file input,
   partial-support warning, ability edit, offline reopen, exact original-byte
   export, backup v3 and restore, then byte-identical export again.
9. Direct Raw `.rpg` URL with the actual pinned bytes as a controlled HTTP
   response, malformed/unknown packages, and gzip distribution indexes.
10. Native browser decompression at the worst supported byte boundary:
    8,388,609 expanded bytes rejected without installation; exactly 8,388,608
    bytes accepted and installed. Both profiles passed.
11. Original MIT-licensed Sentieri gzip import, edit, offline reopen,
    byte-identical export and backup/restore, without third-party fixture files.
12. Production root/subdirectory pathname, manifest start/scope, worker
    script/scope and offline navigation. Both complete browser suites passed.
13. Typed scalar lists, same-version resource references, local PNG input,
    rejection of a truncated raster before saving, two combatants, manual
    initiative, turn/round advancement, offline reopening and backup v3 restore.
    HP initialization and saved turn state are retained rather than rerolled.

Separately, `LIVE_RPG_IMPORT=1` disabled request interception for the
[pinned derpsy Raw system file](https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg).
Both browser profiles downloaded and imported it over real HTTPS, then exported
bytes matching the pinned Git blob exactly. This verifies that endpoint's
browser access at the time of testing, not every server's CORS policy.

Desktop/mobile character-list screenshots were inspected. Screenshots and
failure traces are generated under gitignored `test-results/`; they do not ship.
Initial acceptance runs failed on navigation selectors and duplicate labels.
They also exposed off-canvas mobile navigation remaining keyboard-accessible.
The selectors were corrected and closed mobile navigation now uses CSS
visibility to leave the keyboard/accessibility tree. The final run passed.
The new GitHub-URL regression first reproduced the user's exact misleading
network/CORS text on the old build. The corrected run identifies the page
without requesting it. An initial acceptance launch found port 4173 occupied;
the harness now supports an isolated `PLAYWRIGHT_PORT`, leaving that app open.

The compatibility increment initially failed on an outdated backup-version test,
an optional-test skip API, native dice-resource setup and new browser selectors.
Tests now use the original `dice_roll` base fields, not a substituted calculated
formula. The offline helper waits for the asynchronous save transaction before
reload; checkbox assertions wait for the committed controlled value. Scalar-list
inputs remount when a removed item changes their value. Final runs above used the
hardened initializer and all passed.

## Unit and integration coverage

- Bounded formula evaluation, order, rounding, conditions, dependencies, cycles,
  caches, unsupported handlers, numeric errors, and no dynamic code.
- Cryptographic dice bounds and malformed expressions.
- Source schema/type validation, exact-source identities, unknown fields,
  UTF-8 preservation/rejection, prototype keys, byte/depth/node limits.
- Immutable versions, concurrent field edits, exact-version resource links,
  migration v1 → v2, reopening IndexedDB, bounded history.
- Backup validation, hashing, cross-record links, atomic replacement and rejection
  without modifying the live database.
- Source-driven rendering/editing, escaped HTML, visible unsupported events,
  null optional conditions, disabled checkbox, invalid numeric draft rejection.
- Pinned historical source errors rejected without coercion; unchanged selected
  source objects; six ability defaults and source note conditional behavior.
- Supplied Archer serialization/counts/dice and the persisted ability path.
- Gzip checksum/truncation errors, unknown envelopes, invalid UTF-8, source-byte
  identities, distinct gzip encodings of identical JSON, exact original bytes,
  unsupported native decompression, size-bounded/canonical Base64.
- Compressed/raw input and expanded size caps, including exact 8 MiB acceptance
  and one-byte-over rejection; oversized Content-Length and actual response body.
- Backups v2 and legacy v1 restore; reject v1 with binary fields, source/hash/JSON
  tampering, and invalid packages without modifying the live archive.
- Both pinned real gzip systems, unchanged source counts, and the real strength
  modifier; URL validation, GitHub pages, HTML, HTTP, network, timeout and decode
  error distinctions.
- Documented string/date/null/list/scoping examples, optional paths, nested lambda
  frames, dynamic stat names, cache bypass, safe resource paths, and no render-time
  randomness. Real source `created_at_display` matches the fixed expected date.
- Both original combat definitions: native dice-resource expression, one-time
  monster HP initialization, XP pool 50, source resolution on HP zero, healing,
  reopening and backup restore without rewriting source originals.
- Initiative ties, per-round/per-combat behavior, degradation passes, threshold
  rejection, atomic initializer failures, linked-PC concurrent field preservation,
  and rejection of malformed references/overrides/active state during restore.
- Unsupported initializer options, dynamic destinations, calculated aggregation,
  repeated destinations and implicit/concurrent sequences fail without partial
  persistence. Initializer resource references use the same integrity checks.
- Photo structural validation at the documented 1 MiB ceiling in a fresh Node
  process, over-limit rejection, canonical encoding and dimension bounds.

## Remaining warnings and unchecked cases

Build warnings remain for dependency `@__PURE__` comment annotations and the
559.58 kB minified main JavaScript chunk (170.43 kB gzip). No warning threshold
was raised to hide these messages.

The six audit entries belong to the development/build chain:
`vite-plugin-pwa`, `workbox-build`, `glob`, `minimatch`,
`@rollup/plugin-node-resolve`, and `deepmerge`. Runtime audit is clean.
Available upstream versions were checked; no unverified forced dependency
override or suggested major downgrade was applied. Recheck before releasing,
and build only trusted application source.

Not certified: Safari/Firefox, actual iOS/Android installation, assistive
technology or complete WCAG compliance, storage eviction/quota exhaustion,
two-version service-worker update rollout, static-host HTTPS/subpath deployment,
other third-party hosts' CORS policies, and sustained large-library performance.
The app has not been published to an external host. The Actions/Pages workflow
was inspected and its application commands exercised locally, not executed on
a GitHub-hosted Ubuntu runner. `npm ci` and browser/Linux dependency installation
were not rerun locally because the existing development installation was used.
Enable Pages and run the workflow on GitHub to verify hosted deployment.

External tests skip explicitly on a fresh checkout until their local-only inputs
are prepared. No third-party fixtures or compiled packages are distributed.
There is no full-system, generic compiled-package, creation-flow, general effect-engine,
or resource-pack compatibility claim. Only the independently verified gzip-JSON
system variant is supported, not the advertised book/class/race archives.
