/** @file Recognizable remote game choices, without bundled third-party rules. */
import { BookOpen } from 'lucide-react';
import { it } from './it';

/** Only verified importable sources offer an action; availability is not full rule support. */
export function GameChoices({ busy, onChoose, installed = [], onUse }: {
  busy: boolean; onChoose: (id: string) => void;
  /** Source ids already in the library; those rows lead to the characters instead of preparing again. */
  installed?: string[]; onUse?: (id: string) => void;
}) {
  return <section className="system-import" aria-labelledby="game-choices-heading">
    <h2 id="game-choices-heading">{it.gameChoicesTitle}</h2><p className="muted">{it.gameChoicesHelp}</p>
    {/* PF2e uses the same entry action, but its source syntax error requires the guided compiled-file step. */}
    {[{ id: '5e', name: it.game2014 }, { id: '5e2024', name: it.game2024 },
      { id: 'pf2e', name: 'Pathfinder 2e' }].map(game =>
      <div className="import-source-row" key={game.id}>
        <BookOpen size={22} aria-hidden="true" /><div><h3>{game.name}</h3><p>{game.id === 'pf2e' ? it.pathfinderHelp : it.gameSourceHelp}</p></div>
        {installed.includes(game.id) && onUse
          ? <button className="button secondary" disabled={busy} onClick={() => onUse(game.id)}
            aria-label={`${it.useGame} · ${game.name}`}>{it.useGame}</button>
          : <button className="button primary" disabled={busy} onClick={() => onChoose(game.id)}
            aria-label={`${it.gamePrepare} · ${game.name}`}>{it.gamePrepare}</button>}
      </div>)}
    <details className="import-format-help"><summary>{it.gameUnavailable}: Daggerheart</summary>
      <p><strong>Daggerheart:</strong> {it.daggerheartUnavailable}</p>
    </details>
  </section>;
}
