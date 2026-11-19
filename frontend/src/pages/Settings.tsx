import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getSession, signOut, type Session } from '../lib/auth'
import {
  FALLBACK_THRESHOLD,
  fetchThreshold,
  updateThreshold,
} from '../lib/settings'
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  GridIcon,
  HistoryIcon,
  LogoMark,
  LogoutIcon,
  ScanIcon,
  SettingsIcon,
  UsersIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'
import './Settings.css'

type Banner = { kind: 'success' | 'error'; text: string } | null

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${dateFormat.format(date)}, ${timeFormat.format(date).replace(':', '.')}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Settings() {
  const session = getSession()
  if (!session) return null
  return <SettingsWorkspace session={session} />
}

function SettingsWorkspace({ session }: { session: Session }) {
  const navigate = useNavigate()
  const isAdmin = session.role === 'Admin'
  const [savedValue, setSavedValue] = useState(FALLBACK_THRESHOLD.value)
  const [updatedAt, setUpdatedAt] = useState(FALLBACK_THRESHOLD.updatedAt)
  const [draftValue, setDraftValue] = useState(FALLBACK_THRESHOLD.value.toFixed(2))
  const [loading, setLoading] = useState(isAdmin)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    fetchThreshold()
      .then((settings) => {
        if (cancelled) return
        setSavedValue(settings.value)
        setDraftValue(settings.value.toFixed(2))
        setUpdatedAt(settings.updatedAt)
      })
      .catch(() => {
        if (cancelled) return
        setBanner({
          kind: 'error',
          text: 'Gagal memuat threshold. Periksa koneksi lalu coba lagi.',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const normalized = draftValue.trim().replace(',', '.')
  const parsed = Number(normalized)
  const valid =
    normalized.length > 0 && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
  const changed = valid
    ? Math.abs(parsed - savedValue) > 0.0001
    : normalized !== savedValue.toFixed(2)
  const sliderValue = valid ? Math.min(1, Math.max(0, parsed)) : 1
  const percent = Math.round(savedValue * 100)
  const draftPercent = valid ? Math.round(parsed * 100) : 0
  const canSave = isAdmin && valid && changed && !saving && !loading
  const canCancel = isAdmin && changed && !saving && !loading

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

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  function updateDraft(next: string) {
    setDraftValue(next)
    if (banner) setBanner(null)
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setBanner(null)
    const next = Math.round(parsed * 100) / 100

    try {
      const saved = await updateThreshold(next)
      setSavedValue(saved.value)
      setDraftValue(saved.value.toFixed(2))
      setUpdatedAt(saved.updatedAt)
      setBanner({
        kind: 'success',
        text: `Threshold diperbarui menjadi ${saved.value.toFixed(2)}. Berlaku mulai deteksi berikutnya.`,
      })
    } catch (error) {
      const denied = error instanceof ApiError && error.status === 403
      setBanner({
        kind: 'error',
        text: denied
          ? 'Akses ditolak. Hanya Admin yang boleh mengubah threshold.'
          : 'Gagal menyimpan. Periksa koneksi, lalu coba lagi.',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!canCancel) return
    setDraftValue(savedValue.toFixed(2))
    setBanner(null)
  }

  return (
    <div className="dashboard settings-page">
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
            const active = item.to === '/settings'
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
        <header className="topbar settings-topbar">
          <div className="topbar__titles">
            <h1>Pengaturan</h1>
            <p>Threshold confidence · {session.role}</p>
          </div>
          <div className="user">
            <span className="avatar avatar--blue" aria-hidden="true">
              {initials(session.name)}
            </span>
            <span className="user__text">
              <strong>{session.name}</strong>
              <span>{session.role}</span>
            </span>
          </div>
        </header>

        {!isAdmin ? (
          <div className="settings-denied">
            <span className="settings-denied__icon" aria-hidden="true">
              <AlertIcon />
            </span>
            <h2>Akses ditolak</h2>
            <p>
              Hanya Admin yang boleh mengubah threshold confidence. Menu ini tidak tersedia
              untuk role {session.role}.
            </p>
            <Link className="btn btn--primary" to="/dashboard">
              <ChevronLeftIcon className="settings-denied__back" />
              Kembali ke Dashboard
            </Link>
          </div>
        ) : (
          <article className="settings-card">
            <header className="settings-card__head">
              <h2>Threshold confidence</h2>
              <p>
                Hasil deteksi dengan confidence di bawah nilai ini ditandai perlu review
                manual.
              </p>
            </header>

            {banner ? (
              <p className={`settings-banner settings-banner--${banner.kind}`} role={banner.kind === 'success' ? 'status' : 'alert'}>
                {banner.kind === 'success' ? (
                  <CheckIcon className="settings-banner__icon" />
                ) : (
                  <AlertIcon className="settings-banner__icon" />
                )}
                {banner.text}
              </p>
            ) : null}

            {loading ? (
              <div className="settings-skeleton" aria-hidden="true">
                <div className="skeleton settings-skeleton__current" />
                <div className="skeleton settings-skeleton__input" />
                <div className="skeleton settings-skeleton__slider" />
                <div className="skeleton settings-skeleton__actions" />
              </div>
            ) : (
              <>
                <div className="settings-current">
                  <span className="settings-current__value">{savedValue.toFixed(2)}</span>
                  <div className="settings-current__meta">
                    <span>Nilai saat ini ({percent}%)</span>
                    <span>Diperbarui {formatUpdated(updatedAt)}</span>
                  </div>
                </div>

                <div className="settings-field">
                  <label htmlFor="threshold-input">Nilai baru</label>
                  <div className="settings-field__row">
                    <input
                      id="threshold-input"
                      className={`settings-input${valid ? '' : ' is-invalid'}`}
                      type="text"
                      inputMode="decimal"
                      value={draftValue}
                      onChange={(event) => updateDraft(event.target.value)}
                      disabled={saving}
                      aria-invalid={!valid || undefined}
                      aria-describedby={valid ? 'threshold-help' : 'threshold-help threshold-error'}
                    />
                    <span className="settings-hint">
                      {valid ? `= ${draftPercent}%` : '0.0 – 1.0'}
                    </span>
                    {valid && changed ? <span className="settings-chip">Belum disimpan</span> : null}
                  </div>
                  <p className="settings-help" id="threshold-help">
                    Gunakan titik desimal, misalnya 0.75.
                  </p>
                  {!valid ? (
                    <p className="settings-error" id="threshold-error" role="alert">
                      Masukkan angka antara 0.0 dan 1.0.
                    </p>
                  ) : null}
                </div>

                <div className="settings-slider-block">
                  <div className="settings-slider-wrap">
                    <div
                      className={`settings-slider-track${valid ? '' : ' is-disabled'}`}
                      style={{ '--p': `${sliderValue * 100}%` } as CSSProperties}
                    />
                    <input
                      className="settings-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={sliderValue}
                      onChange={(event) => updateDraft(Number(event.target.value).toFixed(2))}
                      disabled={saving || !valid || loading}
                      aria-label="Threshold confidence"
                    />
                  </div>
                  <div className="settings-zones">
                    <span className="settings-zones__review">Perlu review manual</span>
                    <span className="settings-zones__final">Hasil final</span>
                  </div>
                  <div className="settings-scale">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>

                <div className="settings-actions">
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                  >
                    {saving ? (
                      <>
                        <span className="settings-spinner" aria-hidden="true" />
                        Menyimpan…
                      </>
                    ) : (
                      'Simpan'
                    )}
                  </button>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={handleCancel}
                    disabled={!canCancel}
                  >
                    Batalkan
                  </button>
                </div>
              </>
            )}

            <p className="settings-info">
              Threshold baru dipakai mulai deteksi berikutnya. Hasil inspeksi yang sudah ada
              tidak berubah.
            </p>
          </article>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = item.to === '/settings'
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
    </div>
  )
}
