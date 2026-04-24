import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, EyeOff, Loader2, PlugZap, Save, Server, ShieldAlert } from 'lucide-react';
import {
  AccountInfo,
  AppConfig,
  InspirationStats,
  LedgerEntry,
  formatBalance,
  formatDate,
  getAccount,
  getConfig,
  getInspirationStats,
  getLedger,
  saveConfig,
  syncInspirations,
  testConfig,
} from '../api';
import { useAuth } from '../auth';
import AvatarBadge from '../components/AvatarBadge';

export default function Config() {
  const { viewer } = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [inspirationStats, setInspirationStats] = useState<InspirationStats | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [configData, accountData, ledgerData, inspirationData] = await Promise.all([
      getConfig(),
      getAccount(),
      getLedger(8),
      getInspirationStats(),
    ]);
    setConfig(configData);
    setAccount(accountData);
    setLedger(ledgerData.items);
    setInspirationStats(inspirationData);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [viewer?.owner_id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const updated = await saveConfig({
        model: config.model,
        default_size: config.default_size,
        default_quality: config.default_quality,
        user_name: config.managed_by_auth ? undefined : config.user_name,
        api_key: config.api_key_editable ? apiKey.trim() || undefined : undefined,
      });
      setConfig(updated);
      setApiKey('');
      await refresh();
      setStatus('CONFIG SAVED');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await testConfig();
      setStatus(`CONNECTED: ${result.models.slice(0, 3).join(', ') || 'MODELS OK'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncInspirations() {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await syncInspirations();
      await refresh();
      setStatus(`SYNCED ${result.parsed} CASES`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetKey() {
    if (!config?.managed_by_auth) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const updated = await saveConfig({ clear_api_key: true });
      setConfig(updated);
      setApiKey('');
      await refresh();
      setStatus('RESTORED MANAGED KEY');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="md:ml-64 px-6 md:px-12 py-8 max-w-[1440px] mx-auto min-h-screen pt-24 pb-12 bg-[radial-gradient(ellipse_at_top,var(--color-surface-container-high),var(--color-background))] font-mono">
      <section className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-12">
        <div className="w-24 h-24 border border-secondary relative bg-black p-1 shadow-[0_0_15px_rgba(255,0,255,0.2)]">
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-secondary"></div>
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-secondary"></div>
          <AvatarBadge
            className="w-full h-full"
            textClassName="text-2xl"
            name={viewer?.user?.username || config?.user_name}
            email={viewer?.user?.email}
            guestId={viewer?.guest_id}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-secondary uppercase font-bold tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-secondary"></span> Owner Profile
          </div>
          <h1 className="text-3xl md:text-5xl text-on-surface font-bold">{config?.user_name || 'NEON_USER_404'}</h1>
          <div className="flex items-center gap-4 text-xs mt-2 border border-white/10 bg-white/5 py-1 px-3 w-fit">
            <span className="text-white/50 uppercase">
              Mode:{' '}
              <span className={config?.managed_by_auth ? 'text-tertiary' : 'text-primary'}>
                {config?.managed_by_auth ? 'Sub2API User' : 'Guest'}
              </span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-primary uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> Balance: {formatBalance(account?.balance)}
            </span>
          </div>
        </div>
      </section>

      {(error || status) && (
        <div className={`mb-6 border p-4 text-xs ${error ? 'border-error/40 bg-error/10 text-error' : 'border-tertiary/40 bg-tertiary/10 text-tertiary'}`}>
          {error || status}
        </div>
      )}

      {!config?.managed_by_auth && (
        <div className="mb-6 border border-primary/20 bg-primary/5 p-4 text-xs text-white/60 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>Guest sessions use manual Sub2API API keys. Register or sign in to bind a per-user key automatically.</div>
          <div className="flex gap-3">
            <Link className="border border-primary/40 px-4 py-2 text-primary uppercase tracking-widest hover:bg-primary/10" to="/login">
              Sign In
            </Link>
            <Link className="border border-secondary/40 px-4 py-2 text-secondary uppercase tracking-widest hover:bg-secondary/10" to="/register">
              Register
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-black border border-primary/20 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-[9px] text-primary/40 uppercase border-b border-l border-primary/20 bg-primary/5">Owner_CFG</div>

          <h2 className="text-xl text-primary mb-8 uppercase flex items-center gap-3 font-bold border-b border-primary/20 pb-4">
            <Server className="text-primary" size={20} />
            Runtime Binding
          </h2>

          <div className="bg-primary/5 border border-primary/20 border-l-2 border-l-tertiary p-5 mb-8 flex gap-4 relative">
            <ShieldAlert className="text-tertiary mt-1 shrink-0" size={20} />
            <div>
              <h3 className="text-white mb-1 font-bold tracking-widest text-[10px] uppercase">
                {config?.managed_by_auth ? 'Managed Account Session' : 'Guest Session'}
              </h3>
              <p className="text-white/50 text-xs leading-relaxed">
                {config?.managed_by_auth
                  ? 'This config is attached to the signed-in Sub2API user. The personal API key is selected automatically, and you can override it with a shared or welfare key when needed.'
                  : 'Guest mode keeps data isolated by guest cookie. This mode uses a manually saved Sub2API API key, and the backend routes requests to the internal image service.'}
              </p>
            </div>
          </div>

          <div className="bg-secondary/5 border border-secondary/20 p-4 mb-8 text-xs text-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-secondary uppercase tracking-widest text-[10px] mb-1">Prompt Case Source</div>
              <div>{inspirationStats?.total ?? 0} cases synced · last {formatDate(inspirationStats?.last_synced_at)}</div>
            </div>
            <button
              className="border border-secondary/40 text-secondary px-4 py-2 uppercase tracking-widest hover:bg-secondary/10 transition-colors disabled:opacity-50"
              type="button"
              onClick={handleSyncInspirations}
              disabled={saving}
            >
              SYNC CASES
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Field label="USER_NAME">
              <input
                className="input-cyber"
                disabled={config?.managed_by_auth}
                value={config?.user_name || ''}
                onChange={(event) => setConfig((current) => current && { ...current, user_name: event.target.value })}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="MODEL">
                <input className="input-cyber" value={config?.model || 'gpt-image-2'} onChange={(event) => setConfig((current) => current && { ...current, model: event.target.value })} />
              </Field>
              <Field label="SIZE">
                <select className="input-cyber" value={config?.default_size || '1024x1024'} onChange={(event) => setConfig((current) => current && { ...current, default_size: event.target.value })}>
                  <option>1024x1024</option>
                  <option>1024x1536</option>
                  <option>1536x1024</option>
                  <option>auto</option>
                </select>
              </Field>
              <Field label="QUALITY">
                <select className="input-cyber" value={config?.default_quality || 'medium'} onChange={(event) => setConfig((current) => current && { ...current, default_quality: event.target.value })}>
                  <option>low</option>
                  <option>medium</option>
                  <option>high</option>
                  <option>auto</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-col gap-2 relative">
              <label className="text-secondary text-[10px] uppercase tracking-widest font-bold mb-1" htmlFor="api_key">SUB2API_KEY</label>
              <div className="relative">
                <input
                  className="input-cyber pr-12"
                  id="api_key"
                  placeholder={config?.api_key_set ? config.api_key_hint : 'sk-...'}
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-secondary transition-colors" type="button">
                  <EyeOff size={16} />
                </button>
              </div>
              <span className="text-[9px] text-white/30 text-right uppercase">
                Saved key: {config?.api_key_set ? config.api_key_hint : 'NONE'}{' '}
                {config?.api_key_source === 'managed'
                  ? '(managed)'
                  : config?.api_key_source === 'manual_override'
                    ? '(manual override)'
                    : '(manual)'}
              </span>
              {config?.managed_by_auth && config?.api_key_source === 'manual_override' && (
                <button
                  className="self-end text-[10px] uppercase tracking-widest text-secondary hover:text-white transition-colors"
                  type="button"
                  onClick={handleResetKey}
                >
                  Restore managed key
                </button>
              )}
            </div>

            <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-end border-t border-white/10 mt-4">
              <button
                className="border border-primary/30 text-primary font-bold px-8 py-3 uppercase tracking-widest hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 text-xs"
                type="button"
                onClick={handleTest}
                disabled={saving}
              >
                <PlugZap size={14} />
                TEST LINK
              </button>
              <button
                className="bg-secondary text-white font-bold px-8 py-3 uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2 text-xs shadow-[0_0_15px_rgba(255,0,255,0.3)] disabled:opacity-50"
                type="submit"
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                SAVE CONFIG
              </button>
            </div>
          </form>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-black border border-white/10 p-6 relative flex-1">
            <h3 className="text-primary mb-6 uppercase flex items-center gap-2 font-bold tracking-wider text-[10px] border-b border-primary/20 pb-4">
              <Activity size={16} />
              Consumption Matrix
            </h3>

            <div className="flex flex-col gap-0 text-xs">
              {ledger.length === 0 && <div className="py-6 text-white/40 uppercase">NO LOCAL LEDGER</div>}
              {ledger.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-3 border-b border-white/5">
                  <div className="flex flex-col">
                    <span className="text-white">{item.description}</span>
                    <span className="text-[9px] text-white/40 mt-1 uppercase">{formatDate(item.created_at)}</span>
                  </div>
                  <span className="text-secondary">{item.amount.toFixed(4)} {item.currency}</span>
                </div>
              ))}
            </div>

            <Link to="/billing" className="w-full mt-6 py-2 border border-primary/30 text-primary text-[10px] uppercase tracking-widest hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
              VIEW FULL LEDGER <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
