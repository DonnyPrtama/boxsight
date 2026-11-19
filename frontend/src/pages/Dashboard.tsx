import { useEffect, useState, type FormEvent, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getSession, signOut, type Role } from '../lib/auth'
import { fetchDashboard, type DashboardData } from '../lib/dashboard'
import { defaultPeriodRange } from '../lib/format'
import {
  AlertIcon,
  ArrowRightIcon,
  BoxIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  GridIcon,
  HistoryIcon,
  LayersIcon,
  LogoMark,
  LogoutIcon,
  ScanIcon,
  SettingsIcon,
  UsersIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'

type Range = { start: string; end: string }
type NavItem = { label: string; to: string; icon: ComponentType<{ className?: string }> }

const DEFAULT_RANGE: Range = defaultPeriodRange()

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  Operator: [
    { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
    { label: 'Deteksi', to: '/detection', icon: ScanIcon },
    { label: 'Riwayat', to: '/history', icon: HistoryIcon },
  ],
  Manajemen: [
    { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
    { label: 'Riwayat', to: '/history', icon: HistoryIcon },
  ],
  Admin: [
    { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
    { label: 'Pengaturan', to: '/settings', icon: SettingsIcon },
    { label: 'Kelola User', to: '/users', icon: UsersIcon },
  ],
}

const KPI_DEFS = [
  { key: 'total', label: 'Total inspeksi', note: 'dari periode', icon: LayersIcon },
  { key: 'cacat', label: 'Cacat', note: 'dari total', icon: AlertIcon },
  { key: 'tidakCacat', label: 'Tidak cacat', note: 'dari total', icon: CheckIcon },
  { key: 'reviewManual', label: 'Review manual', note: 'dari total', icon: ClockIcon },
] as const

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
const singleDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function formatRange(range: Range): string {
  const start = parseDate(range.start)
  const end = parseDate(range.end)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${shortDate.format(end).split(' ')[1]} ${end.getFullYear()}`
  }
  return `${shortDate.format(start)} – ${shortDate.format(end)} ${end.getFullYear()}`
}

function formatSingleDate(value: string): string {
  return value ? singleDate.format(parseDate(value)) : 'Pilih tanggal'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}


export default function Dashboard() {
  const navigate = useNavigate()
  const session = getSession()
  const [draft, setDraft] = useState<Range>(DEFAULT_RANGE)
  const [applied, setApplied] = useState<Range>(DEFAULT_RANGE)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    fetchDashboard(applied.start, applied.end)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((error) => {
        if (cancelled) return
        setData(null)
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Gagal memuat data dashboard. Periksa koneksi lalu coba lagi.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [applied, reloadToken])

  if (!session) return null

  const navItems = NAV_BY_ROLE[session.role]
  const missingDates = !draft.start || !draft.end
  const outOfOrder = !missingDates && draft.start > draft.end
  const invalid = missingDates || outOfOrder
  const periodError = outOfOrder
    ? 'Tanggal mulai tidak boleh setelah tanggal akhir.'
    : missingDates
      ? 'Lengkapi tanggal mulai dan akhir.'
      : ''
  const empty = !loading && data !== null && data.total === 0
  const isOperator = session.role === 'Operator'
  const userInitials = initials(session.name)

  function runQuery(next: Range) {
    setApplied(next)
  }

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (invalid || loading) return
    runQuery(draft)
  }

  function handleReset() {
    const next = defaultPeriodRange()
    setDraft(next)
    runQuery(next)
  }

  function handleDateChange(key: 'start' | 'end', value: string) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (next.start && next.end && next.start <= next.end) {
      runQuery(next)
    }
  }

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard">
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
            <span className="avatar avatar--sidebar">{userInitials}</span>
            <div className="account__text">
              <strong>{session.name}</strong>
              <span>{session.role}</span>
            </div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navigasi utama">
          <p className="side-nav__label">MENU</p>
          {navItems.map((item) => {
            const active = item.to === '/dashboard'
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
          <div className="sidebar__period">
            <span>Periode</span>
            <strong>{formatRange(applied)}</strong>
          </div>
          <button className="sidebar__out" type="button" onClick={handleSignOut}>
            <LogoutIcon className="sidebar__out-icon" />
            Keluar
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__titles">
            <h1>Dashboard</h1>
            <p>Ringkasan inspeksi kemasan · {formatRange(applied)}</p>
          </div>

          <div className="user">
            <span className="avatar avatar--blue" aria-hidden="true">
              {userInitials}
            </span>
            <span className="user__text">
              <strong>{session.name}</strong>
              <span>{session.role}</span>
            </span>
          </div>
        </header>

        <form className="filters" onSubmit={handleApply} noValidate>
          <label className="date-field" htmlFor="period-start">
            <span>Tanggal mulai</span>
            <div className={`date-control${invalid ? ' is-invalid' : ''}`}>
              <input
                id="period-start"
                className="date-control__input"
                type="date"
                value={draft.start}
                onChange={(event) => handleDateChange('start', event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                aria-invalid={invalid || undefined}
                aria-describedby={periodError ? 'period-error' : undefined}
              />
              <span className="date-control__value" aria-hidden="true">
                {formatSingleDate(draft.start)}
              </span>
              <CalendarIcon className="date-control__icon" />
            </div>
          </label>
          <label className="date-field" htmlFor="period-end">
            <span>Tanggal akhir</span>
            <div className={`date-control${invalid ? ' is-invalid' : ''}`}>
              <input
                id="period-end"
                className="date-control__input"
                type="date"
                value={draft.end}
                onChange={(event) => handleDateChange('end', event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                aria-invalid={invalid || undefined}
                aria-describedby={periodError ? 'period-error' : undefined}
              />
              <span className="date-control__value" aria-hidden="true">
                {formatSingleDate(draft.end)}
              </span>
              <CalendarIcon className="date-control__icon" />
            </div>
          </label>
          <div className="filters__actions">
            <button className="btn btn--primary" type="submit" disabled={invalid || loading}>
              {loading ? 'Memuat…' : 'Terapkan'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={handleReset} disabled={loading}>
              Reset
            </button>
          </div>
          {periodError ? (
            <p className="filters__error" id="period-error" role="alert">
              <AlertIcon className="filters__error-icon" />
              {periodError}
            </p>
          ) : null}
        </form>

        <p className="sr-only" role="status">
          {loading
            ? 'Memuat data dashboard.'
            : empty
              ? 'Tidak ada inspeksi pada periode ini.'
              : 'Data dashboard dimuat.'}
        </p>

        <div
          className={`workspace__data${invalid ? ' is-dimmed' : ''}`}
          aria-busy={loading}
        >
          {loadError ? (
            <section className="empty-state" role="alert">
              <span className="empty-state__icon" aria-hidden="true">
                <AlertIcon />
              </span>
              <h2>Gagal memuat data dashboard</h2>
              <p>{loadError}</p>
              <div className="empty-state__actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                >
                  Coba lagi
                </button>
              </div>
            </section>
          ) : loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <section className="kpis" aria-label="Ringkasan inspeksi">
                {KPI_DEFS.map((item) => {
                  const Icon = item.icon
                  const value = data ? data[item.key] : 0
                  const pct = data && data.total > 0 ? Math.round((value / data.total) * 100) : 0
                  return (
                    <article className={`kpi${empty ? ' kpi--zero' : ''}`} key={item.label}>
                      <div className="kpi__head">
                        <span className="kpi__label">{item.label}</span>
                        <span className="kpi__icon" aria-hidden="true">
                          <Icon className="kpi__icon-svg" />
                        </span>
                      </div>
                      <p className="kpi__value">{empty ? 0 : value}</p>
                      <div className="kpi__meta">
                        <span className="kpi__pct">{empty ? '0%' : `${pct}%`}</span>
                        <span className="kpi__note">{item.note}</span>
                      </div>
                      <div className="kpi__meter" aria-hidden="true">
                        <span style={{ width: empty ? '0%' : `${pct}%` }} />
                      </div>
                    </article>
                  )
                })}
              </section>

              {empty || !data ? (
                <section className="empty-state" aria-live="polite">
                  <span className="empty-state__icon" aria-hidden="true">
                    <BoxIcon />
                  </span>
                  <h2>Belum ada inspeksi di periode ini</h2>
                  <p>
                    Tidak ada data untuk {formatRange(applied)}. Pilih periode lain atau mulai inspeksi
                    baru dari halaman Deteksi.
                  </p>
                  <div className="empty-state__actions">
                    {isOperator ? (
                      <Link className="btn btn--primary" to="/detection">
                        Buka Deteksi
                        <ArrowRightIcon className="empty-state__arrow" />
                      </Link>
                    ) : null}
                    <button className="btn btn--ghost" type="button" onClick={handleReset}>
                      Pakai periode default
                    </button>
                  </div>
                </section>
              ) : (
                <section className="charts" aria-label="Analitik inspeksi">
                  <DonutCard data={data} />
                  <DefectCard data={data} />
                  <TrendCard data={data} range={applied} />
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = item.to === '/dashboard'
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

function DonutCard({ data }: { data: DashboardData }) {
  const percent = (value: number) => (data.total > 0 ? (value / data.total) * 100 : 0)
  const cleanPct = percent(data.tidakCacat)
  const defectPct = percent(data.cacat)
  const reviewPct = percent(data.reviewManual)

  const legend = [
    {
      label: 'Tidak cacat',
      value: data.tidakCacat,
      pct: Math.round(cleanPct),
      color: 'var(--dash-donut-base)',
    },
    { label: 'Cacat', value: data.cacat, pct: Math.round(defectPct), color: 'var(--dash-blue)' },
    {
      label: 'Perlu review',
      value: data.reviewManual,
      pct: Math.round(reviewPct),
      color: 'var(--dash-ink)',
    },
  ]

  const cleanOffset = 25
  const defectOffset = cleanOffset - cleanPct
  const reviewOffset = defectOffset - defectPct

  return (
    <article className="card card--donut">
      <header className="card__head">
        <div>
          <h2>Proporsi hasil</h2>
          <p>
            {data.tidakCacat} tidak cacat dari {data.total} inspeksi
          </p>
        </div>
      </header>
      <div className="donut-wrap">
        <div className="donut">
          <svg
            viewBox="0 0 120 120"
            className="donut__svg"
            role="img"
            aria-label={`Donut: ${data.tidakCacat} tidak cacat, ${data.cacat} cacat, ${data.reviewManual} perlu review dari ${data.total} inspeksi.`}
          >
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="var(--dash-donut-base)"
              strokeWidth="14"
              pathLength={100}
              strokeDasharray={`${cleanPct.toFixed(2)} ${(100 - cleanPct).toFixed(2)}`}
              strokeDashoffset={cleanOffset}
            />
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="var(--dash-blue)"
              strokeWidth="14"
              pathLength={100}
              strokeDasharray={`${defectPct.toFixed(2)} ${(100 - defectPct).toFixed(2)}`}
              strokeDashoffset={defectOffset}
            />
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="var(--dash-ink)"
              strokeWidth="14"
              pathLength={100}
              strokeDasharray={`${reviewPct.toFixed(2)} ${(100 - reviewPct).toFixed(2)}`}
              strokeDashoffset={reviewOffset}
            />
          </svg>
          <div className="donut__center" aria-hidden="true">
            <strong>{data.total}</strong>
            <span>inspeksi</span>
          </div>
        </div>
        <ul className="legend">
          {legend.map((item) => (
            <li key={item.label}>
              <i className="legend__swatch" style={{ background: item.color }} aria-hidden="true" />
              <span className="legend__label">{item.label}</span>
              <strong className="legend__value">{item.value}</strong>
              <span className="legend__pct">{item.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function DefectCard({ data }: { data: DashboardData }) {
  const max = Math.max(...data.defects.map((item) => item.count), 1)
  const top = data.defects[0]
  const topPct = top && data.cacat > 0 ? Math.round((top.count / data.cacat) * 100) : 0

  return (
    <article className="card card--defects">
      <header className="card__head">
        <div>
          <h2>Jenis cacat terbanyak</h2>
          <p>{data.cacat} cacat terdeteksi pada periode ini</p>
        </div>
      </header>
      <div className="bars">
        {data.defects.map((item, index) => (
          <div className="bar" key={item.label}>
            <span className="bar__label">{item.label}</span>
            <div className="bar__track">
              <span
                className="bar__fill"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            </div>
            <span className="bar__value">{item.count}</span>
          </div>
        ))}
      </div>
      <p className="card__note">
        {top
          ? `${top.label} menyumbang ${topPct}% dari seluruh cacat.`
          : 'Belum ada cacat pada periode ini.'}
      </p>
    </article>
  )
}

const trendDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })

function TrendCard({ data, range }: { data: DashboardData; range: Range }) {
  const points = data.trend
  const count = points.length
  const peak = Math.max(...points.map((point) => Math.max(point.clean, point.defect)), 1)
  const step = peak <= 10 ? 5 : 10
  const maxY = Math.ceil(peak / step) * step

  const x = (index: number) => (count === 1 ? 50 : 2 + index * (96 / (count - 1)))
  const y = (value: number) => 100 - (value / maxY) * 100

  const cleanPoints = points.map((point, index) => ({ x: x(index), y: y(point.clean) }))
  const defectPoints = points.map((point, index) => ({ x: x(index), y: y(point.defect) }))
  const buildPath = (series: { x: number; y: number }[]) =>
    series
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ')
  const cleanPath = buildPath(cleanPoints)
  const defectPath = buildPath(defectPoints)
  const defectArea = `M${defectPoints[0].x.toFixed(2)},100 ${defectPoints
    .map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')} L${defectPoints[count - 1].x.toFixed(2)},100 Z`

  const labelIndexes =
    count <= 6
      ? points.map((_, index) => index)
      : Array.from({ length: 5 }, (_, index) => Math.round((index * (count - 1)) / 4))

  const cleanTotal = points.reduce((sum, point) => sum + point.clean, 0)
  const defectTotal = points.reduce((sum, point) => sum + point.defect, 0)

  return (
    <article className="card card--trend">
      <header className="card__head">
        <div>
          <h2>Tren inspeksi per hari</h2>
          <p>{formatRange(range)}</p>
        </div>
        <div className="legend-inline" aria-hidden="true">
          <span>
            <i className="legend__swatch" style={{ background: 'var(--dash-muted)' }} />
            Tidak cacat
          </span>
          <span>
            <i className="legend__swatch" style={{ background: 'var(--dash-blue)' }} />
            Cacat
          </span>
        </div>
      </header>
      <div
        className="trend"
        role="img"
        aria-label={`Tren inspeksi ${formatRange(range)}: ${cleanTotal} tidak cacat dan ${defectTotal} cacat.`}
      >
        <div className="trend__body">
          <div className="trend__y" aria-hidden="true">
            <span>{maxY}</span>
            <span>{Math.round(maxY / 2)}</span>
            <span>0</span>
          </div>
          <div className="trend__plot">
            <div className="trend__grid" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <svg className="trend__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={defectArea} fill="rgba(65, 61, 250, 0.07)" />
              <path
                d={cleanPath}
                fill="none"
                stroke="var(--dash-muted)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={defectPath}
                fill="none"
                stroke="var(--dash-blue)"
                strokeWidth="2.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {defectPoints.map((point, index) => (
              <span
                key={index}
                className="trend__dot"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <div className="trend__x" aria-hidden="true">
          {labelIndexes.map((index) => (
            <span key={points[index].date}>
              {trendDate.format(new Date(`${points[index].date}T00:00:00`))}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <section className="kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className="kpi kpi--skeleton" key={item}>
            <div className="skeleton skeleton--label" />
            <div className="skeleton skeleton--value" />
            <div className="skeleton skeleton--meta" />
          </div>
        ))}
      </section>
      <section className="charts" aria-hidden="true">
        <div className="card">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--donut" />
        </div>
        <div className="card">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--bars" />
        </div>
        <div className="card card--trend">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--chart" />
        </div>
      </section>
    </>
  )
}
