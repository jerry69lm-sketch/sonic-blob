import { HamburgerIcon, GearIcon } from "./icons";
import { useApp } from "../context/AppContext";

export function Header() {
  const { setTab } = useApp();
  return (
    <header className="app-header">
      <button className="icon-btn" aria-label="menu">
        <HamburgerIcon />
      </button>
      <h1>[ SONIC_BLOB ]</h1>
      <button className="icon-btn" aria-label="settings" onClick={() => setTab("params")}>
        <GearIcon />
      </button>
    </header>
  );
}
