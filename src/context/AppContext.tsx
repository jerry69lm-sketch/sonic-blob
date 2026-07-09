import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebcam, type FacingMode } from "../webcam/useWebcam";
import { VisualEngine } from "../gl/VisualEngine";
import { AudioEngine } from "../audio/AudioEngine";
import { presets } from "../audio/presets";
import { emptyAnalysis, type AnalysisState } from "../analysis/types";
import { defaultMusicParams, SCALE_NAMES, NOTE_NAMES } from "../audio/scales";

export type Mode = "live" | "static";
export type TabId = "sensor" | "params" | "library";

export interface LibraryEntry {
  id: string;
  name: string;
  presetId: string;
  bpm: number;
  rootNote: string;
  scaleName: string;
  savedAt: string;
}

const LIBRARY_KEY = "sonic-blob-library";
const MAX_LOG = 6;

function loadLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? (JSON.parse(raw) as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

interface Ctx {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;

  tab: TabId;
  setTab: (t: TabId) => void;
  mode: Mode;
  setMode: (m: Mode) => void;

  running: boolean;
  webcamStatus: string;
  webcamError: string | null;
  facing: FacingMode;
  imageName: string | null;

  presetId: string;
  bpm: number;
  rootNote: string;
  scaleName: string;
  scaleNames: string[];
  noteNames: string[];
  stats: AnalysisState;
  log: string[];
  library: LibraryEntry[];

  engageToggle: () => void;
  selectCamera: (f: FacingMode) => void;
  selectPreset: (id: string) => void;
  setBpm: (n: number) => void;
  setRootNote: (n: string) => void;
  setScaleName: (n: string) => void;
  onFileChosen: (file: File) => void;
  saveSequence: () => void;
  loadSequence: (id: string) => void;
  deleteSequence: (id: string) => void;
  presetsList: typeof presets;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { videoRef, status: webcamStatus, error: webcamError, facing, start: startWebcam, switchCamera } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VisualEngine | null>(null);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [tab, setTab] = useState<TabId>("sensor");
  const [mode, setModeState] = useState<Mode>("live");
  const [running, setRunning] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);
  const [presetId, setPresetId] = useState(presets[0].id);
  const [bpm, setBpmState] = useState(presets[0].bpm);
  const [rootNote, setRootNote] = useState(defaultMusicParams.rootNote);
  const [scaleName, setScaleName] = useState(defaultMusicParams.scaleName);
  const [stats, setStats] = useState<AnalysisState>(emptyAnalysis);
  const [log, setLog] = useState<string[]>(["SYSTEM_INITIALIZED", "WAITING_FOR_INPUT..."]);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => loadLibrary());

  const lastStatsUpdate = useRef(0);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), msg]);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;
    const engine = new VisualEngine(canvasRef.current, overlayRef.current);
    engineRef.current = engine;
    engine.onAnalysis((a) => {
      audioRef.current.updateAnalysis(a);
      const now = performance.now();
      if (now - lastStatsUpdate.current > 200) {
        lastStatsUpdate.current = now;
        setStats(a);
      }
    });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) engine.resize(width, height);
      }
    });
    const stageEl = canvasRef.current.parentElement;
    if (stageEl) ro.observe(stageEl);

    return () => {
      ro.disconnect();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    audioRef.current.updateMusicParams({ rootNote, scaleName });
  }, [rootNote, scaleName]);

  useEffect(() => {
    if (webcamStatus === "ready" && videoRef.current) {
      engineRef.current?.setSource(videoRef.current, facing === "user");
    }
  }, [webcamStatus, facing, videoRef]);

  const engaging = useRef(false);

  const engage = useCallback(async () => {
    if (engaging.current) return;
    engaging.current = true;
    try {
      const preset = presets.find((p) => p.id === presetId)!;
      if (mode === "live" && webcamStatus !== "ready") {
        addLog("REQUESTING_CAMERA_ACCESS...");
        const ok = await startWebcam(facing);
        if (!ok) {
          addLog("ERR: CAMERA_ACCESS_DENIED");
          return;
        }
        addLog("CAMERA_ACCESS_GRANTED");
      }
      if (mode === "static" && !imgRef.current) {
        addLog("ERR: NO_IMAGE_LOADED");
        return;
      }
      await audioRef.current.start();
      audioRef.current.setBpm(bpm);
      audioRef.current.setPreset(preset);
      addLog(`SEQUENCER_ENGAGED @ ${preset.label.toUpperCase()} ${bpm}BPM`);
      setRunning(true);
    } finally {
      engaging.current = false;
    }
  }, [mode, webcamStatus, presetId, bpm, facing, startWebcam, addLog]);

  const disengage = useCallback(() => {
    audioRef.current.stop();
    addLog("SEQUENCER_STOPPED");
    setRunning(false);
  }, [addLog]);

  const engageToggle = useCallback(() => {
    if (running) disengage();
    else void engage();
  }, [running, engage, disengage]);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      addLog(m === "live" ? "MODE: LIVE_SENSOR" : "MODE: STATIC_UPLOAD");
    },
    [addLog],
  );

  const selectCamera = useCallback(
    async (f: FacingMode) => {
      addLog(`SWITCHING_CAMERA: ${f === "user" ? "FRONT" : "REAR"}...`);
      await switchCamera(f);
    },
    [switchCamera, addLog],
  );

  const selectPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset || !preset.enabled) return;
      setPresetId(id);
      setBpmState(preset.bpm);
      if (running) {
        audioRef.current.setPreset(preset);
        addLog(`PRESET: ${preset.label.toUpperCase()}`);
      }
    },
    [running, addLog],
  );

  const setBpm = useCallback((n: number) => {
    setBpmState(n);
    audioRef.current.setBpm(n);
  }, []);

  const onFileChosen = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      if (!imgRef.current) imgRef.current = new Image();
      const img = imgRef.current;
      img.onload = () => {
        engineRef.current?.setSource(img, false);
        URL.revokeObjectURL(url);
        setImageName(file.name);
        addLog(`IMAGE_LOADED: ${file.name.toUpperCase()}`);
      };
      img.src = url;
    },
    [addLog],
  );

  const saveSequence = useCallback(() => {
    const entry: LibraryEntry = {
      id: `${Date.now()}`,
      name: `SEQ_${String(library.length + 1).padStart(3, "0")}`,
      presetId,
      bpm,
      rootNote,
      scaleName,
      savedAt: new Date().toISOString(),
    };
    const next = [...library, entry];
    setLibrary(next);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    addLog(`SEQUENCE_SAVED: ${entry.name}`);
  }, [library, presetId, bpm, rootNote, scaleName, addLog]);

  const loadSequence = useCallback(
    (id: string) => {
      const entry = library.find((e) => e.id === id);
      if (!entry) return;
      selectPreset(entry.presetId);
      setBpm(entry.bpm);
      setRootNote(entry.rootNote);
      setScaleName(entry.scaleName);
      addLog(`SEQUENCE_LOADED: ${entry.name}`);
    },
    [library, selectPreset, setBpm, addLog],
  );

  const deleteSequence = useCallback(
    (id: string) => {
      const next = library.filter((e) => e.id !== id);
      setLibrary(next);
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    },
    [library],
  );

  const value = useMemo<Ctx>(
    () => ({
      canvasRef,
      overlayRef,
      tab,
      setTab,
      mode,
      setMode,
      running,
      webcamStatus,
      webcamError,
      facing,
      imageName,
      presetId,
      bpm,
      rootNote,
      scaleName,
      scaleNames: SCALE_NAMES,
      noteNames: NOTE_NAMES,
      stats,
      log,
      library,
      engageToggle,
      selectCamera,
      selectPreset,
      setBpm,
      setRootNote,
      setScaleName,
      onFileChosen,
      saveSequence,
      loadSequence,
      deleteSequence,
      presetsList: presets,
    }),
    [
      tab,
      mode,
      setMode,
      running,
      webcamStatus,
      webcamError,
      facing,
      imageName,
      presetId,
      bpm,
      rootNote,
      scaleName,
      stats,
      log,
      library,
      engageToggle,
      selectCamera,
      selectPreset,
      setBpm,
      onFileChosen,
      saveSequence,
      loadSequence,
      deleteSequence,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
