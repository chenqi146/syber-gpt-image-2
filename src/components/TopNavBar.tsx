import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { AccountInfo, formatBalance, getAccount, logoutAccount } from '../api';
import { useAuth } from '../auth';
import AvatarBadge from './AvatarBadge';

export default function TopNavBar() {
  const location = useLocation();
  const { viewer, refresh } = useAuth();
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    getAccount().then(setAccount).catch(() => setAccount(null));
  }, [viewer?.owner_id]);

  async function handleLogout() {
    try {
      await logoutAccount();
    } finally {
      await refresh();
      const refreshed = await getAccount().catch(() => null);
      setAccount(refreshed);
      window.location.href = '/';
    }
  }

  const viewerLabel = viewer?.authenticated
    ? (viewer.user?.username || viewer.user?.email || 'USER')
    : `Guest ${viewer?.guest_id?.slice(0, 8) || '--'}`;

  return (
    <header className="fixed top-0 left-0 w-full z-[100] flex justify-between items-center px-6 h-16 bg-surface-bright border-b border-primary/30 shadow-[0_0_20px_rgba(0,243,255,0.1)] shrink-0 font-mono">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-background rotate-45"></div>
          </div>
          <Link to="/" className="text-2xl font-black italic tracking-tighter text-white hover:text-primary transition-colors">
            CYBER<span className="text-secondary">GEN</span>
          </Link>
        </div>
        <nav className="hidden md:flex gap-6">
          <Link
            to="/history"
            className={`text-xs uppercase tracking-widest font-bold px-3 py-2 transition-all duration-300 hover:bg-primary/10 hover:text-primary ${
              location.pathname === '/history' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant'
            }`}
          >
            History
          </Link>
          {!viewer?.authenticated && (
            <Link
              to="/register"
              className={`text-xs uppercase tracking-widest font-bold px-3 py-2 transition-all duration-300 hover:bg-primary/10 hover:text-primary ${
                location.pathname === '/register' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant'
              }`}
            >
              Register
            </Link>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-on-surface-variant">Owner</span>
            <span className="text-xs text-tertiary">{viewerLabel}</span>
          </div>
          <div className="h-10 px-4 bg-surface-container-highest border border-primary/20 flex items-center gap-3 rounded-tr-xl">
            <span className="text-xs uppercase text-on-surface-variant">Credits</span>
            <span className="font-bold text-lg text-secondary">⚡ {formatBalance(account?.balance)}</span>
            <Link to="/billing" className="ml-2 px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase hover:bg-secondary/80 transition-colors shadow-[0_0_10px_rgba(255,0,255,0.3)]">
              Ledger
            </Link>
          </div>
        </div>

        {viewer?.authenticated ? (
          <button
            className="h-10 px-4 border border-secondary/40 text-secondary text-[10px] uppercase tracking-widest hover:bg-secondary/10 transition-colors flex items-center gap-2"
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={14} />
            Logout
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Link className="h-10 px-4 border border-primary/30 text-primary text-[10px] uppercase tracking-widest hover:bg-primary/10 transition-colors flex items-center" to="/login">
              Login
            </Link>
            <Link className="h-10 px-4 bg-secondary text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center" to="/register">
              Register
            </Link>
          </div>
        )}

        <Link to="/config" className="cursor-pointer hover:border-primary transition-colors shadow-[0_0_8px_rgba(255,0,255,0.2)]">
          <AvatarBadge
            className="w-10 h-10 rounded-full border-2"
            textClassName="text-xs"
            name={viewer?.user?.username}
            email={viewer?.user?.email}
            guestId={viewer?.guest_id}
          />
        </Link>
      </div>
    </header>
  );
}
