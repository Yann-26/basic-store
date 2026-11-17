import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiXMark,
  HiCheckCircle,
  HiRectangleGroup,
  HiPhoto,
} from 'react-icons/hi2'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { catalogService } from '../../services/catalogService'
import type { Collection, CollectionFormData } from '../../types/catalog'
import toast from 'react-hot-toast'

const emptyCollection: CollectionFormData = {
  name: '',
  description: '',
  image_url: '',
  banner_url: '',
  is_active: true,
  sort_order: 0,
}

export default function AdminCatalog() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [collectionForm, setCollectionForm] = useState<CollectionFormData>(emptyCollection)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setCollections((await catalogService.getAllCollections()) || [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Collections handlers
  const handleAddCollection = () => {
    setEditingCollection(null)
    setCollectionForm(emptyCollection)
    setShowModal(true)
  }

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection)
    setCollectionForm({
      name: collection.name,
      description: collection.description || '',
      image_url: collection.image_url || '',
      banner_url: collection.banner_url || '',
      is_active: collection.is_active,
      sort_order: collection.sort_order,
    })
    setShowModal(true)
  }

  const handleDeleteCollection = async (id: string) => {
    if (confirm('Supprimer cette collection ?')) {
      try {
        await catalogService.deleteCollection(id)
        toast.success('Collection supprimée')
        fetchData()
      } catch {
        toast.error('Erreur de suppression')
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingCollection) {
        await catalogService.updateCollection(editingCollection.id, collectionForm)
        toast.success('Collection modifiée')
      } else {
        await catalogService.createCollection(collectionForm)
        toast.success('Collection créée')
      }
      setShowModal(false)
      fetchData()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Catalogue</h1>
          <p className="text-gray-400 mt-1">Regroupez vos articles en collections (Nouveautés, Été, Promo…).</p>
        </div>
        <Button
          variant="primary"
          icon={HiPlus}
          onClick={handleAddCollection}
        >
          Nouvelle collection
        </Button>
      </div>

      {/* Collections Table */}
      {(
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left p-4 text-sm text-gray-400 uppercase">Collection</th>
                <th className="text-left p-4 text-sm text-gray-400 uppercase hidden md:table-cell">Description</th>
                <th className="text-left p-4 text-sm text-gray-400 uppercase">Ordre</th>
                <th className="text-left p-4 text-sm text-gray-400 uppercase">Statut</th>
                <th className="text-right p-4 text-sm text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-gray-500">
                    Aucune collection. Créez votre première collection.
                  </td>
                </tr>
              ) : (
                collections.map((col) => (
                  <tr key={col.id} className="border-b border-dark-600 hover:bg-dark-700/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {col.image_url ? (
                          <img src={col.image_url} className="w-8 h-8 rounded object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 bg-gold/10 rounded flex items-center justify-center">
                            <HiRectangleGroup className="w-4 h-4 text-gold" />
                          </div>
                        )}
                        <span className="font-medium">{col.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 hidden md:table-cell max-w-xs truncate">
                      {col.description || '-'}
                    </td>
                    <td className="p-4">{col.sort_order}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${col.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {col.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditCollection(col)} className="p-2 text-gray-400 hover:text-gold">
                          <HiPencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCollection(col.id)} className="p-2 text-gray-400 hover:text-red-500">
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingCollection ? 'Modifier la collection' : 'Nouvelle collection'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Name */}
                <Input
                  label="Nom *"
                  value={collectionForm.name}
                  onChange={(e) => {
                    setCollectionForm({ ...collectionForm, name: e.target.value })
                  }}
                  required
                />

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 uppercase mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={collectionForm.description}
                    onChange={(e) => {
                      setCollectionForm({ ...collectionForm, description: e.target.value })
                    }}
                    className="w-full bg-dark-700 border border-dark-500 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                {/* Image URL */}
                <Input
                  label="URL Image"
                  icon={HiPhoto}
                  value={collectionForm.image_url}
                  onChange={(e) => {
                    setCollectionForm({ ...collectionForm, image_url: e.target.value })
                  }}
                  placeholder="https://..."
                />

                {/* Sort Order & Active */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Ordre"
                    type="number"
                    value={String(collectionForm.sort_order)}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setCollectionForm({ ...collectionForm, sort_order: value })
                    }}
                  />
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectionForm.is_active}
                        onChange={(e) => {
                          setCollectionForm({ ...collectionForm, is_active: e.target.checked })
                        }}
                        className="w-4 h-4 rounded accent-gold"
                      />
                      <span className="text-sm">Actif</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
                <Button variant="primary" icon={HiCheckCircle} onClick={handleSave} loading={saving}>
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