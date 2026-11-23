# D&D 5e compatibility audit

[← README](../README.md) · [Docs index](README.md)

Checked 2026-11-19. This is an implementation/source audit with the workflows
listed below, not certification of every 5e rule or every monster.

## Evidence

- Official compiled 5e 0.9.1, SHA-256
  `5de5642ad7281d7a99566a518d916e43c24f0c2046c4c40b8042e5074ac3ea3b`.
- Source revision
  [8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4),
  under `systems/5e/`. Fixtures remain local, not bundled game content.
- All **1,416 monster JSON files** pass typed catalog preparation against that
  compiled system, with no assignment blockers. Their original content totals
  29,301,904 bytes, exceeding the unchanged 24 MiB remote-batch budget.
  This checks data mapping, not every rendered view or action.
- Full diagnostics: **0 errors, 141 warnings**, including entries beyond the
  UI's first 100. Group counts: mechanics 11, events 19, references 47,
  unsupported 15, fields 46, other 3. Warnings overlap runtime contexts and
  conservative static analysis; they are not 141 independently reproduced bugs.

## Working, within the tested subset

- Manual character setup, six ability-generation inputs, initial class HP,
  class/origin assignment and source-derived calculations on populated graphs.
- Guided class/HP advancement, subclass choices, Fighting Style and Artificer
  Infusions drafted before confirmation, then saved atomically with advancement.
- Bounded explicit character and owned-resource actions: supported equip/
  attunement flags, quantity changes, attack/damage rolls, preparation/cast
  handlers and charge controls. A working flag or roll does not establish all
  downstream equipment, spell or condition effects.
- Selective monster search/import, private companion assignments and separate
  encounter copies; original Goblin name numbering, HP roll and AC are tested.
  Cancel, save, offline reopening, original integrity and backup restoration
  have regression coverage. See [executed verification](VERIFICATION.md).

## Remaining gaps, ordered by user impact

| Priority | Area | Status and practical impact |
| --- | --- | --- |
| 1 | Encounter templates | Selective search/import now covers `spell`, `weapon`, `armor` and `item` (see [verification](VERIFICATION.md)); encounter templates remain without an import workflow. The pinned tree contains 538 spells, 194 weapons, 62 armor entries, 734 items and 11 encounters. Embedded resources in supported class/monster graphs can already work; this is not a claim that all spell/item data is unavailable. |
| 1 | Creation and complete level-up rules | Official creation `pre_edit`/open/close/`post_edit` and full progression callbacks do not execute. Guided setup/advancement is explicit manual assistance. ASI/feat/proficiency/spell grants and selectable infusion effects are not comprehensively applied. Multiclass prerequisites need manual acknowledgement. |
| 1 | Automatic rule effects | Resource card actions have a bounded dispatcher, but general lifecycle aggregation, stacking/reversal, equipment bonuses and active infusion effects lack full parity. Selecting or equipping content must not be presented as proof that every modifier applies. |
| 2 | Rest, healing and spell-resource lifecycle | Official long and short rests run from the avatar menu: HP, hit dice and spell-slot formulas apply, hit dice are rolled and spent within their bounds (2026-11-20). First-load rest runs once on creation (2026-11-23): a new level 1 bard has two 1st-level slots and one d8 hit die. Missing: end-to-end checks of every subscribed resource recharge. Multiclass verified 2026-11-20 (Bard 3 / Wizard 2): pooled caster level 5 gives 4/3/2 slots on long rest, the Spells filter offers both classes, and each class card keeps its own ability (CHA, INT). |
| 2 | General events and combat automation | Multiple/dynamic character handlers, unsupported resource popups, roll-result callbacks and asynchronous/general effects remain limited or rejected. Combat initializes the verified synchronous subset; it does not execute general turn/round effects, automatically apply attacks/conditions, or award XP. |
| 2 | Source view contracts | `create_if_empty: true`, dynamic chips and some retained view fields remain unsupported. Character-only actions do not acquire combat/draft contexts. A valid catalog can still reach an unsupported display or event. |
| 3 | Online/interchange features | No shared live sessions, backend, generic upstream resource archives or character interchange. Local-first/offline behavior and internal validated backups are deliberate, not missing cloud credentials. |

## Verified source mismatch, not silently repaired

The unchanged compiled definition
`resources[id=monster_instance].display_view.subviews[19]` declares
`resource_id: monster_instance_trait`. The source equivalent is
`system/resources/monster_instance/display_view.rpgs:288-293`.
Neither the compiled system nor that source tree defines this type; both
define `monster_trait`. This is a confirmed definition mismatch.

Its impact across all companion/combat detail views has **not** been browser
verified. No guessed alias or source rewrite was added. Separately, warnings
about `$resource.traits`, actions and similar paths are not sufficient evidence
of missing data: combat supplies `$resource` as the monster template.
Likewise, `$parent` warnings must be checked in an actual ownership path;
class-parent calculations already have working regressions.

## Recommended next scope

Add selective spell/equipment catalogs first, then verify complete creation,
advancement and rest workflows against unchanged inputs. Treat source-definition
repairs and broader effect parity as separate, explicitly approved changes.
Do not raise byte limits or suppress diagnostics to claim compatibility.
