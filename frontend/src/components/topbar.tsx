import { useRouter } from "next/router";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { isAdminRole } from "@/components/requireAdmin";
import { ThemeToggle } from "@/components/ui";

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/apps", label: "Apps" },
  { href: "/domains", label: "Domains" },
  { href: "/billing", label: "Billing", adminOnly: true },
  { href: "/nodes", label: "Nodes", adminOnly: true },
  { href: "/repos", label: "Repos", adminOnly: true },
  { href: "/admin", label: "Admin", adminOnly: true },
];

// The app's primary nav chrome, matching redesign-and-blend/console.js's
// mountShell layout (brand + nav + tools) -- replaced the old left sidebar.
export function TopBar({ onLogout, onLogoutAll }: { onLogout: () => void; onLogoutAll: () => void }) {
  const router = useRouter();
  const { username, email, role } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-in px-4 sm:px-6 lg:px-8">
        <a className="brand" href="/apps" aria-label="Artisan Hosting, apps">
          <img
            src="/imgs/artisan-studios__lockup__dark__2048w.webp"
            alt="Artisan Hosting"
            className="h-7 w-auto max-w-full dark:hidden"
          />
          <img
            src="/imgs/artisan-studios__lockup__light__2048w.webp"
            alt="Artisan Hosting"
            className="hidden h-7 w-auto max-w-full dark:block"
          />
        </a>

        <nav className="nav" aria-label="Main">
          {NAV.filter((item) => !item.adminOnly || isAdminRole(role)).map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
              }}
              aria-current={router.pathname.startsWith(item.href) ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="tools">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="icon-btn"
              style={{ borderRadius: "999px", overflow: "hidden" }}
              aria-label="Account menu"
            >
              <img
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username || "placeholder")}`}
                alt=""
                className="w-full h-full"
              />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 panel z-50 text-sm">
                <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--line)" }}>
                  <p className="font-semibold truncate" style={{ color: "var(--strong)" }}>{username}</p>
                  <p className="truncate" style={{ color: "var(--muted)" }}>{email}</p>
                </div>
                <button
                  onClick={() => { router.push('/account'); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 hover:bg-[color:var(--surface-2)]"
                >
                  Account
                </button>
                <button
                  onClick={() => { onLogout(); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 hover:bg-[color:var(--surface-2)]"
                  style={{ color: "var(--bad)" }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
