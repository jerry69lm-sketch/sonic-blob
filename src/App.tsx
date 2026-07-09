import { AppProvider, useApp } from "./context/AppContext";
import { Header } from "./ui/Header";
import { BottomNav } from "./ui/BottomNav";
import { SensorPage } from "./pages/SensorPage";
import { ParamsPage } from "./pages/ParamsPage";
import { LibraryPage } from "./pages/LibraryPage";
import "./App.css";

function Shell() {
  const { tab, stats, bpm } = useApp();

  return (
    <div className="app">
      <Header />

      <main className="main">
        <div className={`page ${tab === "sensor" ? "active" : ""}`}>
          <SensorPage />
        </div>
        <div className={`page ${tab === "params" ? "active" : ""}`}>
          <ParamsPage />
        </div>
        <div className={`page ${tab === "library" ? "active" : ""}`}>
          <LibraryPage />
        </div>
      </main>

      <div className="stats">
        <span>bpm {bpm}</span>
        <span>blobs {stats.blobs.length.toString().padStart(2, "0")}</span>
        <span>edge {(stats.edgeDensity * 100).toFixed(0)}%</span>
        <span>bright {(stats.brightness * 100).toFixed(0)}%</span>
      </div>

      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

export default App;
