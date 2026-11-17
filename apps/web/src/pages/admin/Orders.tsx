import { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiMagnifyingGlass,
  HiEye,
  HiTruck,
  HiXMark,
  HiCheckCircle,
  HiUser,
  HiShoppingBag,
  HiBanknotes,
  HiEnvelope,
  HiTicket,
} from 'react-icons/hi2'
import { FaWhatsapp } from 'react-icons/fa'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/formatCurrency'
import {
  ordersService,
  type Order,
  type OrderStatus,
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  NEXT_STATUS,
} from '../../services/ordersService'
import toast from 'react-hot-toast'
import {
  MANUAL_PAYMENT_METHODS,
  isWaveAwaitingCheck,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  paymentProgress,
  type ManualPaymentMethod, CHECKOUT_PAYMENT_LABELS, DELIVERY_ZONE_LABELS, type CheckoutPaymentMode, type DeliveryZone } from '@trs/shared'
import PaymentProgress from '../../components/orders/PaymentProgress'
import { payBalanceUrl } from '../../utils/payLinks'
import { errorMessage } from '../../core/http'
import { paymentService } from '../../services/paymentService'

const PAYMENT_FILTERS = {
  all: 'Tous les paiements',
  unpaid: 'Non payé',
  partial: 'Payé en partie',
  paid: 'Payé 100 %',
  unpaid_delivered: 'Livrée, argent non encaissé',
} as const
type PaymentFilter = keyof typeof PAYMENT_FILTERS

const matchesPayment = (order: Order, filter: PaymentFilter) => {
  if (filter === 'all') return true
  const p = paymentProgress(order)
  if (filter === 'unpaid_delivered') return order.status === 'delivered' && p.outstanding > 0
  return p.state === filter
}

/** wa.me wants the full international number, digits only (CI numbers: 225 + 10 digits). */
const waNumber = (phone?: string | null) => {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length === 10 ? `225${digits}` : digits
}

