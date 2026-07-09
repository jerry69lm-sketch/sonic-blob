import { useApp } from "../context/AppContext";

export function ParamsPage() {
  const {
    presetsList,
    presetId,
    selectPreset,
    bpm,
    setBpm,
    rootNote,
    setRootNote,
    scaleName,
    setScaleName,
    scaleNames,
    noteNames,
  } = useApp();

  return (
    <div className="params-page">
      <h2>[ PRESET ]</h2>
      <div className="preset-grid">
        {presetsList.map((p) => (
          <button
            key={p.id}
            className={`preset-btn ${p.id === presetId ? "active" : ""} ${!p.enabled ? "disabled" : ""}`}
            disabled={!p.enabled}
            title={p.description}
            onClick={() => selectPreset(p.id)}
          >
            {p.label}
            {!p.enabled && <span className="soon">soon</span>}
          </button>
        ))}
      </div>

      <h2>[ BPM ]</h2>
      <div className="bpm-control">
        <input
          type="range"
          min={60}
          max={190}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
        />
        <span className="bpm-value">{bpm}</span>
      </div>

      <h2>[ KEY ]</h2>
      <div className="key-control">
        <select value={rootNote} onChange={(e) => setRootNote(e.target.value)}>
          {noteNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={scaleName} onChange={(e) => setScaleName(e.target.value)}>
          {scaleNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
