/** @file Recognizable remote game choices, without bundled third-party rules. */
import { BookOpen } from 'lucide-react';
import { it } from './it';

/** Only verified importable sources offer an action; availability is not full rule support. */
export function GameChoices({ busy, onChoose }: { busy: boolean; onChoose: (id: string) => void }) {
  return <section className="system-import" aria-labelledby="game-choices-heading">
    <h2 id="game-choices-heading">{it.gameChoicesTitle}</h2><p className="muted">{it.gameChoicesHelp}</p>
    {[{ id: '5e', name: it.game2014 }, { id: '5e2024', name: it.game2024 }].map(game =>
      <div className="import-source-row" key={game.id}>
        <BookOpen size={22} aria-hidden="true" /><div><h3>{game.name}</h3><p>{it.gameSourceHelp}</p></div>
        <button className="button primary" disabled={busy} onClick={() => onChoose(game.id)}
          aria-label={`${it.gamePrepare} · ${game.name}`}>{it.gamePrepare}</button>
      </div>)}
    <details className="import-format-help"><summary>{it.gameUnavailable}: Pathfinder 2e, Daggerheart</summary>
      <p><strong>Pathfinder 2e:</strong> {it.pathfinderUnavailable}</p>
      <p><strong>Daggerheart:</strong> {it.daggerheartUnavailable}</p>
    </details>
  </section>;
}