/** Money received outside the website, recorded on the order (it then counts as real money). */
function RecordPayment({ order, onRecorded }: { order: Order; onRecorded: (o: Order) => void }) {
  const outstanding = paymentProgress(order).outstanding
  const [amount, setAmount] = useState(String(outstanding))
  const [method, setMethod] = useState<ManualPaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value <= 0 || value > outstanding) {
      toast.error(`Montant entre 1 et ${formatCurrency(outstanding)}`)
      return
    }
    setSaving(true)
    try {
      const updated = await ordersService.recordPayment(order.id, { amount: value, method, note: note.trim() || undefined })
      toast.success(`${formatCurrency(value)} enregistrés`)
      setNote('')
      onRecorded(updated)
    } catch (err) {
      toast.error(errorMessage(err, "Le paiement n'a pas été enregistré"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-gold/20 bg-gold/[0.03] p-4">
      <p className="text-sm font-medium">Enregistrer un paiement reçu hors site</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-400">
          Montant (FCFA)
          <input
            id={`pay-amount-${order.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={outstanding}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-white focus:border-gold focus:outline-none"
          />
        </label>
        <label className="text-xs text-gray-400">
          Moyen
          <select
            id={`pay-method-${order.id}`}
            value={method}
            onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
            className="mt-1 w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-white focus:border-gold focus:outline-none"
          >
            {MANUAL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        id={`pay-note-${order.id}`}
        type="text"
        maxLength={300}
        placeholder="Note (facultatif) : reçu par le livreur, n° de transaction…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gold focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setAmount(String(outstanding))} className="text-xs text-gold hover:underline">
          Tout le reste ({formatCurrency(outstanding)})
        </button>
        <Button type="submit" size="sm" icon={HiBanknotes} loading={saving}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

export default function AdminOrders() {
  const { settings } = useSettings()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [params] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string>(params.get('status') ?? 'all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(
    (Object.keys(PAYMENT_FILTERS) as PaymentFilter[]).find((k) => k === params.get('payment')) ?? 'all',
  )
  const [reminding, setReminding] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await ordersService.getAll()
      setOrders(data || [])
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      toast.error('Erreur lors du chargement des commandes')
      setOrders([])
    } finally {
      setLoading(false)
    }
}

  useEffect(() => {
    fetchOrders()
  }, [])

  // Safe filter
  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    if (!order) return false
    const matchesSearch = !searchQuery || 
      (order.preorder_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customers?.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customers?.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus && matchesPayment(order, paymentFilter)
  }) : []

  // The list endpoint is lightweight: load customer + tracking history on open.
  const openOrder = async (order: Order) => {
    setSelectedOrder(order)
    try {
      setSelectedOrder(await ordersService.getById(order.id))
    } catch {
      /* keep the list snapshot */
    }
  }

  const handlePaymentRecorded = (updated: Order) => {
    setSelectedOrder(updated)
    setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))
  }

  const handleRemind = async (order: Order) => {
    setReminding(true)
    try {
      const res = await ordersService.remind(order.id)
      if (res.sent) toast.success(`Rappel envoyé à ${res.email}`)
      else toast.error(res.email ? "L'email n'a pas pu partir : utilisez WhatsApp" : "Pas d'email pour ce client : utilisez WhatsApp")
    } catch (err) {
      toast.error(errorMessage(err, 'Rappel impossible'))
    } finally {
      setReminding(false)
    }
  }

  const [checking, setChecking] = useState<string | null>(null)
  const decideWave = async (reference: string, confirm: boolean) => {
    if (!confirm && !window.confirm('Refuser ce paiement Wave ? Il ne comptera pas.')) return
    setChecking(reference)
    try {
      const updated = confirm ? await paymentService.confirm(reference) : await paymentService.reject(reference, 'Paiement non trouvé dans Wave')
      toast.success(confirm ? 'Paiement Wave confirmé' : 'Paiement Wave refusé')
      handlePaymentRecorded(updated)
    } catch (err) {
      toast.error(errorMessage(err, 'Action impossible'))
    } finally {
      setChecking(null)
    }
  }

  const reminderText = (order: Order) =>
    `Bonjour ${order.customers?.first_name ?? ''}, il reste ${formatCurrency(paymentProgress(order).outstanding)} à régler sur votre commande ${order.preorder_number}. ` +
    `Vous pouvez payer en ligne ici : ${payBalanceUrl(order.preorder_number)} — Merci ! ${settings.store_name}`

  const handleCancel = async (orderId: string) => {
    if (!confirm('Annuler cette commande ? Ses articles sont remis en stock et le client est notifié par email.')) return
    await handleStatusUpdate(orderId, 'cancelled')
  }

  const handleReturn = async (orderId: string) => {
    if (!confirm('Marquer cette commande comme retournée ? Ses articles sont remis en stock.')) return
    await handleStatusUpdate(orderId, 'returned')
  }

  /**
   * Delivering an order paid on delivery: the cash the rider brings back is
   * recorded as a payment first, so that the order and the dashboard show real money.
   */
  const handleDeliver = async (order: Order) => {
    const outstanding = paymentProgress(order).outstanding
    if (outstanding > 0 && order.payment_method !== 'online') {
      const collected = confirm(`Le client a payé ${formatCurrency(outstanding)} à la livraison ?\n\nOK : enregistrer l’encaissement (espèces) et marquer livrée.\nAnnuler : marquer livrée sans encaissement.`)
      if (collected) {
        try {
          await ordersService.recordPayment(order.id, { amount: outstanding, method: 'cash', note: 'Encaissé à la livraison' })
        } catch (err) {
          toast.error(errorMessage(err, 'Encaissement impossible'))
          return
        }
      }
    }
    await handleStatusUpdate(order.id, 'delivered')
  }

  const advance = (order: Order) => {
    const next = NEXT_STATUS[order.status as OrderStatus]
    if (!next) return
    if (next === 'delivered') return handleDeliver(order)
    return handleStatusUpdate(order.id, next)
  }

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(true)
    try {
      await ordersService.updateStatus(orderId, newStatus)
      toast.success(`Statut mis à jour: ${ORDER_STATUS_LABELS[newStatus] || newStatus}`)
      fetchOrders()
      setSelectedOrder(null)
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setUpdating(false)
    }
  }

  // Safe calculations
  const safeOrders = Array.isArray(orders) ? orders : []
  
  const stats = {
    total: safeOrders.length,
    pending: safeOrders.filter(o => o?.status === 'pending').length,
    inProgress: safeOrders.filter(o => o && !['delivered', 'cancelled'].includes(o.status)).length,
    delivered: safeOrders.filter(o => o?.status === 'delivered').length,
    // Real money only: what was received, and what is still owed on live orders.
    received: safeOrders.reduce((sum, o) => sum + paymentProgress(o).paid, 0),
    outstanding: safeOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + paymentProgress(o).outstanding, 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Commandes</h1>
        <p className="text-gray-400 mt-1">{stats.total} commande(s) au total</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'En attente', value: stats.pending, color: 'text-yellow-500' },
          { label: 'En cours', value: stats.inProgress, color: 'text-blue-500' },
          { label: 'Livrées', value: stats.delivered, color: 'text-green-500' },
          { label: 'Encaissé', value: formatCurrency(stats.received), color: 'text-gold' },
          { label: 'Reste à encaisser', value: formatCurrency(stats.outstanding), color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center">
            <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-gray-400 text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par N° commande ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold cursor-pointer"
        >
          <option value="all">Tous les statuts</option>
          {ACTIVE_ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
          className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold cursor-pointer"
          aria-label="Filtrer par paiement"
        >
          {(Object.keys(PAYMENT_FILTERS) as PaymentFilter[]).map((k) => (
            <option key={k} value={k}>{PAYMENT_FILTERS[k]}</option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-dark-800 border border-dark-600 rounded-xl">
          <HiShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucune commande trouvée</p>
        </div>
      ) : (
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium">N° Commande</th>
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium">Client</th>
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium hidden lg:table-cell">Produits</th>
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium">Paiement</th>
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium">Statut</th>
                  <th className="text-left p-4 text-sm text-gray-400 uppercase tracking-wider font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-4 text-sm text-gray-400 uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-dark-600 hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-mono text-gold font-medium">{order.preorder_number || '-'}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">
                        {order.customers?.first_name || ''} {order.customers?.last_name || ''}
                      </div>
                      <div className="text-sm text-gray-400">{order.customers?.phone || ''}</div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="text-sm text-gray-400 space-y-1">
                        {(order.order_items || []).map((item, i) => (
                          <div key={i}>
                            {item.product_name || 'Produit'} (Taille {item.size || '-'})
                            {item.quantity > 1 && ` x${item.quantity}`}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 min-w-[190px]">
                      <PaymentProgress order={order} />
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[order.status as OrderStatus] || 'bg-gray-500/10 text-gray-500'}`}>
                        {ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status || 'Inconnu'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 hidden md:table-cell">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openOrder(order)} className="p-2 text-gray-400 hover:text-gold transition-colors" title="Voir détails">
                          <HiEye className="w-5 h-5" />
                        </button>
                        {order.status && NEXT_STATUS[order.status as OrderStatus] && (
                          <button
                            onClick={() => void advance(order)}
                            disabled={updating}
                            className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                            title={`Passer à: ${ORDER_STATUS_LABELS[NEXT_STATUS[order.status as OrderStatus]!]}`}
                          >
                            <HiTruck className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-dark-600 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    Commande
                    <span className="font-mono text-gold">{selectedOrder.preorder_number}</span>
                  </h2>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border mt-2 ${ORDER_STATUS_COLORS[selectedOrder.status as OrderStatus]}`}>
                    {ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]}
                  </span>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Customer Info */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <HiUser className="w-4 h-4" />
                    Client
                  </h3>
                  <div className="bg-dark-700 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 text-xs">Nom</span>
                      <p className="font-medium">{selectedOrder.customers?.first_name} {selectedOrder.customers?.last_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Téléphone</span>
                      <p className="font-medium flex items-center gap-2">
                        {selectedOrder.customers?.phone}
                        {selectedOrder.customers?.phone && (
                          <a href={`https://wa.me/${waNumber(selectedOrder.customers.phone)}`} target="_blank" rel="noopener noreferrer" className="text-green-500">
                            <FaWhatsapp className="w-4 h-4" />
                          </a>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Ville</span>
                      <p className="font-medium">{selectedOrder.delivery_city || selectedOrder.customers?.city || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Livraison</span>
                      <p className="font-medium">
                        {DELIVERY_ZONE_LABELS[(selectedOrder.delivery_zone ?? 'abidjan') as DeliveryZone] ?? selectedOrder.delivery_zone}
                        {(selectedOrder.delivery_fee ?? 0) > 0 && <span className="text-gray-400"> · {formatCurrency(selectedOrder.delivery_fee!)}</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Paiement</span>
                      <p className="font-medium">{CHECKOUT_PAYMENT_LABELS[selectedOrder.payment_method as CheckoutPaymentMode] ?? selectedOrder.payment_method}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Adresse</span>
                      <p className="font-medium">{selectedOrder.delivery_address || selectedOrder.customers?.address || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <HiShoppingBag className="w-4 h-4" />
                    Produits
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map((item, i) => (
                      <div key={i} className="bg-dark-700 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-400">
                            Taille: {item.size}
                            {item.color && ` • Couleur: ${item.color}`}
                            {item.quantity > 1 && ` • Qté: ${item.quantity}`}
                          </p>
                        </div>
                        <p className="font-bold">{formatCurrency(item.product_price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <HiBanknotes className="w-4 h-4" />
                    Paiement
                  </h3>
                  <div className="bg-dark-700 rounded-xl p-4 space-y-4">
                    {!!selectedOrder.discount_amount && (
                      <p className="flex justify-between text-sm text-gray-300">
                        <span>
                          Code <span className="font-mono text-gold">{selectedOrder.promo_code}</span>
                          {selectedOrder.referred_by_user_id && <span className="text-gray-500"> · parrainage</span>}
                        </span>
                        <span>
                          {formatCurrency(selectedOrder.subtotal_price ?? selectedOrder.total_price + selectedOrder.discount_amount)} → -{formatCurrency(selectedOrder.discount_amount)}
                        </span>
                      </p>
                    )}
                    <PaymentProgress order={selectedOrder} />
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-semibold">{formatCurrency(paymentProgress(selectedOrder).total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payé ({paymentProgress(selectedOrder).paidPercent} %)</p>
                        <p className="font-semibold text-gold">{formatCurrency(paymentProgress(selectedOrder).paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reste ({100 - paymentProgress(selectedOrder).paidPercent} %)</p>
                        <p className="font-semibold">{formatCurrency(paymentProgress(selectedOrder).outstanding)}</p>
                      </div>
                    </div>

                    {(selectedOrder.payments ?? [])
                      .filter((x) => x.status === 'pending' && x.method === 'wave')
                      .map((x) => (
                        <div key={x.id} className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">
                                Wave · {PAYMENT_KIND_LABELS[x.kind] ?? 'Paiement'} · {formatCurrency(x.amount)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {isWaveAwaitingCheck(x)
                                  ? `Déclaré payé${x.metadata?.payer_phone ? ` depuis le ${x.metadata.payer_phone}` : ''} · à vérifier dans Wave Business`
                                  : 'Wave ouvert, pas encore déclaré payé'}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button size="sm" loading={checking === x.reference} onClick={() => decideWave(x.reference, true)}>
                                Confirmer
                              </Button>
                              <Button size="sm" variant="ghost" disabled={checking === x.reference} onClick={() => decideWave(x.reference, false)}>
                                Refuser
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {(selectedOrder.payments ?? []).filter((x) => x.status === 'success' || x.status === 'refunded').length > 0 && (
                      <ul className="divide-y divide-dark-600 rounded-lg border border-dark-600 text-sm">
                        {(selectedOrder.payments ?? [])
                          .filter((x) => x.status === 'success' || x.status === 'refunded')
                          .map((x) => (
                            <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0">
                                <p>
                                  {PAYMENT_KIND_LABELS[x.kind] ?? 'Paiement'} · {PAYMENT_METHOD_LABELS[x.method] ?? x.method}
                                  {x.status === 'refunded' && <span className="ml-2 text-xs text-red-400">remboursé</span>}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                  {new Date(x.paid_at ?? x.created_at).toLocaleString('fr-FR')}
                                  {x.note ? ` · ${x.note}` : ''}
                                </p>
                              </div>
                              <span className={`whitespace-nowrap font-medium ${x.status === 'refunded' ? 'text-gray-500 line-through' : ''}`}>
                                {formatCurrency(x.amount)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}

                    {selectedOrder.status !== 'cancelled' && paymentProgress(selectedOrder).outstanding > 0 && (
                      <>
                        <RecordPayment key={`${selectedOrder.id}-${paymentProgress(selectedOrder).paid}`} order={selectedOrder} onRecorded={handlePaymentRecorded} />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" icon={HiEnvelope} loading={reminding} onClick={() => handleRemind(selectedOrder)}>
                            Rappel par email
                          </Button>
                          {selectedOrder.customers?.phone && (
                            <a
                              href={`https://wa.me/${waNumber(selectedOrder.customers.phone)}?text=${encodeURIComponent(reminderText(selectedOrder))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-green-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-green-400 hover:bg-green-500/10"
                            >
                              <FaWhatsapp className="w-4 h-4" /> Rappel WhatsApp
                            </a>
                          )}
                        </div>
                      </>
                    )}
                    <Link
                      to={`/admin/orders/${selectedOrder.id}/ticket`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold hover:underline"
                    >
                      <HiTicket className="w-4 h-4" /> Ticket à imprimer (QR code)
                    </Link>
                  </div>
                </div>

                {/* Timeline */}
                {selectedOrder.order_tracking && selectedOrder.order_tracking.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                      <HiTruck className="w-4 h-4" />
                      Suivi
                    </h3>
                    <div className="space-y-3">
                      {selectedOrder.order_tracking.map((track, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 bg-gold rounded-full mt-2" />
                            {i < (selectedOrder.order_tracking?.length || 0) - 1 && (
                              <div className="w-0.5 flex-1 bg-dark-600" />
                            )}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-medium">{ORDER_STATUS_LABELS[track.status as OrderStatus] || track.status}</p>
                            <p className="text-xs text-gray-500">{new Date(track.created_at).toLocaleString('fr-FR')}</p>
                            {track.notes && <p className="text-xs text-gray-400 mt-1">{track.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-dark-600 flex justify-between">
                <Button variant="ghost" onClick={() => setSelectedOrder(null)}>
                  Fermer
                </Button>
                {NEXT_STATUS[selectedOrder.status as OrderStatus] && (
                  <Button
                    variant="primary"
                    icon={HiCheckCircle}
                    onClick={() => void advance(selectedOrder)}
                    loading={updating}
                  >
                    Passer à: {ORDER_STATUS_LABELS[NEXT_STATUS[selectedOrder.status as OrderStatus]!]}
                  </Button>
                )}
                {!['delivered', 'cancelled', 'returned'].includes(selectedOrder.status) && (
                  <Button
                    variant="danger"
                    onClick={() => handleCancel(selectedOrder.id)}
                    loading={updating}
                  >
                    Annuler la commande
                  </Button>
                )}
                {selectedOrder.status === 'delivered' && (
                  <Button variant="outline" onClick={() => handleReturn(selectedOrder.id)} loading={updating}>
                    Retour client
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}