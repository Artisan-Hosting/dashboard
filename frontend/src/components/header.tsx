import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";

export function Sidebar({ onLogout, onLogoutAll }: { onLogout: () => void; onLogoutAll: () => void }) {
  const router = useRouter();
  // 1) Grab username + email from our custom hook:
  const { username, email: loadedEmail, isLoading, error } = useUser()

  // 2) Local state for the email-input field (so we can edit it):
  const [email, setEmail] = useState<string>('')
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && loadedEmail) {
      setEmail(loadedEmail)
    }
  }, [isLoading, loadedEmail])

  return (
    <>
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setOpen(!open)}
          className="text-white bg-brand-gradient p-2 rounded shadow"
          aria-label="Toggle sidebar"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={`bg-brand-gradient text-white p-6 shadow-xl flex flex-col lg:static fixed top-0 left-0 h-full w-64 z-40 transform transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          } lg:min-h-screen`}
      >
        <div className="relative mb-6">
          <div
            className="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/20 transition"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="flex items-center space-x-3">
              <img
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username || 'placeholder')}`}
                alt="Profile"
                className="w-12 h-12 rounded-full border border-brand"
              />
              <div className="max-w-full overflow-hidden">
                <div className="text-white text-sm font-semibold truncate">{username}</div>
                <div className="text-xs text-gray-300 break-all">{email}</div>
              </div>
            </div>
          </div>
          {menuOpen && (
            <div className="absolute left-0 mt-2 w-full bg-gray-900 rounded shadow-lg z-50 flex flex-col text-sm">
              <button onClick={() => { router.push('/account'); setMenuOpen(false); }} className="px-4 py-2 text-left hover:bg-gray-700">Account</button>
              <button onClick={() => { onLogout(); setMenuOpen(false); }} className="px-4 py-2 text-left text-red-400 hover:bg-gray-700">Logout</button>
            </div>
          )}
        </div>
        <nav className="flex flex-col space-y-4 text-gray-300 text-sm">
          <button onClick={() => router.push('/apps')} className="text-left hover:text-brand">Apps</button>
          <button onClick={() => router.push('/vms')} className="text-left hover:text-brand">Vms</button>
          <button onClick={() => router.push('/secrets')} className="text-left hover:text-brand">Secrets</button>
          <button onClick={() => router.push('/billing')} className="text-left hover:text-brand">Billing</button>
          <div className="mt-auto" />
        </nav>
      </aside>
    </>
  );
}
