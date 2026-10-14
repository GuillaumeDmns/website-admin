import { NavLink, Outlet, ScrollRestoration } from "react-router-dom";

import { useSession } from "../auth/sessionContext";
import { apiUrl } from "../config";
import { useRefresh } from "../data";
import styles from "./Layout.module.css";

const navigation = [
  { to: "/", label: "Vue d'ensemble", end: true },
  { to: "/audience", label: "Audience" },
  { to: "/usage", label: "Quotas PRIM" },
  { to: "/api", label: "API" },
  { to: "/accounts", label: "Comptes" },
  { to: "/network", label: "Réseau" },
  { to: "/system", label: "Système" },
  { to: "/actions", label: "Actions" },
];

export default function Layout() {
  const { signOut } = useSession();
  const { auto, setAuto, refreshNow } = useRefresh();
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#content">
        Aller au contenu
      </a>
      <header className={styles.header}>
        <NavLink to="/" className={styles.name}>
          Administration
        </NavLink>
        <div className={styles.tools}>
          <label className={styles.auto}>
            <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
            Actualiser chaque minute
          </label>
          <button type="button" className={styles.tool} onClick={refreshNow}>
            Actualiser
          </button>
          <button type="button" className={styles.tool} onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </div>
        <nav aria-label="Navigation principale" className={styles.navBar}>
          <ul className={styles.nav}>
            {navigation.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="content" className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>Statistiques anonymes : des comptes, jamais une personne.</span>
        <span>API : {new URL(apiUrl).host}</span>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
