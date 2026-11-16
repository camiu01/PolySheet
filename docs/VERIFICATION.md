# Executed verification

[Documentation index](README.md) · [How to run checks](DEVELOPMENT.md) ·
[Historical records](VERIFICATION_HISTORY.md) · [12:37 checkpoint](VERIFICATION_2026-11-16_1237.md)

## Current increment, 2026-11-16

Character actions and manual inventory:

- `npm run check`: TypeScript passed; 255 tests passed, one skipped, 30 files,
  14.49 s. Source actions use unchanged official and Archer inputs, with explicit
  resource graphs for Archer's missing type declarations.
- `npm run build`: passed, 1,749 modules; main JS 716.27 kB (gzip 213.46 kB),
  CSS 51.24 kB; 15 precache entries, 887.15 KiB.
- `npm audit --omit=dev`: zero runtime vulnerabilities.
- Focused production desktop/mobile: two passed, exit 0, 49.1 s. Covers actual
  skill tap/long press, proficiency Save/Cancel, currency adjustment, inventory
  drafts and final character persistence, offline reopening and advancement.
- Initial regression attempts exposed incomplete test setup and Archer's absent
  resource-type declarations; fixed the fixture, not the imported source.
  Full unit validation then found the five newly implemented currency-title
  warnings in each package snapshot; counts now match 333 / 332 / 491.
  The first browser attempt was interrupted; the next used the wrong expected
  currency label (`Copper` instead of original `CP`). The corrected run passed.
- Desktop/mobile captures inspected inline. No agents or detector reruns.
  Existing Zod annotation and >500 kB chunk warnings remain. One unit fixture
  skip is the missing exact historical reported-system input.

- Full production desktop/mobile, port 4183, `/PolySheet/`:
  runner reported **78 passed, 2 skipped, 5.3 min**, with no failed cases.
  The background harness reported an unavailable exit code; this is the runner
  result, not a claimed captured exit 0. Both skips need the missing exact
  historical reported-system fixture.
- Final root-path asset/worker/font/navigation regressions: **4 passed,
  exit 0, 13.4 s**, desktop/mobile. The existing port-4173 preview was untouched.
- Documentation: 21 staged Markdown files, 129 local links/anchors valid.
  Staged diff checks pass outside the three unchanged upstream OFL license
  lines with trailing spaces; those exact license texts are preserved.
- Inline staged security review and secret-pattern check found no actionable
  findings. The local report is `.reference/security-findings.json`.
  This is not an independent audit or penetration-test certification.

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

## Previous comparison/filter increment, 2026-11-16

Nullable-resource comparisons and source selection filters, with a clearer
resource picker and primary character-configuration action:

| Executed check | Result |
| --- | --- |
| `npm run check`, final code | TypeScript passed; 246 Vitest tests passed, 1 skipped, 28 files; 11.27 s |
| `npm run build`, final code | Passed; 1,743 modules; main JS 693.17 kB, gzip 207.22 kB; CSS 51.24 kB; 15 precache entries, 864.59 KiB |
| Focused production guided setup, before final header adjustment | 2 passed, 29.4 s, desktop/mobile; actual spell prefilters, removal, cancel/reset, clone/append and offline reopening |
| `npm audit --omit=dev` | 0 runtime vulnerabilities |
| Full production Playwright, final code, port 4183, `/PolySheet/`, `--max-failures=1` | 78 passed, 2 skipped, 4.8 min; exit 0; includes offline, backup restore and original-byte preservation |
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
