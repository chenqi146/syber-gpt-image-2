import { useEffect, useState } from 'react';
import { Activity, Database, Server, UserCircle } from 'lucide-react';
import { AccountInfo, formatBalance, formatDate, getAccount } from '../api';
import { useAuth } from '../auth';
import AvatarBadge from '../components/AvatarBadge';

export default function Account() {
  const { viewer } = useAuth();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAccount().then(setAccount).catch((err) => setError(err.message));
  }, [viewer?.owner_id]);

  return (
    <div className="md:ml-64 px-6 md:px-12 py-8 max-w-[1440px] mx-auto min-h-screen pt-24 pb-12 bg-[radial-gradient(ellipse_at_top,var(--color-surface-container-high),var(--color-background))] font-mono">
      <div className="flex flex-col gap-2 mb-10 border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 text-[10px] text-secondary uppercase font-bold tracking-widest">
          <span className="w-4 h-[1px] bg-secondary"></span> Personal System
        </div>
        <h1 className="text-4xl md:text-5xl text-on-surface font-bold tracking-tighter">ACCOUNT_</h1>
      </div>

      {error && <div className="mb-6 border border-error/40 bg-error/10 p-4 text-error text-xs">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <section className="lg:col-span-2 bg-black border border-primary/20 p-6">
          <h2 className="text-primary mb-6 uppercase flex items-center gap-2 font-bold tracking-wider text-xs">
            <UserCircle size={18} /> Identity
          </h2>
          <div className="mb-6 flex items-center gap-4">
            <AvatarBadge
              className="w-16 h-16"
              textClassName="text-lg"
              name={account?.user.username || account?.user.name}
              email={account?.user.email}
              guestId={account?.viewer.guest_id}
            />
            <div className="min-w-0">
              <div className="text-lg text-white font-bold truncate">{account?.user.username || account?.user.name || 'Guest'}</div>
              <div className="text-xs text-white/45 break-all">{account?.user.email || account?.viewer.owner_id || '--'}</div>
            </div>
          </div>
          <div className="space-y-4 text-sm">
            <Row label="OWNER" value={account?.user.authenticated ? 'REGISTERED USER' : 'GUEST SESSION'} />
            <Row label="USER" value={account?.user.name || '--'} />
            <Row label="SUB2API USERNAME" value={account?.user.username || '--'} />
            <Row label="EMAIL" value={account?.user.email || '--'} />
            <Row label="MODEL" value={account?.user.model || 'gpt-image-2'} />
            <Row
              label="API KEY"
              value={account?.user.api_key_set
                ? account?.user.api_key_source === 'managed'
                  ? 'BOUND TO SUB2API USER'
                  : account?.user.api_key_source === 'manual_override'
                    ? 'MANUAL OVERRIDE KEY'
                    : 'MANUAL GUEST KEY'
                : 'MISSING'}
            />
          </div>
        </section>

        <Metric icon={Activity} label="BALANCE" value={formatBalance(account?.balance)} sub={account?.balance.ok ? 'Sub2API /v1/usage' : account?.balance.message || 'Not connected'} />
        <Metric icon={Database} label="HISTORY" value={String(account?.stats.total ?? 0)} sub={`${account?.stats.succeeded ?? 0} succeeded`} />
        <Metric icon={Server} label="EDITS" value={String(account?.stats.edits ?? 0)} sub={`Last: ${formatDate(account?.stats.last_generation_at)}`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
      <span className="text-[10px] text-white/40 uppercase tracking-widest">{label}</span>
      <span className="text-primary break-all">{value}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string; sub: string }) {
  return (
    <section className="bg-black border border-white/10 p-6 min-h-40">
      <div className="flex items-center gap-2 text-secondary text-[10px] uppercase tracking-widest mb-5">
        <Icon size={16} /> {label}
      </div>
      <div className="text-4xl text-white font-black tracking-tighter">{value}</div>
      <div className="mt-3 text-[10px] text-white/40 uppercase">{sub}</div>
    </section>
  );
}
