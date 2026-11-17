import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  HiMagnifyingGlass,
  HiUsers,
  HiShieldCheck,
  HiNoSymbol,
  HiCheckCircle,
  HiArrowPath,
  HiDevicePhoneMobile,
  HiChevronLeft,
  HiChevronRight,
} from 'react-icons/hi2'
import { formatCurrency, type AdminUser } from '@trs/shared'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { errorMessage } from '../../core/http'
import { usersService, type AdminUserPage } from '../../services/usersService'
import Spinner from '../../components/ui/Spinner'

const PAGE_SIZE = 25
type RoleFilter = '' | 'customer' | 'admin'
type StatusFilter = '' | 'active' | 'suspended'

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx('rounded-full border px-4 py-1.5 text-xs transition-colors', active ? 'border-gold bg-gold text-primary-black' : 'border-white/10 text-gray-400 hover:text-white')}
    >
      {children}
    </button>
  )
}

/**
 * Every account in the database (customers who never ordered included):
 * suspend / reactivate, change the role, reset an admin's 2FA.
 */
export default function AdminUsers() {
  const { user: me } = useAuth()
  const [data, setData] = useState<AdminUserPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const debounced = useDebounce(search)

  const load = (signal?: AbortSignal) =>
    usersService
      .list({ search: debounced.trim() || undefined, role: role || undefined, status: status || undefined, page, limit: PAGE_SIZE }, signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') toast.error(errorMessage(e, 'Erreur de chargement des utilisateurs'))
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    setPage(1)
  }, [debounced, role, status])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    void load(ctrl.signal)
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, role, status, page])

  const replace = (u: AdminUser) => setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === u.id ? u : x)) } : d))

  const act = async (u: AdminUser, run: () => Promise<unknown>, success: string) => {
    setBusy(u.id)
    try {
      const res = await run()
      if (res && typeof res === 'object' && 'id' in res) replace(res as AdminUser)
      toast.success(success)
      void load() // refresh counters
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const toggleActive = (u: AdminUser) => {
    const suspend = u.is_active
    const message = suspend
      ? `Suspendre le compte de ${u.first_name} ${u.last_name} ?\nIl sera déconnecté immédiatement et ne pourra plus se connecter.`
      : `Réactiver le compte de ${u.first_name} ${u.last_name} ?`
    if (!confirm(message)) return
    void act(u, () => usersService.update(u.id, { is_active: !suspend }), suspend ? 'Compte suspendu' : 'Compte réactivé')
  }

  const changeRole = (u: AdminUser, next: 'customer' | 'admin') => {
    if (next === u.role) return
    const message =
      next === 'admin'
        ? `Donner les droits administrateur à ${u.first_name} ${u.last_name} ?\nIl devra activer la double authentification à sa prochaine connexion.`
        : `Retirer les droits administrateur de ${u.first_name} ${u.last_name} ?`
    if (!confirm(message)) return
    void act(u, () => usersService.update(u.id, { role: next }), next === 'admin' ? 'Droits administrateur accordés' : 'Droits administrateur retirés')
  }

  const resetTwoFactor = (u: AdminUser) => {
    if (!confirm(`Réinitialiser la double authentification de ${u.first_name} ?\nSes sessions seront fermées et il configurera une nouvelle application à sa prochaine connexion.`)) return
    void act(u, () => usersService.resetTwoFactor(u.id).then(() => ({ ...u, two_factor_enabled: false })), 'Double authentification réinitialisée')
  }

  const stats = data?.stats
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Accès</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold">
          <HiUsers className="text-gold" /> Utilisateurs
        </h1>
        <p className="mt-1 text-sm text-gray-400">Tous les comptes inscrits, qu'ils aient commandé ou non. Suspendez un compte ou changez son rôle.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Comptes', value: stats?.total, icon: HiUsers },
          { label: 'Administrateurs', value: stats?.admins, icon: HiShieldCheck },
          { label: 'Suspendus', value: stats?.suspended, icon: HiNoSymbol },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/5 bg-dark-800 p-5">
            <s.icon className="h-5 w-5 text-gold" />
            <p className="mt-3 text-2xl font-semibold">{s.value ?? '—'}</p>
            <p className="text-xs uppercase tracking-widest text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email, téléphone…" className="field !rounded-full pl-12" aria-label="Rechercher" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={role === ''} onClick={() => setRole('')}>Tous</Chip>
          <Chip active={role === 'customer'} onClick={() => setRole('customer')}>Clients</Chip>
          <Chip active={role === 'admin'} onClick={() => setRole('admin')}>Admins</Chip>
          <span className="mx-1 w-px bg-white/10" />
          <Chip active={status === ''} onClick={() => setStatus('')}>Tous statuts</Chip>
          <Chip active={status === 'active'} onClick={() => setStatus('active')}>Actifs</Chip>
          <Chip active={status === 'suspended'} onClick={() => setStatus('suspended')}>Suspendus</Chip>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-dark-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-widest text-gray-500">
              <th className="p-4">Utilisateur</th>
              <th className="p-4">Rôle</th>
              <th className="p-4">Statut</th>
              <th className="p-4">Commandes</th>
              <th className="p-4">Dernière connexion</th>
              <th className="p-4">Inscrit le</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={7} className="py-16">
                  <Spinner />
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500">
                  Aucun utilisateur ne correspond.
                </td>
              </tr>
            ) : (
              data?.items.map((u) => {
                const isMe = u.id === me?.id
                return (
                  <tr key={u.id} className={clsx('border-t border-white/5', !u.is_active && 'opacity-60', busy === u.id && 'animate-pulse')}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-semibold uppercase text-gold">
                          {u.first_name[0]}
                          {u.last_name[0]}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.first_name} {u.last_name}
                            {isMe && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-gray-300">Vous</span>}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {u.email}
                            {u.phone ? ` · ${u.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as 'customer' | 'admin')}
                        disabled={isMe || busy === u.id}
                        className={clsx('rounded-full border bg-transparent px-3 py-1 text-xs', u.role === 'admin' ? 'border-gold/50 text-gold' : 'border-white/10 text-gray-300')}
                        aria-label={`Rôle de ${u.first_name}`}
                      >
                        <option value="customer" className="bg-dark-800">Client</option>
                        <option value="admin" className="bg-dark-800">Administrateur</option>
                      </select>
                      {u.role === 'admin' && (
                        <p className={clsx('mt-1 flex items-center gap-1 text-[11px]', u.two_factor_enabled ? 'text-green-400' : 'text-amber-400')}>
                          <HiDevicePhoneMobile className="h-3 w-3" /> {u.two_factor_enabled ? '2FA activée' : '2FA à configurer'}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={clsx('rounded-full px-2.5 py-1 text-xs', u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                        {u.is_active ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.total_orders > 0 ? (
                        <>
                          <p>{u.total_orders}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(u.total_spent)}</p>
                        </>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400">{date(u.last_login)}</td>
                    <td className="p-4 text-gray-400">{date(u.created_at)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        {u.role === 'admin' && u.two_factor_enabled && !isMe && (
                          <button onClick={() => resetTwoFactor(u)} disabled={busy === u.id} className="rounded-full border border-white/10 p-2 text-gray-400 hover:border-gold hover:text-gold" title="Réinitialiser la 2FA">
                            <HiArrowPath className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={isMe || busy === u.id}
                          className={clsx(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                            u.is_active ? 'border-red-500/30 text-red-300 hover:bg-red-500/10' : 'border-green-500/30 text-green-300 hover:bg-green-500/10',
                          )}
                        >
                          {u.is_active ? <HiNoSymbol className="h-4 w-4" /> : <HiCheckCircle className="h-4 w-4" />}
                          {u.is_active ? 'Suspendre' : 'Réactiver'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>
            {data.total} utilisateurs · page {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-full border border-white/10 p-2 disabled:opacity-30" aria-label="Page précédente">
              <HiChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-full border border-white/10 p-2 disabled:opacity-30" aria-label="Page suivante">
              <HiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
