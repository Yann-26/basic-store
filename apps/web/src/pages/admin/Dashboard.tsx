import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import {
  HiArrowPath,
  HiArrowRight,
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiBanknotes,
  HiClipboardDocumentList,
  HiExclamationTriangle,
  HiShoppingBag,
  HiUserGroup,
  HiWallet,
} from 'react-icons/hi2'
import { formatCompactCurrency, formatCurrency, getCategory, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type DashboardAnalytics, type KpiValue, type PaymentMethod } from '@trs/shared'
import { engagementService } from '../../services/engagementService'
import { ORDER_STATUS_COLORS } from '../../services/ordersService'
import PaymentProgress from '../../components/orders/PaymentProgress'
import { errorMessage } from '../../core/http'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/ui/Spinner'

const GOLD = '#D4AF37'
const GRID = 'rgba(255,255,255,0.06)'
const AXIS = '#6B6B6B'
const RANGES = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 365, label: '12 mois' },
]

function Trend({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-500">= période préc.</span>
  const up = value > 0
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium', up ? 'text-emerald-400' : 'text-red-400')}>
      {up ? <HiArrowTrendingUp className="h-4 w-4" /> : <HiArrowTrendingDown className="h-4 w-4" />}
      {up ? '+' : ''}
      {value}%
    </span>
  )
}

