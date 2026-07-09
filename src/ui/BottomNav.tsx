import type { ComponentType } from "react";
import { EyeIcon, SlidersIcon, FolderIcon } from "./icons";
import { useApp, type TabId } from "../context/AppContext";

const TABS: Array<{ id: TabId; label: string; Icon: ComponentType<{ size?: number }> }> = [
  { id: "sensor", label: "SENSOR", Icon: EyeIcon },
  { id: "params", label: "PARAMS", Icon: SlidersIcon },
  { id: "library", label: "LIBRARY", Icon: FolderIcon },
];

export function BottomNav() {
  const { tab, setTab } = useApp();
  return (
    <nav className="bottom-nav">
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} className={`nav-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
