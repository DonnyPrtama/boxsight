import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getSession, signOut, type Session } from '../lib/auth'
import {
  fetchInspection,
  formatLongDateTime,
  inspectionNumber,
  type Inspection,
} from '../lib/inspections'
import { InspectionPlate } from '../components/InspectionPlate'
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  GridIcon,
  HistoryIcon,
  LogoMark,
  LogoutIcon,
  ScanIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'
import './Detail.css'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Detail() {
  const session = getSession()
  if (!session) return null
  if (session.role === 'Admin') return <Navigate to="/dashboard" replace />
  return <DetailWorkspace session={session} />
}

function DetailWorkspace({ session }: { session: Session }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<Inspection | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchInspection(id ?? '')
      .then((record) => {
        if (!cancelled) setRecord(record)
      })
      .catch(() => {
        if (!cancelled) setRecord(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const navItems =
    session.role === 'Manajemen'
      ? [
          { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
          { label: 'Riwayat', to: '/history', icon: HistoryIcon },
        ]
      : [
          { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
          { label: 'Deteksi', to: '/detection', icon: ScanIcon },
          { label: 'Riwayat', to: '/history', icon: HistoryIcon },
        ]

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard detail-page">
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
            const active = item.to === '/history'
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
        <Link className="detail-back" to="/history">
          <ChevronLeftIcon className="detail-back__icon" />
          Kembali ke Riwayat
        </Link>

        {loading ? (
          <DetailSkeleton />
        ) : !record ? (
          <div className="detail-missing">
            <span className="detail-missing__icon" aria-hidden="true">
              <HistoryIcon />
            </span>
            <h1>Inspeksi tidak ditemukan</h1>
            <p>ID tidak ada atau datanya sudah dihapus.</p>
            <Link className="btn btn--primary detail-missing__button" to="/history">
              Kembali ke Riwayat
            </Link>
          </div>
        ) : (
          <>
            <header className="topbar detail-topbar">
              <div className="detail-heading">
                <h1>Inspeksi #{inspectionNumber(record)}</h1>
                <StatusBadge record={record} />
                <p>Detail inspeksi kemasan</p>
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

            {record.status === 'Perlu review' ? (
              <div className="detail-warning" role="status">
                <AlertIcon className="detail-warning__icon" />
                <span>Hasil ini belum direview. Review manual dilakukan di halaman Deteksi.</span>
              </div>
            ) : null}

            <DetailContent record={record} />
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = item.to === '/history'
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

function DetailContent({ record }: { record: Inspection }) {
  const pending = record.status === 'Perlu review'
  const reviewed = record.status === 'Sudah direview'
  const clean = record.result === 'Tidak cacat'
  const defect = Boolean(record.label)
  const tone = pending ? 'review' : clean ? 'clean' : 'defect'
  const decision = record.reviewDecision ?? (record.result === 'Tidak cacat' ? 'Tidak cacat' : 'Cacat')

  return (
    <div className="detail-grid">
      <article className="detail-panel detail-image-card">
        <header className="detail-panel__head">
          <div>
            <h2>Gambar</h2>
            <p>{record.file}</p>
          </div>
          <span className="detail-source">{record.source}</span>
        </header>
        <InspectionPlate
          imageUrl={record.imageUrl}
          bbox={record.boundingBox}
          defect={defect}
          label={record.label}
          confidence={record.confidence}
          tone={tone}
        />
        {clean ? (
          <p className="detail-image-note">
            <CheckIcon className="detail-image-note__icon" />
            Tidak ada cacat terdeteksi pada gambar ini.
          </p>
        ) : null}
      </article>

      <div className="detail-side">
        <article className="detail-panel">
          <h2>Info inspeksi</h2>
          <dl className="detail-kv">
            <div>
              <dt>Waktu</dt>
              <dd>{formatLongDateTime(record.date, record.time)}</dd>
            </div>
            <div>
              <dt>Operator</dt>
              <dd>{record.operator}</dd>
            </div>
            <div>
              <dt>Sumber</dt>
              <dd>{record.source}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>
                {record.file} · {record.fileSize}
              </dd>
            </div>
          </dl>
        </article>

        <article className="detail-panel">
          <h2>Hasil deteksi</h2>
          <dl className="detail-kv">
            <div>
              <dt>Hasil</dt>
              <dd>
                <ResultBadge record={record} />
              </dd>
            </div>
            <div>
              <dt>Label</dt>
              <dd>{record.label ?? 'Tidak ada cacat terdeteksi'}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd className="detail-confidence">{record.confidence}%</dd>
            </div>
          </dl>
        </article>

        {reviewed ? (
          <article className="detail-panel">
            <h2>Hasil review manual</h2>
            <dl className="detail-kv">
              <div>
                <dt>Keputusan</dt>
                <dd>
                  <span className={`detail-pill detail-pill--${decision === 'Cacat' ? 'defect' : 'clean'}`}>
                    {decision}
                  </span>
                </dd>
              </div>
              <div className="detail-kv__stacked">
                <dt>Catatan</dt>
                <dd>
                  <span className="detail-note">
                    {record.reviewNote ?? 'Tidak ada catatan tambahan.'}
                  </span>
                </dd>
              </div>
            </dl>
          </article>
        ) : null}
      </div>
    </div>
  )
}

function StatusBadge({ record }: { record: Inspection }) {
  const tone =
    record.status === 'Perlu review'
      ? 'review'
      : record.status === 'Sudah direview'
        ? 'done'
        : 'neutral'
  return <span className={`detail-pill detail-pill--${tone}`}>{record.status}</span>
}

function ResultBadge({ record }: { record: Inspection }) {
  if (record.status === 'Perlu review' || !record.result) {
    return <span className="detail-pill detail-pill--neutral">Belum diputuskan</span>
  }
  const tone = record.result === 'Cacat' ? 'defect' : 'clean'
  return (
    <>
      <span className={`detail-pill detail-pill--${tone}`}>{record.result}</span>
      {record.status === 'Sudah direview' ? (
        <span className="detail-review-suffix"> (hasil review)</span>
      ) : null}
    </>
  )
}

function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden="true">
      <div className="skeleton detail-skeleton__title" />
      <div className="skeleton detail-skeleton__subtitle" />
      <div className="detail-grid">
        <div className="detail-panel">
          <div className="skeleton detail-skeleton__image" />
        </div>
        <div className="detail-side">
          <div className="detail-panel">
            <div className="skeleton detail-skeleton__row" />
            <div className="skeleton detail-skeleton__row" />
            <div className="skeleton detail-skeleton__row" />
          </div>
          <div className="detail-panel">
            <div className="skeleton detail-skeleton__row" />
            <div className="skeleton detail-skeleton__row" />
          </div>
        </div>
      </div>
    </div>
  )
}