function Kpi({ label, kpi, format, icon: Icon, highlight }: { label: string; kpi: KpiValue; format: (n: number) => string; icon: typeof HiWallet; highlight?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-5', highlight ? 'border-gold/40 bg-gradient-to-br from-gold/15 to-transparent' : 'border-white/5 bg-dark-800')}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.15em] text-gray-400">{label}</p>
        <Icon className={clsx('h-5 w-5', highlight ? 'text-gold' : 'text-gray-500')} />
      </div>
      <p className="mt-3 font-display text-3xl text-white">{format(kpi.value)}</p>
      <div className="mt-2 flex items-center justify-between">
        <Trend value={kpi.trend} />
        <span className="text-[11px] text-gray-600">préc. {format(kpi.previous)}</span>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label, money }: TooltipProps<number, string> & { money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gold/30 bg-primary-black/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-gray-400">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} className="text-white">
          {p.name} : <strong>{money ? formatCurrency(Number(p.value)) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-2xl border border-white/5 bg-dark-800 p-5 md:p-6', className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.15em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DashboardAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await engagementService.analytics(days))
    } catch (e) {
      setError(errorMessage(e, 'Impossible de charger le tableau de bord'))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const monthly = days > 120
  const fmtDate = (d: string) =>
    monthly ? new Date(`${d}-01`).toLocaleDateString('fr-FR', { month: 'short' }) : new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const hour = new Date().getHours()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{hour < 18 ? 'Bonjour' : 'Bonsoir'} {user?.first_name}</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Tableau de bord</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 p-1" role="group" aria-label="Période">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={clsx('rounded-full px-3.5 py-1.5 text-xs transition-colors', days === r.days ? 'bg-gold text-primary-black' : 'text-gray-400 hover:text-white')}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="rounded-full border border-white/10 p-2.5 text-gray-400 hover:text-gold" aria-label="Actualiser">
            <HiArrowPath className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-red-300">{error}</p>
          <button onClick={() => void load()} className="mt-3 text-sm text-gold underline">
            Réessayer
          </button>
        </div>
      )}

      {!data && loading && (
        <div className="py-32">
          <Spinner />
        </div>
      )}

      {data && (
        <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')}>
          {/* Alerts */}
          {(data.totals.pendingOrders > 0 || data.lowStock.length > 0 || data.totals.unpaidDelivered.count > 0 || data.totals.wavePaymentsToCheck.count > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {data.totals.wavePaymentsToCheck.count > 0 && (
                <Link to="/admin/payments?status=pending" className="flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-400/5 p-4 text-sm hover:border-sky-300">
                  <HiWallet className="h-5 w-5 text-sky-300" />
                  <span className="flex-1">
                    <strong>{data.totals.wavePaymentsToCheck.count}</strong> paiement{data.totals.wavePaymentsToCheck.count > 1 ? 's' : ''} Wave à vérifier ·{' '}
                    <strong>{formatCurrency(data.totals.wavePaymentsToCheck.amount)}</strong>
                  </span>
                  <HiArrowRight className="h-4 w-4 text-gray-500" />
                </Link>
              )}
              {data.totals.unpaidDelivered.count > 0 && (
                <Link to="/admin/orders?payment=unpaid_delivered" className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm hover:border-red-400">
                  <HiBanknotes className="h-5 w-5 text-red-400" />
                  <span className="flex-1">
                    <strong>{data.totals.unpaidDelivered.count}</strong> commande{data.totals.unpaidDelivered.count > 1 ? 's' : ''} livrée
                    {data.totals.unpaidDelivered.count > 1 ? 's' : ''} sans solde reçu · <strong>{formatCurrency(data.totals.unpaidDelivered.amount)}</strong> à encaisser
                  </span>
                  <HiArrowRight className="h-4 w-4 text-gray-500" />
                </Link>
              )}
              {data.totals.pendingOrders > 0 && (
                <Link to="/admin/orders?status=pending" className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm hover:border-amber-400">
                  <HiClipboardDocumentList className="h-5 w-5 text-amber-400" />
                  <span className="flex-1">
                    <strong>{data.totals.pendingOrders}</strong> précommande{data.totals.pendingOrders > 1 ? 's' : ''} en attente d'acompte ou de confirmation
                  </span>
                  <HiArrowRight className="h-4 w-4 text-gray-500" />
                </Link>
              )}
              {data.lowStock.length > 0 && (
                <Link to="/admin/products" className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm hover:border-red-400">
                  <HiExclamationTriangle className="h-5 w-5 text-red-400" />
                  <span className="flex-1">
                    <strong>{data.lowStock.length}</strong> produit{data.lowStock.length > 1 ? 's' : ''} en stock faible (≤ 3)
                  </span>
                  <HiArrowRight className="h-4 w-4 text-gray-500" />
                </Link>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Encaissé (argent reçu)" kpi={data.kpis.revenue} format={formatCompactCurrency} icon={HiWallet} highlight />
            <Kpi label="Valeur commandée" kpi={data.kpis.orderedValue} format={formatCompactCurrency} icon={HiBanknotes} />
            <Kpi label="Précommandes" kpi={data.kpis.orders} format={(n) => String(n)} icon={HiClipboardDocumentList} />
            <Kpi label="Panier moyen" kpi={data.kpis.averageOrderValue} format={formatCompactCurrency} icon={HiShoppingBag} />
            <Kpi label="Nouveaux clients" kpi={data.kpis.customers} format={(n) => String(n)} icon={HiUserGroup} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title={`Ventes · ${RANGES.find((r) => r.days === days)?.label}`} className="xl:col-span-2">
              <div className="h-72" role="img" aria-label="Argent encaissé par période">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.salesSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDate} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCompactCurrency(Number(v)).replace(' FCFA', '')} />
                    <Tooltip content={<ChartTooltip money />} labelFormatter={fmtDate} cursor={{ stroke: GOLD, strokeOpacity: 0.4 }} />
                    <Area type="monotone" dataKey="revenue" name="Encaissé" stroke={GOLD} strokeWidth={2} fill="url(#goldFill)" activeDot={{ r: 5, stroke: '#111', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/5 pt-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Encaissé au total</p>
                  <p className="font-semibold">{formatCompactCurrency(data.totals.lifetimeRevenue)}</p>
                  <p className="text-[11px] text-gray-500">sur {formatCompactCurrency(data.totals.lifetimeOrdered)} commandés</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reste à encaisser</p>
                  <p className="font-semibold text-gold">{formatCompactCurrency(data.totals.outstandingBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Produits actifs</p>
                  <p className="font-semibold">
                    {data.totals.activeProducts}/{data.totals.products}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Pipeline des commandes">
              <ul className="space-y-3">
                {data.ordersByStatus.length === 0 && <li className="text-sm text-gray-500">Aucune commande pour l'instant.</li>}
                {data.ordersByStatus.map((s) => {
                  const max = Math.max(...data.ordersByStatus.map((x) => x.count))
                  return (
                    <li key={s.status}>
                      <Link to={`/admin/orders?status=${s.status}`} className="group block">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-300 group-hover:text-gold">{ORDER_STATUS_LABELS[s.status]}</span>
                          <span className="font-medium">{s.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${(s.count / max) * 100}%`, opacity: s.status === 'cancelled' ? 0.35 : 1 }} />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Ventes par catégorie">
              {data.salesByCategory.length === 0 ? (
                <p className="text-sm text-gray-500">Pas encore de ventes sur la période.</p>
              ) : (
                <div className="h-64" role="img" aria-label="Valeur commandée par catégorie">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.salesByCategory.map((c) => ({ ...c, label: getCategory(c.category)?.label ?? 'Autre' }))} layout="vertical" margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" stroke={AXIS} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={96} />
                      <Tooltip content={<ChartTooltip money />} cursor={{ fill: 'rgba(212,175,55,0.06)' }} />
                      <Bar dataKey="revenue" name="Valeur commandée" fill={GOLD} radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Meilleures ventes">
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Pas encore de ventes sur la période.</p>
              ) : (
                <ol className="space-y-4">
                  {data.topProducts.map((p, i) => (
                    <li key={`${p.product_id}-${i}`} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gold/40 text-xs text-gold">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.units} vendu{p.units > 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-sm font-medium">{formatCompactCurrency(p.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Stock faible" action={<Link to="/admin/products" className="text-xs text-gold hover:underline">Gérer</Link>}>
              {data.lowStock.length === 0 ? (
                <p className="text-sm text-gray-500">Tous les stocks sont confortables ✨</p>
              ) : (
                <ul className="space-y-3">
                  {data.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{getCategory(p.category)?.label}</p>
                      </div>
                      <span className={clsx('rounded-full px-2.5 py-0.5 text-xs', p.stock === 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                        {p.stock === 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Dernières commandes" className="xl:col-span-2" action={<Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">Tout voir <HiArrowRight /></Link>}>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune commande pour l'instant.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto md:-mx-6">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="px-5 py-2 font-medium md:px-6">N°</th>
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium">Articles</th>
                        <th className="px-3 py-2 font-medium">Montant</th>
                        <th className="px-3 py-2 font-medium">Statut</th>
                        <th className="px-3 py-2 font-medium">Paiement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((o) => (
                        <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-gold md:px-6">{o.preorder_number}</td>
                          <td className="whitespace-nowrap px-3 py-3">{o.customer_name}</td>
                          <td className="max-w-[180px] truncate px-3 py-3 text-gray-400">{o.product_name}</td>
                          <td className="px-3 py-3">{formatCurrency(o.total_price)}</td>
                          <td className="px-3 py-3">
                            <span className={clsx('inline-flex rounded-full border px-2.5 py-0.5 text-[11px]', ORDER_STATUS_COLORS[o.status])}>{ORDER_STATUS_LABELS[o.status]}</span>
                          </td>
                          <td className="min-w-[170px] px-3 py-3">
                            <PaymentProgress order={o} compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Moyens de paiement">
              {data.paymentMix.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun paiement encaissé sur la période.</p>
              ) : (
                <ul className="space-y-4">
                  {data.paymentMix.map((m) => {
                    const total = data.paymentMix.reduce((s, x) => s + x.amount, 0)
                    const pct = total ? Math.round((m.amount / total) * 100) : 0
                    return (
                      <li key={m.channel}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="capitalize text-gray-300">{PAYMENT_METHOD_LABELS[m.channel as PaymentMethod] ?? m.channel.replace('_', ' ')}</span>
                          <span>
                            {pct}% · {m.count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
