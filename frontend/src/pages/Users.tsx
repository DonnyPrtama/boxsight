import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getSession, signOut, type Role, type Session } from '../lib/auth'
import {
  createUser,
  deleteUser as deleteUserRequest,
  fetchUsers,
  updateUser,
  type ManagedUser,
} from '../lib/users'
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  GridIcon,
  HistoryIcon,
  LogoMark,
  LogoutIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
  TrashIcon,
  UsersIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'
import './Users.css'

interface UserForm {
  name: string
  username: string
  role: Role
  password: string
}

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; user: ManagedUser }
  | { type: 'delete'; user: ManagedUser }
  | null

type FieldErrors = Partial<Record<'name' | 'username' | 'password', string>>
type Toast = { kind: 'success' | 'error'; text: string } | null

const EMPTY_FORM: UserForm = { name: '', username: '', role: 'Operator', password: '' }

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Users() {
  const session = getSession()
  if (!session) return null
  return <UsersWorkspace session={session} />
}

function UsersWorkspace({ session }: { session: Session }) {
  const navigate = useNavigate()
  const isAdmin = session.role === 'Admin'
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(isAdmin)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const modalRef = useRef<HTMLDivElement>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    fetchUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows)
      })
      .catch(() => {
        if (!cancelled) {
          setToast({ kind: 'error', text: 'Gagal memuat daftar user. Periksa koneksi.' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!modal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    modalRef.current?.focus()

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) closeModal()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
    // closeModal is a stable handler for this modal lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, saving])

  const navItems =
    session.role === 'Operator'
      ? [
          { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
          { label: 'Deteksi', to: '/detection', icon: ScanIcon },
          { label: 'Riwayat', to: '/history', icon: HistoryIcon },
        ]
      : session.role === 'Manajemen'
        ? [
            { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
            { label: 'Riwayat', to: '/history', icon: HistoryIcon },
          ]
        : [
            { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
            { label: 'Pengaturan', to: '/settings', icon: SettingsIcon },
            { label: 'Kelola User', to: '/users', icon: UsersIcon },
          ]

  function isYou(user: ManagedUser): boolean {
    return user.username === session.username
  }

  function showToast(kind: 'success' | 'error', text: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast({ kind, text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4600)
  }

  function clearToast() {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast(null)
  }

  function highlight(id: number) {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    setHighlightId(id)
    highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 3000)
  }

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  function openAdd() {
    clearToast()
    setForm(EMPTY_FORM)
    setErrors({})
    setModalError('')
    setModal({ type: 'add' })
  }

  function openEdit(user: ManagedUser) {
    clearToast()
    setForm({ name: user.name, username: user.username, role: user.role, password: '' })
    setErrors({})
    setModalError('')
    setModal({ type: 'edit', user })
  }

  function openDelete(user: ManagedUser) {
    if (isYou(user)) {
      showToast('error', 'Akun yang sedang dipakai tidak bisa dihapus.')
      return
    }
    clearToast()
    setErrors({})
    setModalError('')
    setModal({ type: 'delete', user })
  }

  function closeModal() {
    if (saving) return
    setModal(null)
    setErrors({})
    setModalError('')
  }

  function validate(nextModal: ModalState): FieldErrors {
    const next: FieldErrors = {}
    if (!form.name.trim()) next.name = 'Nama wajib diisi.'
    if (!form.username.trim()) {
      next.username = 'Username wajib diisi.'
    } else {
      const editingId = nextModal?.type === 'edit' ? nextModal.user.id : null
      const username = form.username.trim().toLowerCase()
      if (users.some((user) => user.id !== editingId && user.username.toLowerCase() === username)) {
        next.username = 'Username sudah dipakai. Pilih username lain.'
      }
    }
    if (nextModal?.type === 'add' && !form.password) {
      next.password = 'Password wajib diisi.'
    }
    if (form.password && form.password.length < 8) {
      next.password = 'Password minimal 8 karakter.'
    }
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal || modal.type === 'delete' || saving) return

    const nextErrors = validate(modal)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const currentModal = modal
    const payload = {
      nama: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
    }

    setSaving(true)
    setModalError('')

    try {
      if (currentModal.type === 'add') {
        const newUser = await createUser({ ...payload, password: form.password })
        setUsers((current) => [...current, newUser])
        highlight(newUser.id)
        showToast('success', `User ${newUser.name} ditambahkan.`)
      } else {
        const updated = await updateUser(currentModal.user.id, payload)
        setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)))
        highlight(updated.id)
        showToast('success', 'Perubahan user disimpan.')
      }
      setModal(null)
      setErrors({})
    } catch (error) {
      setModalError(
        error instanceof ApiError
          ? error.message
          : 'Gagal menyimpan. Periksa koneksi, lalu coba lagi.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!modal || modal.type !== 'delete') return
    const target = modal.user
    if (isYou(target)) {
      showToast('error', 'Akun yang sedang dipakai tidak bisa dihapus.')
      setModal(null)
      return
    }

    setSaving(true)
    setModalError('')
    try {
      await deleteUserRequest(target.id)
      setUsers((current) => current.filter((user) => user.id !== target.id))
      setModal(null)
      setErrors({})
      showToast('success', `User ${target.name} dihapus.`)
    } catch (error) {
      setModalError(
        error instanceof ApiError
          ? error.message
          : 'Gagal menghapus user. Periksa koneksi, lalu coba lagi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const addOpen = modal?.type === 'add'
  const editUser = modal?.type === 'edit' ? modal.user : null
  const deleteUser = modal?.type === 'delete' ? modal.user : null

  return (
    <div className="dashboard users-page">
      <aside className="sidebar">
        <div className="brand">
          <LogoMark className="brand__mark" />
          <div className="brand__text">
            <strong>BoxSight</strong>
            <span>Packaging inspection</span>
          </div>
        </div>

        <div className="account">
          <p className="account__label">SESI AKTIF</p>
          <div className="account__row">
            <span className="avatar avatar--sidebar">{initials(session.name)}</span>
            <div className="account__text">
              <strong>{session.name}</strong>
              <span>{session.role}</span>
            </div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navigasi utama">
          <p className="side-nav__label">MENU</p>
          {navItems.map((item) => {
            const active = item.to === '/users'
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`side-nav__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="side-nav__icon" />
                <span>{item.label}</span>
                {active ? <span className="side-nav__dot" aria-hidden="true" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar__foot">
          <button className="sidebar__out" type="button" onClick={handleSignOut}>
            <LogoutIcon className="sidebar__out-icon" />
            Keluar
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar users-topbar">
          <div className="topbar__titles">
            <h1>Kelola user</h1>
            <p>
              {session.role} · {users.length} akun
            </p>
          </div>
          <div className="topbar__actions">
            {isAdmin ? (
              <button
                className="btn btn--primary users-add"
                type="button"
                onClick={openAdd}
                disabled={loading}
              >
                <PlusIcon className="users-add__icon" />
                Tambah user
              </button>
            ) : null}
            <div className="user">
              <span className="avatar avatar--blue" aria-hidden="true">
                {initials(session.name)}
              </span>
              <span className="user__text">
                <strong>{session.name}</strong>
                <span>{session.role}</span>
              </span>
            </div>
          </div>
        </header>

        {!isAdmin ? (
          <div className="users-denied">
            <span className="users-denied__icon" aria-hidden="true">
              <AlertIcon />
            </span>
            <h2>Akses ditolak</h2>
            <p>
              Hanya Admin yang boleh mengelola user. Menu ini tidak tersedia untuk role{' '}
              {session.role}.
            </p>
            <Link className="btn btn--primary" to="/dashboard">
              <ChevronLeftIcon className="users-denied__back" />
              Kembali ke Dashboard
            </Link>
          </div>
        ) : loading ? (
          <div className="users-table-card users-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div className="users-skeleton__row" key={row}>
                <span className="skeleton users-skeleton__name" />
                <span className="skeleton users-skeleton__username" />
                <span className="skeleton users-skeleton__role" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="users-table-card users-desktop">
              <table className="users-table">
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Username</th>
                    <th scope="col">Role</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={highlightId === user.id ? 'is-highlighted' : undefined}
                    >
                      <td>
                        <span className="users-name">{user.name}</span>
                        {isYou(user) ? <span className="users-me">Anda</span> : null}
                      </td>
                      <td className="users-username">@{user.username}</td>
                      <td>
                        <span className={`users-role users-role--${user.role.toLowerCase()}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="users-actions">
                        <button
                          className="users-action"
                          type="button"
                          onClick={() => openEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          className={`users-action users-action--danger${isYou(user) ? ' is-muted' : ''}`}
                          type="button"
                          onClick={() => openDelete(user)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="users-cards users-mobile">
              {users.map((user) => (
                <article
                  key={user.id}
                  className={`users-card${highlightId === user.id ? ' is-highlighted' : ''}`}
                >
                  <div className="users-card__head">
                    <div>
                      <strong>
                        {user.name}
                        {isYou(user) ? <span className="users-me">Anda</span> : null}
                      </strong>
                      <span>@{user.username}</span>
                    </div>
                    <span className={`users-role users-role--${user.role.toLowerCase()}`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="users-card__actions">
                    <button className="btn btn--ghost users-card__btn" type="button" onClick={() => openEdit(user)}>
                      Edit
                    </button>
                    <button
                      className={`btn btn--ghost users-card__btn${isYou(user) ? ' is-muted' : ''}`}
                      type="button"
                      onClick={() => openDelete(user)}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = item.to === '/users'
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`bottom-nav__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="bottom-nav__icon" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {modal ? (
        <div
          className="users-scrim"
          onClick={() => {
            if (!saving) closeModal()
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
            tabIndex={-1}
            ref={modalRef}
            onClick={(event) => event.stopPropagation()}
          >
            {deleteUser ? (
              <>
                <span className="users-modal__danger-icon" aria-hidden="true">
                  <TrashIcon />
                </span>
                <h2 id="users-modal-title">Hapus user {deleteUser.name}?</h2>
                <p>
                  {deleteUser.name} tidak bisa login lagi. Riwayat inspeksinya tetap
                  tersimpan.
                </p>
                <div className="users-modal__actions">
                  <button className="btn btn--ghost" type="button" onClick={closeModal}>
                    Batal
                  </button>
                  <button className="btn btn--danger" type="button" onClick={confirmDelete}>
                    Hapus user
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="users-modal-title">{addOpen ? 'Tambah user' : 'Edit user'}</h2>
                <p>
                  {addOpen
                    ? 'Isi data akun baru.'
                    : `Ubah data akun ${editUser?.name ?? ''}.`}
                </p>

                {modalError ? (
                  <p className="users-modal__error" role="alert">
                    <AlertIcon className="users-modal__error-icon" />
                    {modalError}
                  </p>
                ) : null}

                <form className="users-form" onSubmit={handleSubmit} noValidate>
                  <label className="users-field" htmlFor="user-name">
                    <span>Nama lengkap</span>
                    <input
                      id="user-name"
                      className={errors.name ? 'is-invalid' : ''}
                      type="text"
                      value={form.name}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, name: event.target.value }))
                        if (errors.name) setErrors((current) => ({ ...current, name: undefined }))
                      }}
                      placeholder="Nama lengkap"
                      disabled={saving}
                      aria-invalid={errors.name ? true : undefined}
                    />
                    {errors.name ? <em>{errors.name}</em> : null}
                  </label>

                  <label className="users-field" htmlFor="user-username">
                    <span>Username</span>
                    <input
                      id="user-username"
                      className={errors.username ? 'is-invalid' : ''}
                      type="text"
                      value={form.username}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, username: event.target.value }))
                        if (errors.username)
                          setErrors((current) => ({ ...current, username: undefined }))
                      }}
                      placeholder="mis. dewi"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={saving}
                      aria-invalid={errors.username ? true : undefined}
                    />
                    {errors.username ? <em>{errors.username}</em> : null}
                  </label>

                  <label className="users-field" htmlFor="user-role">
                    <span>Role</span>
                    <div className="users-select">
                      <select
                        id="user-role"
                        value={form.role}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, role: event.target.value as Role }))
                        }
                        disabled={saving}
                      >
                        <option value="Operator">Operator</option>
                        <option value="Manajemen">Manajemen</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <ChevronDownIcon className="users-select__icon" />
                    </div>
                  </label>

                  <label className="users-field" htmlFor="user-password">
                    <span>{addOpen ? 'Password' : 'Password baru (opsional)'}</span>
                    <input
                      id="user-password"
                      className={errors.password ? 'is-invalid' : ''}
                      type="password"
                      value={form.password}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, password: event.target.value }))
                        if (errors.password)
                          setErrors((current) => ({ ...current, password: undefined }))
                      }}
                      placeholder={addOpen ? 'Minimal 8 karakter' : 'Kosongkan jika tidak diubah'}
                      autoComplete="new-password"
                      disabled={saving}
                      aria-invalid={errors.password ? true : undefined}
                    />
                    {errors.password ? <em>{errors.password}</em> : null}
                    {addOpen && !errors.password ? (
                      <small>Minimal 8 karakter.</small>
                    ) : null}
                    {!addOpen && !errors.password ? (
                      <small>Isi hanya jika ingin mengganti password.</small>
                    ) : null}
                  </label>

                  <div className="users-modal__actions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Batal
                    </button>
                    <button className="btn btn--primary" type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="users-spinner" aria-hidden="true" />
                          Menyimpan…
                        </>
                      ) : addOpen ? (
                        'Simpan'
                      ) : (
                        'Simpan perubahan'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`users-toast users-toast--${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          {toast.kind === 'success' ? (
            <CheckIcon className="users-toast__icon" />
          ) : (
            <AlertIcon className="users-toast__icon" />
          )}
          <span>{toast.text}</span>
        </div>
      ) : null}
    </div>
  )
}
