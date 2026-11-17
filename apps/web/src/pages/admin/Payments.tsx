import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  HiMagnifyingGlass,
  HiCheckCircle,
  HiXCircle,
  HiClock,
  HiCurrencyDollar,
  HiArrowPath,
  HiChartBar,
  HiArrowTrendingUp,
  HiCalendar,
  HiCreditCard,
  HiBanknotes,
} from 'react-icons/hi2'
import Button from '../../components/ui/Button'
import { formatCurrency, formatCompactCurrency } from '../../utils/formatCurrency'
import { paymentService, type Payment, type PaymentsResponse } from '../../services/paymentService'
import toast from 'react-hot-toast'
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, isWaveAwaitingCheck } from '@trs/shared'
import { errorMessage } from '../../core/http'

const statusColors: Record<string, string> = {
  success: 'bg-green-500/10 text-green-500 border-green-500/30',
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  failed: 'bg-red-500/10 text-red-500 border-red-500/30',
  refunded: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
}

const statusLabels: Record<string, string> = {
  success: 'Réussi',
  pending: 'En attente',
  failed: 'Échoué',
  refunded: 'Remboursé',
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<PaymentsResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [params] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? 'all')
  const [acting, setActing] = useState<string | null>(null)

  /** Wave: the shop has checked its Wave Business app. */
  const decide = async (payment: Payment, confirm: boolean) => {
    if (!confirm && !window.confirm(`Refuser le paiement Wave de ${formatCurrency(payment.amount)} ? Il ne comptera pas.`)) return
    setActing(payment.reference)
    try {
      if (confirm) await paymentService.confirm(payment.reference)
      else await paymentService.reject(payment.reference, 'Paiement non trouvé dans Wave')
      toast.success(confirm ? 'Paiement confirmé : il compte comme argent reçu' : 'Paiement refusé')
      await fetchPayments()
    } catch (e) {
      toast.error(errorMessage(e, 'Action impossible'))
    } finally {
      setActing(null)
    }
  }
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRange, setTimeRange] = useState('all')

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const data = await paymentService.getAll({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit: 20,
      })

      setPayments(data.payments)
      setStats(data.stats)
      setTotalPages(Math.ceil(data.total / 20))
    } catch (error) {
      toast.error('Erreur lors du chargement des paiements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [statusFilter, page])

  const filteredPayments = payments.filter(p =>
    (p.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.customer_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.orders?.preorder_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate derived statistics
  const successPayments = payments.filter(p => p.status === 'success')
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const failedPayments = payments.filter(p => p.status === 'failed')

  const totalRevenue = successPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const averageOrderValue = successPayments.length > 0 
    ? totalRevenue / successPayments.length 
    : 0

  const successRate = payments.length > 0
    ? ((successPayments.length / payments.length) * 100).toFixed(1)
    : '0'

  const todayPayments = payments.filter(p => {
    const today = new Date()
    const paymentDate = new Date(p.created_at)
    return paymentDate.toDateString() === today.toDateString()
  })

  const todayRevenue = todayPayments
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const thisMonthPayments = payments.filter(p => {
    const now = new Date()
    const paymentDate = new Date(p.created_at)
    return paymentDate.getMonth() === now.getMonth() && 
           paymentDate.getFullYear() === now.getFullYear()
  })

  const thisMonthRevenue = thisMonthPayments
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  // Payment methods distribution
  const paymentMethods = payments.reduce((acc, p) => {
    const channel = p.channel || 'unknown'
    if (p.status === 'success') {
      acc[channel] = (acc[channel] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const topPaymentMethod = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1])[0]

  // Chart data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - i)

  const dateStr = date.toISOString().slice(0, 10)

  const dayPayments = payments.filter(
    p =>
      (p.created_at ?? "").startsWith(dateStr) &&
      p.status === "success"
  )

  return {
    date: date.toLocaleDateString("fr-FR", { weekday: "short" }),
    amount: dayPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
    count: dayPayments.length,
  }
}).reverse()

  const maxAmount = Math.max(...last7Days.map(d => d.amount), 1)

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <HiCheckCircle className="w-3.5 h-3.5" />
      case 'pending': return <HiClock className="w-3.5 h-3.5" />
      case 'failed': return <HiXCircle className="w-3.5 h-3.5" />
      case 'refunded': return <HiArrowPath className="w-3.5 h-3.5" />
      default: return null
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paiements</h1>
          <p className="text-gray-400 mt-1">Gérez les transactions et suivez les revenus.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold cursor-pointer"
          >
            <option value="all">Tout</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
          <Button variant="ghost" icon={HiArrowPath} onClick={fetchPayments} loading={loading}>
            Actualiser
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Revenus totaux', value: formatCurrency(totalRevenue), icon: HiBanknotes, color: 'text-green-500', bgColor: 'bg-green-500/10' },
            { label: "Aujourd'hui", value: formatCurrency(todayRevenue), icon: HiCalendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
            { label: 'Ce mois', value: formatCurrency(thisMonthRevenue), icon: HiArrowTrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
            { label: 'Panier moyen', value: formatCurrency(averageOrderValue), icon: HiCreditCard, color: 'text-gold', bgColor: 'bg-gold/10' },
            { label: 'Taux réussite', value: `${successRate}%`, icon: HiChartBar, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
            { label: 'Transactions', value: stats.total, icon: HiCurrencyDollar, color: 'text-white', bgColor: 'bg-white/5' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bgColor} border border-white/5 rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status Breakdown + Chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Status Breakdown */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <HiChartBar className="w-4 h-4" />
            Répartition des statuts
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Réussis', count: successPayments.length, amount: totalRevenue, color: 'bg-green-500', icon: HiCheckCircle },
              { label: 'En attente', count: pendingPayments.length, amount: pendingPayments.reduce((s, p) => s + (p.amount || 0), 0), color: 'bg-yellow-500', icon: HiClock },
              { label: 'Échoués', count: failedPayments.length, amount: failedPayments.reduce((s, p) => s + (p.amount || 0), 0), color: 'bg-red-500', icon: HiXCircle },
            ].map((item) => {
              const percentage = payments.length > 0 ? (item.count / payments.length) * 100 : 0
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium">{item.count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.amount)}</p>
                </div>
              )
            })}
          </div>

          {/* Payment Methods */}
          {topPaymentMethod && (
            <div className="mt-6 pt-4 border-t border-dark-600">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Méthodes de paiement
              </h4>
              <div className="space-y-2">
                {Object.entries(paymentMethods)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([method, count]) => (
                    <div key={method} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 capitalize">{method.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Last 7 Days Chart */}
        <div className="lg:col-span-2 bg-dark-800 border border-dark-600 rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-6 flex items-center gap-2">
            <HiArrowTrendingUp className="w-4 h-4" />
            7 derniers jours
          </h3>
          <div className="space-y-3">
            {last7Days.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-10 text-right">{day.date}</span>
                <div className="flex-1 h-8 bg-dark-700 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gold/30 rounded-full transition-all duration-500 relative"
                    style={{ width: `${(day.amount / maxAmount) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gold/50 to-gold/10 rounded-full" />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-20 text-right">
                  {day.amount > 0 ? formatCompactCurrency(day.amount) : '-'}
                </span>
                <span className="text-xs text-gray-600 w-16 text-right">
                  {day.count > 0 ? `${day.count} vente${day.count > 1 ? 's' : ''}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par référence, email ou commande..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold cursor-pointer"
        >
          <option value="all">Tous les statuts</option>
          <option value="success">Réussis</option>
          <option value="pending">En attente</option>
          <option value="failed">Échoués</option>
          <option value="refunded">Remboursés</option>
        </select>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-20 bg-dark-800 border border-dark-600 rounded-xl">
          <HiCurrencyDollar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun paiement trouvé</p>
        </div>
      ) : (
        <>
          <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider">Référence</th>
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider">Client</th>
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider hidden md:table-cell">Commande</th>
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider">Montant</th>
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider">Statut</th>
                    <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                    <th className="text-right p-4 text-sm text-gray-400 uppercase tracking-wider">Wave</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <motion.tr
                      key={payment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-dark-600 hover:bg-dark-700/50 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-mono text-gold text-sm">{payment.reference}</span>
                        <div className="text-xs text-gray-500">
                          {PAYMENT_KIND_LABELS[payment.kind ?? 'deposit']} ·{' '}
                          {payment.method && !['paystack'].includes(payment.method)
                            ? PAYMENT_METHOD_LABELS[payment.method]
                            : payment.channel
                              ? payment.channel.replace(/_/g, ' ')
                              : 'en ligne'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium truncate max-w-[150px]">{payment.customer_email || '-'}</div>
                        {payment.orders?.customers && (
                          <div className="text-sm text-gray-400">
                            {payment.orders.customers.first_name} {payment.orders.customers.last_name}
                          </div>
                        )}
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        {payment.orders?.preorder_number ? (
                          <span className="font-mono text-sm">{payment.orders.preorder_number}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-4 font-bold">{formatCurrency(payment.amount || 0)}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusColors[payment.status] || 'bg-gray-500/10 text-gray-500'}`}>
                          {renderStatusIcon(payment.status)}
                          {payment.status === 'pending' && payment.method === 'wave'
                            ? isWaveAwaitingCheck(payment)
                              ? 'À vérifier'
                              : 'Non déclaré'
                            : statusLabels[payment.status] || payment.status}
                        </span>
                        {payment.metadata?.payer_phone && (
                          <div className="mt-1 text-xs text-gray-400">Wave : {payment.metadata.payer_phone}</div>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 hidden lg:table-cell">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : new Date(payment.created_at).toLocaleDateString('fr-FR')
                        }
                      </td>
                      <td className="p-4 text-right">
                        {payment.status === 'pending' && payment.method === 'wave' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" loading={acting === payment.reference} onClick={() => decide(payment, true)}>
                              Confirmer
                            </Button>
                            <Button size="sm" variant="ghost" disabled={acting === payment.reference} onClick={() => decide(payment, false)}>
                              Refuser
                            </Button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-gold text-primary-black'
                      : 'bg-dark-800 text-gray-400 hover:text-white border border-dark-600'
                  }`}
                >
                  {p}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}