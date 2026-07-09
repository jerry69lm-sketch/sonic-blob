import { useRef } from "react";
import { useApp } from "../context/AppContext";

export function SensorPage() {
  const {
    canvasRef,
    overlayRef,
    mode,
    setMode,
    running,
    webcamStatus,
    facing,
    imageName,
    log,
    engageToggle,
    selectCamera,
    onFileChosen,
    saveSequence,
  } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sensor-page">
      <div className="mode-tabs">
        <button className={`mode-tab ${mode === "live" ? "active" : ""}`} onClick={() => setMode("live")}>
          LIVE SENSOR
        </button>
        <button className={`mode-tab ${mode === "static" ? "active" : ""}`} onClick={() => setMode("static")}>
          STATIC UPLOAD
        </button>
      </div>

      <div className="stage">
        <canvas ref={canvasRef} className="gl-canvas" />
        <canvas ref={overlayRef} className="overlay-canvas" />
        {mode === "static" && !imageName && (
          <button className="upload-hint" onClick={() => fileInputRef.current?.click()}>
            TAP TO UPLOAD IMAGE
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChosen(f);
        }}
      />

      <div className="terminal">
        {log.map((line, i) => (
          <div key={i} className="terminal-line">
            &gt; {line}
          </div>
        ))}
      </div>

      {mode === "live" ? (
        <div className="cam-row">
          <button
            className={`cam-btn ${facing === "user" && webcamStatus === "ready" ? "active" : ""}`}
            disabled={webcamStatus === "requesting"}
            onClick={() => selectCamera("user")}
          >
            FRONT CAM
          </button>
          <button
            className={`cam-btn ${facing === "environment" && webcamStatus === "ready" ? "active" : ""}`}
            disabled={webcamStatus === "requesting"}
            onClick={() => selectCamera("environment")}
          >
            REAR CAM
          </button>
        </div>
      ) : (
        <div className="cam-row">
          <button className="cam-btn" onClick={() => fileInputRef.current?.click()}>
            {imageName ? imageName.toUpperCase() : "CHOOSE IMAGE"}
          </button>
        </div>
      )}

      <button className="engage-btn" disabled={webcamStatus === "requesting"} onClick={engageToggle}>
        {webcamStatus === "requesting"
          ? "|| CONNECTING... ||"
          : running
            ? "|| DISENGAGE_SEQUENCER ||"
            : "|| ENGAGE_SEQUENCER ||"}
      </button>

      <button className="save-btn" onClick={saveSequence}>
        [ SAVE_SEQUENCE ]
      </button>
    </div>
  );
}
