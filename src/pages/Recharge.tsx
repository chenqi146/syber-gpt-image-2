import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CreditCard, ExternalLink, QrCode, RefreshCw, RotateCcw, ShieldCheck, Wallet, X } from 'lucide-react';
import {
  BalanceInfo,
  PaymentCheckoutInfo,
  PaymentCreateOrderResult,
  PaymentMethodLimit,
  PaymentOrder,
  cancelPaymentOrder,
  createPaymentOrder,
  formatBalance,
  formatDate,
  getBalance,
  getPaymentCheckoutInfo,
  getPaymentOrder,
  listPaymentOrders,
} from '../api';
import { useAuth } from '../auth';
import { useNotifier } from '../notifications';
import { useSite } from '../site';

const QUICK_AMOUNTS = [2, 5, 10, 20, 50, 100];
const PAYMENT_METHOD_ORDER = ['alipay', 'wxpay', 'alipay_direct', 'wxpay_direct', 'stripe', 'easypay'];
const FINISHED_STATUSES = new Set(['PAID', 'RECHARGING', 'COMPLETED']);
const FAILED_STATUSES = new Set(['EXPIRED', 'CANCELLED', 'FAILED']);

export default function Recharge() {
  const { viewer } = useAuth();
  const { siteSettings, t } = useSite();
  const { notifyError, notifyInfo, notifySuccess } = useNotifier();
  const [checkout, setCheckout] = useState<PaymentCheckoutInfo | null>(null);
  const [balance, setBalance] = useState<BalanceInfo>();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [amount, setAmount] = useState(10);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentCreateOrderResult | null>(null);
  const [pollingOrder, setPollingOrder] = useState<PaymentOrder | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rechargeUrl = siteSettings?.recharge_url || siteSettings?.upstream?.effective_recharge_url || 'https://ai.get-money.locker';

  const methods = useMemo(() => sortedMethods(checkout?.methods || {}), [checkout?.methods]);
  const selectedLimit = checkout?.methods[selectedMethod];
  const feeRate = selectedLimit?.fee_rate || 0;
  const feeAmount = amount > 0 && feeRate > 0 ? Math.ceil(((amount * feeRate) / 100) * 100) / 100 : 0;
  const payAmount = Math.round((amount + feeAmount) * 100) / 100;
  const amountError = getAmountError(amount, selectedLimit, methods);
  const canSubmit = Boolean(viewer?.authenticated && checkout && !checkout.balance_disabled && selectedMethod && amount > 0 && !amountError);

  async function refreshAll() {
    if (!viewer?.authenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [checkoutData, balanceData, orderData] = await Promise.all([
        getPaymentCheckoutInfo(),
        getBalance(),
        listPaymentOrders({ page: 1, page_size: 8 }),
      ]);
      setCheckout(checkoutData);
      setBalance(balanceData);
      setOrders(orderData.items || []);
      const available = sortedMethods(checkoutData.methods).find((item) => item.limit.available !== false);
      setSelectedMethod((current) => current || available?.type || '');
      const nextMin = checkoutData.global_min || 0;
      if (nextMin > 0 && amount < nextMin) {
        setAmount(nextMin);
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrders() {
    if (!viewer?.authenticated) {
      return;
    }
    setOrdersLoading(true);
    try {
      const data = await listPaymentOrders({ page: 1, page_size: 8 });
      setOrders(data.items || []);
    } catch (err) {
      notifyError(err);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch(notifyError);
  }, [viewer?.owner_id]);

  useEffect(() => {
    if (!paymentState?.qr_code || !qrCanvasRef.current) {
      return;
    }
    QRCode.toCanvas(qrCanvasRef.current, paymentState.qr_code, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    }).catch(notifyError);
  }, [paymentState?.qr_code, notifyError]);

  useEffect(() => {
    if (!paymentState?.order_id) {
      return;
    }
    let cancelled = false;
    let timer = 0;

    const poll = async () => {
      try {
        const order = await getPaymentOrder(paymentState.order_id);
        if (cancelled) {
          return;
        }
        setPollingOrder(order);
        if (FINISHED_STATUSES.has(order.status)) {
          window.clearInterval(timer);
          setPaymentState(null);
          notifySuccess(t('recharge_payment_success'));
          const [balanceData, orderData] = await Promise.all([getBalance(), listPaymentOrders({ page: 1, page_size: 8 })]);
          if (!cancelled) {
            setBalance(balanceData);
            setOrders(orderData.items || []);
          }
        } else if (FAILED_STATUSES.has(order.status)) {
          window.clearInterval(timer);
          notifyError(t('recharge_payment_failed'));
        }
      } catch (err) {
        notifyError(err);
      }
    };

    timer = window.setInterval(poll, 3000);
    poll().catch(notifyError);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paymentState?.order_id, notifyError, notifySuccess, t]);

  useEffect(() => {
    if (!paymentState?.expires_at) {
      setRemainingSeconds(0);
      return;
    }
    const tick = () => {
      const seconds = Math.max(0, Math.floor((new Date(paymentState.expires_at).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [paymentState?.expires_at]);

  async function handleSubmit() {
    if (!canSubmit || submitting) {
      if (!viewer?.authenticated) {
        notifyError(t('recharge_login_required'));
      }
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPaymentOrder({
        amount,
        payment_type: selectedMethod,
        order_type: 'balance',
      });
      setPaymentState(result);
      setPollingOrder(null);
      notifyInfo(t('recharge_order_created'));
      if (!result.qr_code && result.pay_url && isMobileDevice()) {
        window.location.href = result.pay_url;
      } else if (!result.qr_code && result.pay_url) {
        openPaymentWindow(result.pay_url);
      }
      refreshOrders().catch(notifyError);
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelPayment() {
    if (!paymentState?.order_id) {
      setPaymentState(null);
      return;
    }
    try {
      await cancelPaymentOrder(paymentState.order_id);
      setPaymentState(null);
      notifySuccess(t('recharge_order_cancelled'));
      refreshOrders().catch(notifyError);
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="md:ml-64 mx-auto min-h-screen max-w-[1440px] bg-[radial-gradient(ellipse_at_top,var(--color-surface-container-high),var(--color-background))] px-4 pb-12 pt-24 font-mono sm:px-6 md:px-12">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            <span className="h-[1px] w-4 bg-primary" />
            {t('recharge_tag')}
          </div>
          <h1 className="text-4xl font-bold tracking-tighter text-on-surface md:text-5xl">{t('recharge_title')}</h1>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-white/50">{t('recharge_desc')}</p>
        </div>
        <a
          className="inline-flex h-11 items-center justify-center gap-2 border border-secondary/40 px-5 text-xs font-bold uppercase tracking-widest text-secondary transition-colors hover:bg-secondary/10"
          href={rechargeUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t('recharge_open_external')}
          <ExternalLink size={14} />
        </a>
      </div>

      {!viewer?.authenticated ? (
        <section className="border border-primary/25 bg-primary/5 p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 text-primary" size={36} />
          <div className="text-xl font-bold text-white">{t('recharge_login_required')}</div>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">{t('recharge_login_desc')}</p>
        </section>
      ) : loading ? (
        <section className="grid min-h-[460px] place-items-center border border-primary/20 bg-black/20">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary">
            <RefreshCw className="animate-spin" size={16} />
            {t('recharge_loading')}
          </div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section className="border border-primary/20 bg-surface/70 p-5 backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('recharge_current_balance')}</div>
                <div className="mt-2 flex items-end gap-2">
                  <Wallet className="mb-1 text-secondary" size={22} />
                  <span className="text-4xl font-black tracking-tighter text-secondary">{formatBalance(balance)}</span>
                </div>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 border border-white/10 px-4 text-xs font-bold uppercase tracking-widest text-white/60 transition-colors hover:border-primary/40 hover:text-primary"
                type="button"
                onClick={() => refreshAll().catch(notifyError)}
              >
                <RotateCcw size={14} />
                {t('recharge_refresh')}
              </button>
            </div>

            {checkout?.balance_disabled ? (
              <div className="border border-error/30 bg-error/10 p-4 text-sm text-error">{t('recharge_balance_disabled')}</div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-secondary">{t('recharge_amount')}</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {QUICK_AMOUNTS.map((value) => (
                      <button
                        key={value}
                        className={`h-11 border text-sm font-bold transition-colors ${
                          amount === value
                            ? 'border-secondary bg-secondary/15 text-secondary'
                            : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-secondary/40 hover:text-secondary'
                        }`}
                        type="button"
                        onClick={() => setAmount(value)}
                      >
                        ${value}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="h-12 min-w-0 flex-1 border border-white/10 bg-black/30 px-4 text-base font-bold text-white outline-none transition-colors focus:border-primary/60"
                      min={checkout?.global_min || 0}
                      max={checkout?.global_max || undefined}
                      step="0.01"
                      type="number"
                      value={Number.isFinite(amount) ? amount : ''}
                      onChange={(event) => setAmount(Number(event.target.value))}
                    />
                    <div className="text-xs text-white/40">
                      {t('recharge_amount_range', {
                        min: checkout?.global_min || 0,
                        max: checkout?.global_max || t('recharge_no_limit'),
                      })}
                    </div>
                  </div>
                  {amountError ? <div className="mt-2 text-xs text-error">{amountError}</div> : null}
                </div>

                <div className="mb-6">
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-secondary">{t('recharge_method')}</label>
                  {methods.length === 0 ? (
                    <div className="border border-error/30 bg-error/10 p-4 text-sm text-error">{t('recharge_no_methods')}</div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {methods.map(({ type, limit }) => {
                        const available = limit.available !== false && methodFitsAmount(amount, limit);
                        return (
                          <button
                            key={type}
                            className={`min-h-[76px] border p-4 text-left transition-colors ${
                              !available
                                ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/25'
                                : selectedMethod === type
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-primary/40 hover:text-primary'
                            }`}
                            disabled={!available}
                            type="button"
                            onClick={() => setSelectedMethod(type)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold">{paymentMethodLabel(type)}</span>
                              <CreditCard size={16} />
                            </div>
                            <div className="mt-2 text-[11px] text-white/40">
                              {limit.fee_rate > 0 ? t('recharge_fee_rate', { value: limit.fee_rate }) : t('recharge_fee_free')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border border-white/10 bg-black/25 p-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <Summary label={t('recharge_summary_amount')} value={`$${amount > 0 ? amount.toFixed(2) : '0.00'}`} />
                    <Summary label={t('recharge_summary_fee')} value={`$${feeAmount.toFixed(2)}`} />
                    <Summary label={t('recharge_summary_pay')} value={`$${payAmount.toFixed(2)}`} highlight />
                  </div>
                  <button
                    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-secondary px-5 text-sm font-black uppercase tracking-widest text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!canSubmit || submitting}
                    type="button"
                    onClick={handleSubmit}
                  >
                    {submitting ? <RefreshCw className="animate-spin" size={16} /> : <QrCode size={16} />}
                    {submitting ? t('recharge_creating_order') : t('recharge_create_order')}
                  </button>
                </div>

                {checkout?.help_text ? <div className="mt-4 border border-primary/15 bg-primary/5 p-3 text-xs leading-6 text-white/50">{checkout.help_text}</div> : null}
              </>
            )}
          </section>

          <section className="border border-white/10 bg-surface/55 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('recharge_orders')}</div>
                <h2 className="mt-1 text-xl font-bold text-white">{t('recharge_recent_orders')}</h2>
              </div>
              <button
                className="flex h-9 w-9 items-center justify-center border border-white/10 text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
                type="button"
                onClick={refreshOrders}
                title={t('recharge_refresh')}
              >
                <RefreshCw className={ordersLoading ? 'animate-spin' : ''} size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="border border-white/10 bg-black/20 p-6 text-center text-sm text-white/40">{t('recharge_orders_empty')}</div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">#{order.id} · ${Number(order.amount || 0).toFixed(2)}</div>
                        <div className="mt-1 text-xs text-white/40">{paymentMethodLabel(order.payment_type)} · {formatDate(order.created_at)}</div>
                      </div>
                      <span className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${orderStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {paymentState ? (
        <div className="fixed inset-0 z-[170] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md border border-primary/30 bg-surface p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <button
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-white/10 text-white/55 transition-colors hover:border-error/40 hover:text-error"
              type="button"
              onClick={() => setPaymentState(null)}
              title={t('modal_close')}
            >
              <X size={15} />
            </button>
            <div className="pr-10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{t('recharge_pay_modal_tag')}</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{t('recharge_pay_modal_title')}</h2>
              <p className="mt-2 text-xs leading-6 text-white/50">
                {t('recharge_pay_modal_desc', { amount: Number(paymentState.pay_amount || payAmount).toFixed(2) })}
              </p>
            </div>

            <div className="mt-5 grid place-items-center border border-white/10 bg-black/30 p-5">
              {paymentState.qr_code ? (
                <div className="bg-white p-3">
                  <canvas ref={qrCanvasRef} />
                </div>
              ) : paymentState.pay_url ? (
                <a
                  className="inline-flex h-12 items-center justify-center gap-2 bg-secondary px-6 text-sm font-black uppercase tracking-widest text-black"
                  href={paymentState.pay_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t('recharge_open_pay')}
                  <ExternalLink size={16} />
                </a>
              ) : paymentState.client_secret ? (
                <div className="text-center text-sm leading-6 text-white/55">{t('recharge_stripe_hint')}</div>
              ) : (
                <div className="text-sm text-error">{t('recharge_missing_pay_info')}</div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Summary label={t('recharge_order_status')} value={pollingOrder?.status || paymentState.status || 'PENDING'} />
              <Summary label={t('recharge_order_countdown')} value={formatCountdown(remainingSeconds)} />
            </div>
            <button
              className="mt-4 h-11 w-full border border-white/10 text-xs font-bold uppercase tracking-widest text-white/55 transition-colors hover:border-error/40 hover:text-error"
              type="button"
              onClick={handleCancelPayment}
            >
              {t('recharge_cancel_order')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
      <div className={`mt-1 text-lg font-black ${highlight ? 'text-secondary' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function sortedMethods(methods: Record<string, PaymentMethodLimit>) {
  return Object.entries(methods)
    .map(([type, limit]) => ({ type, limit }))
    .sort((a, b) => {
      const left = PAYMENT_METHOD_ORDER.indexOf(a.type);
      const right = PAYMENT_METHOD_ORDER.indexOf(b.type);
      return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
    });
}

function getAmountError(amount: number, selectedLimit: PaymentMethodLimit | undefined, methods: { type: string; limit: PaymentMethodLimit }[]) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '请输入有效充值金额';
  }
  if (methods.length === 0) {
    return '';
  }
  if (!methods.some(({ limit }) => methodFitsAmount(amount, limit))) {
    return '当前金额没有可用支付方式';
  }
  if (selectedLimit) {
    if (selectedLimit.single_min > 0 && amount < selectedLimit.single_min) {
      return `当前支付方式最低充值 $${selectedLimit.single_min}`;
    }
    if (selectedLimit.single_max > 0 && amount > selectedLimit.single_max) {
      return `当前支付方式最高充值 $${selectedLimit.single_max}`;
    }
  }
  return '';
}

function methodFitsAmount(amount: number, limit: PaymentMethodLimit) {
  if (amount <= 0) return true;
  if (limit.single_min > 0 && amount < limit.single_min) return false;
  if (limit.single_max > 0 && amount > limit.single_max) return false;
  return true;
}

function paymentMethodLabel(type: string) {
  if (type.includes('alipay')) return '支付宝';
  if (type.includes('wxpay')) return '微信支付';
  if (type === 'stripe') return 'Stripe';
  if (type === 'easypay') return '易支付';
  return type;
}

function orderStatusClass(status: string) {
  if (FINISHED_STATUSES.has(status)) return 'border-secondary/30 bg-secondary/10 text-secondary';
  if (FAILED_STATUSES.has(status)) return 'border-error/30 bg-error/10 text-error';
  return 'border-primary/30 bg-primary/10 text-primary';
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function isMobileDevice() {
  return /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function openPaymentWindow(url: string) {
  const popup = window.open(url, 'jokoPayment', 'width=460,height=720,menubar=no,toolbar=no,location=yes,status=no');
  if (!popup || popup.closed) {
    window.location.href = url;
  }
}
