import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiMagnifyingGlass,
  HiEye,
  HiXMark,
  HiPhone,
  HiEnvelope,
  HiMapPin,
  HiUser,
  HiShoppingBag,
  HiCalendar,
  HiSparkles,
  HiPencil,
  HiCheckCircle
} from 'react-icons/hi2'
import { FaWhatsapp } from 'react-icons/fa'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { formatCurrency } from '../../utils/formatCurrency'
import { customersService, type Customer, type CustomerOrder } from '../../services/customersService'
import toast from 'react-hot-toast'

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState<Partial<Customer>>({})
  const [saving, setSaving] = useState(false)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await customersService.getAll()
      setCustomers(data || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      toast.error('Erreur lors du chargement des clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleViewCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setLoadingOrders(true)
    try {
      const orders = await customersService.getOrders(customer.id)
      setCustomerOrders(orders || [])
    } catch {
      setCustomerOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditData({
      id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone || '',
      email: customer.email || '',
      city: customer.city || '',
      address: customer.address || '',
      notes: customer.notes || '',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editData.id) return
    setSaving(true)
    try {
      await customersService.update(editData.id, editData)
      toast.success('Client mis à jour')
      setShowEditModal(false)
      fetchCustomers()
      if (selectedCustomer?.id === editData.id) {
        setSelectedCustomer(null)
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.total_orders > 0).length,
    newThisMonth: customers.filter(c => {
      const date = new Date(c.created_at)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length,
    totalSpent: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
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
        <h1 className="text-3xl font-bold">Clients</h1>
        <p className="text-gray-400 mt-1">{customers.length} client(s) enregistré(s)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total clients', value: stats.total, icon: HiUser, color: 'text-blue-500' },
          { label: 'Clients actifs', value: stats.active, icon: HiShoppingBag, color: 'text-green-500' },
          { label: 'Nouveaux ce mois', value: stats.newThisMonth, icon: HiSparkles, color: 'text-purple-500' },
          { label: 'CA Total', value: formatCurrency(stats.totalSpent), icon: HiCalendar, color: 'text-gold' },
        ].map((stat) => (
          <div key={stat.label} className="bg-dark-800 border border-dark-600 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-gray-400">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors"
        />
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-20 bg-dark-800 border border-dark-600 rounded-xl">
          <HiUser className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-xl p-6 hover:border-gold/30 transition-all"
            >
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center text-lg font-bold text-gold">
                  {customer.first_name?.charAt(0)}{customer.last_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {customer.first_name} {customer.last_name}
                  </h3>
                  <p className="text-sm text-gray-400 truncate">{customer.city || 'Ville inconnue'}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${customer.total_orders > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm mb-4">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <HiPhone className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <HiEnvelope className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <HiMapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{customer.address}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-4 border-t border-dark-600">
                <div>
                  <div className="text-xs text-gray-500">Commandes</div>
                  <div className="font-bold">{customer.total_orders}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total dépensé</div>
                  <div className="font-bold text-gold">{formatCurrency(customer.total_spent)}</div>
                </div>
                <div className="flex gap-1">
                  {customer.phone && (
                    <a
                      href={`https://wa.me/${customer.phone.replace(/\s/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
                    >
                      <FaWhatsapp className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleViewCustomer(customer)}
                    className="p-2 bg-gold/10 text-gold rounded-lg hover:bg-gold/20 transition-colors"
                  >
                    <HiEye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 transition-colors"
                  >
                    <HiPencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-dark-600 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center text-2xl font-bold text-gold">
                    {selectedCustomer.first_name?.charAt(0)}{selectedCustomer.last_name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedCustomer.first_name} {selectedCustomer.last_name}</h2>
                    <p className="text-gray-400 text-sm">Client depuis {new Date(selectedCustomer.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-white">
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Contact Info */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Contact</h3>
                  <div className="bg-dark-700 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
                    {selectedCustomer.phone && (
                      <div>
                        <span className="text-gray-500 text-xs">Téléphone</span>
                        <p className="font-medium flex items-center gap-2">
                          {selectedCustomer.phone}
                          <a href={`https://wa.me/${selectedCustomer.phone.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-500">
                            <FaWhatsapp className="w-4 h-4" />
                          </a>
                        </p>
                      </div>
                    )}
                    {selectedCustomer.email && (
                      <div>
                        <span className="text-gray-500 text-xs">Email</span>
                        <p className="font-medium">{selectedCustomer.email}</p>
                      </div>
                    )}
                    {selectedCustomer.city && (
                      <div>
                        <span className="text-gray-500 text-xs">Ville</span>
                        <p className="font-medium">{selectedCustomer.city}</p>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div>
                        <span className="text-gray-500 text-xs">Adresse</span>
                        <p className="font-medium">{selectedCustomer.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Statistiques</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-dark-700 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold">{selectedCustomer.total_orders}</div>
                      <div className="text-xs text-gray-400">Commandes</div>
                    </div>
                    <div className="bg-dark-700 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gold">{formatCurrency(selectedCustomer.total_spent)}</div>
                      <div className="text-xs text-gray-400">Total dépensé</div>
                    </div>
                    <div className="bg-dark-700 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {selectedCustomer.total_orders > 0 ? formatCurrency(selectedCustomer.total_spent / selectedCustomer.total_orders) : '-'}
                      </div>
                      <div className="text-xs text-gray-400">Panier moyen</div>
                    </div>
                  </div>
                </div>

                {/* Orders History */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Historique des commandes ({customerOrders.length})
                  </h3>
                  {loadingOrders ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : customerOrders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Aucune commande</p>
                  ) : (
                    <div className="space-y-2">
                      {customerOrders.map((order) => (
                        <div key={order.id} className="bg-dark-700 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-mono text-gold text-sm">{order.preorder_number}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(order.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(order.total_price)}</p>
                            <p className="text-xs text-gray-400">
                              {order.deposit_amount > 0 ? `En ligne : ${formatCurrency(order.deposit_amount)}` : "Paiement à la livraison"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-dark-600 flex justify-between">
                <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>
                  Fermer
                </Button>
                {selectedCustomer.phone && (
                  <a href={`https://wa.me/${selectedCustomer.phone.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" icon={FaWhatsapp}>
                      Contacter sur WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Customer Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Modifier le client</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Input
                    label="Prénom"
                    value={editData.first_name || ''}
                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                  />
                  <Input
                    label="Nom"
                    value={editData.last_name || ''}
                    onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                  />
                </div>
                <Input
                  label="Téléphone"
                  icon={HiPhone}
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
                <Input
                  label="Email"
                  icon={HiEnvelope}
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
                <Input
                  label="Ville"
                  icon={HiMapPin}
                  value={editData.city || ''}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                />
                <Input
                  label="Adresse"
                  value={editData.address || ''}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={editData.notes || ''}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-500 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold resize-none"
                    placeholder="Notes internes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                  Annuler
                </Button>
                <Button variant="primary" icon={HiCheckCircle} onClick={handleSaveEdit} loading={saving}>
                  Sauvegarder
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}