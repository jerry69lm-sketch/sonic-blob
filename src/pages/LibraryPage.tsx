import { useApp } from "../context/AppContext";

export function LibraryPage() {
  const { library, loadSequence, deleteSequence } = useApp();
  return (
    <div className="library-page">
      <h2>[ SAVED_SEQUENCES ]</h2>
      {library.length === 0 && <p className="empty-hint">NO SEQUENCES SAVED YET</p>}
      <ul className="library-list">
        {library.map((entry) => (
          <li key={entry.id} className="library-item">
            <div className="library-meta">
              <span className="library-name">{entry.name}</span>
              <span className="library-detail">
                {entry.presetId.toUpperCase()} · {entry.bpm}BPM · {entry.rootNote} {entry.scaleName}
              </span>
            </div>
            <div className="library-actions">
              <button onClick={() => loadSequence(entry.id)}>LOAD</button>
              <button onClick={() => deleteSequence(entry.id)}>DEL</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
