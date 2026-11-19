import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, requestBlob } from '../lib/api'
import { getSession, signOut, type Session } from '../lib/auth'
import { defaultPeriodRange } from '../lib/format'
import {
  fetchHistory,
  formatDateTime,
  formatSingleDate,
  type Inspection,
  type Label,
  type Result,
  type Status,
} from '../lib/inspections'
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  GridIcon,
  HistoryIcon,
  LogoMark,
  LogoutIcon,
  ScanIcon,
  XIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'
import './History.css'

type FilterStatus = '' | Status
type FilterLabel = '' | Exclude<Label, null>
type ExportFormat = 'pdf' | 'xlsx'

interface Filters {
  start: string
  end: string
  status: FilterStatus
  label: FilterLabel
}

type Toast = { kind: 'success' | 'error'; text: string } | null

const DEFAULT_FILTERS: Filters = {
  ...defaultPeriodRange(),
  status: '',
  label: '',
}

const PAGE_SIZE = 5
const STATUS_OPTIONS: FilterStatus[] = ['', 'Final', 'Perlu review', 'Sudah direview']
const LABEL_OPTIONS: FilterLabel[] = ['', 'Penyok', 'Robek', 'Label rusak']

const HISTORY_STATE_KEY = 'boxsight.history-state.v2'

function readSavedHistoryState(): { applied: Filters; page: number } | null {
  try {
    const raw = window.sessionStorage.getItem(HISTORY_STATE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { applied?: Partial<Filters>; page?: number }
    if (
      !value.applied ||
      typeof value.applied.start !== 'string' ||
      typeof value.applied.end !== 'string' ||
      typeof value.applied.status !== 'string' ||
      typeof value.applied.label !== 'string'
    ) {
      return null
    }
    return {
      applied: { ...DEFAULT_FILTERS, ...value.applied },
      page: typeof value.page === 'number' && value.page > 0 ? value.page : 1,
    }
  } catch {
    return null
  }
}

function paginationItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: Array<number | 'gap'> = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap')
    result.push(page)
  })
  return result
}

export default function History() {
  const session = getSession()
  if (!session) return null
  if (session.role === 'Admin') return <Navigate to="/dashboard" replace />
  return <HistoryWorkspace session={session} />
}

function HistoryWorkspace({ session }: { session: Session }) {
  const navigate = useNavigate()
  const savedState = useMemo(() => readSavedHistoryState(), [])
  const [draft, setDraft] = useState<Filters>(savedState?.applied ?? DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(savedState?.applied ?? DEFAULT_FILTERS)
  const [page, setPage] = useState(savedState?.page ?? 1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Inspection[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [fetchError, setFetchError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportPhase, setExportPhase] = useState<'idle' | 'processing' | 'error'>('idle')
  const [toast, setToast] = useState<Toast>(null)

  const toastTimerRef = useRef<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError('')

    fetchHistory(applied, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        setRows(result.data)
        setTotal(result.total)
        setPageCount(Math.max(1, result.pageCount))
        if (result.pageCount > 0 && page > result.pageCount) setPage(result.pageCount)
      })
      .catch((error) => {
        if (cancelled) return
        setRows([])
        setTotal(0)
        setPageCount(1)
        setFetchError(
          error instanceof ApiError
            ? error.message
            : 'Gagal memuat riwayat. Periksa koneksi lalu coba lagi.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [applied, page, reloadToken])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(HISTORY_STATE_KEY, JSON.stringify({ applied, page }))
    } catch {
      // Session persistence is a convenience; ignore storage failures.
    }
  }, [applied, page])

  useEffect(() => {
    if (!exportOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    modalRef.current?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && exportPhase !== 'processing') {
        setExportOpen(false)
        setExportPhase('idle')
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [exportOpen, exportPhase])

  const missingDates = !draft.start || !draft.end
  const outOfOrder = !missingDates && draft.start > draft.end
  const invalid = missingDates || outOfOrder
  const periodError = outOfOrder
    ? 'Tanggal mulai tidak boleh setelah tanggal akhir.'
    : missingDates
      ? 'Lengkapi tanggal mulai dan akhir.'
      : ''

  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageRecords = rows
  const rangeStart = total === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + PAGE_SIZE, total)
  const activeCount = Number(Boolean(applied.status)) + Number(Boolean(applied.label))
  const hasActive = activeCount > 0

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

  function showToast(kind: 'success' | 'error', text: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast({ kind, text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4600)
  }

  function runQuery(next: Filters) {
    setApplied(next)
    setPage(1)
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (invalid || loading) return
    runQuery(draft)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const next = { ...defaultPeriodRange(), status: '', label: '' } as Filters
    setDraft(next)
    setFiltersOpen(false)
    runQuery(next)
  }

  function handleDateChange(key: 'start' | 'end', value: string) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (next.start && next.end && next.start <= next.end) {
      runQuery(next)
    }
  }

  function removeFilter(key: 'status' | 'label') {
    const next = { ...applied, [key]: '' } as Filters
    setDraft(next)
    runQuery(next)
  }

  function goToPage(next: number) {
    if (loading || next === currentPage || next < 1 || next > pageCount) return
    setPage(next)
  }

  function openExport() {
    if (loading) return
    if (total === 0) {
      showToast('error', 'Tidak ada data untuk diekspor. Ubah filter, lalu coba lagi.')
      return
    }
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast(null)
    setExportPhase('idle')
    setExportOpen(true)
  }

  function closeExport() {
    if (exportPhase === 'processing') return
    setExportOpen(false)
    setExportPhase('idle')
  }

  async function runExport() {
    if (exportPhase === 'processing') return
    setExportPhase('processing')

    const filename = exportFormat === 'pdf' ? 'Laporan_inspeksi.pdf' : 'Laporan_inspeksi.xlsx'

    try {
      const blob = await requestBlob('/api/riwayat/export', {
        method: 'POST',
        body: {
          format: exportFormat,
          filters: {
            start_date: applied.start,
            end_date: applied.end,
            ...(applied.status
              ? {
                  status:
                    applied.status === 'Final'
                      ? 'final'
                      : applied.status === 'Perlu review'
                        ? 'review'
                        : 'reviewed',
                }
              : {}),
            ...(applied.label
              ? {
                  label:
                    applied.label === 'Penyok'
                      ? 'penyok'
                      : applied.label === 'Robek'
                        ? 'robek'
                        : 'label_rusak',
                }
              : {}),
          },
        },
      })

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setExportOpen(false)
      setExportPhase('idle')
      showToast('success', `${filename} mulai diunduh.`)
    } catch {
      setExportPhase('error')
    }
  }

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  function openRecord(record: Inspection) {
    navigate(`/history/${record.id}`)
  }

  function handleRowKey(event: ReactKeyboardEvent, record: Inspection) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openRecord(record)
    }
  }

  return (
    <div className="dashboard history-page">
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
        <header className="topbar history-topbar">
          <div className="topbar__titles">
            <h1>Riwayat inspeksi</h1>
            <p>
              {session.role} · {session.name}
            </p>
          </div>
          <div className="topbar__actions">
            <button
              className="btn btn--primary history-export"
              type="button"
              onClick={openExport}
              disabled={loading}
            >
              <DownloadIcon className="history-export__icon" />
              <span className="history-export__full">Export laporan</span>
              <span className="history-export__short">Export</span>
            </button>
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

        <div className="history-filterbar">
          <button
            className={`history-filterbar__button${filtersOpen ? ' is-open' : ''}`}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="history-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <FilterIcon className="history-filterbar__icon" />
            <span>Filter</span>
            {activeCount > 0 ? <span className="history-filterbar__count">{activeCount} aktif</span> : null}
            <ChevronDownIcon className="history-filterbar__chevron" />
          </button>
        </div>

        {hasActive ? (
          <div className="history-chips">
            {applied.status ? (
              <button type="button" className="history-chip" onClick={() => removeFilter('status')}>
                Status: {applied.status}
                <XIcon className="history-chip__icon" />
              </button>
            ) : null}
            {applied.label ? (
              <button type="button" className="history-chip" onClick={() => removeFilter('label')}>
                Label: {applied.label}
                <XIcon className="history-chip__icon" />
              </button>
            ) : null}
          </div>
        ) : null}

        <form
          className={`filters history-filters${filtersOpen ? ' is-open' : ''}`}
          id="history-filters"
          onSubmit={applyFilters}
          noValidate
        >
          <label className="date-field" htmlFor="history-start">
            <span>Tanggal mulai</span>
            <div className={`date-control${invalid ? ' is-invalid' : ''}`}>
              <input
                id="history-start"
                className="date-control__input"
                type="date"
                value={draft.start}
                onChange={(event) => handleDateChange('start', event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                aria-invalid={invalid || undefined}
                aria-describedby={periodError ? 'history-period-error' : undefined}
              />
              <span className="date-control__value" aria-hidden="true">
                {formatSingleDate(draft.start)}
              </span>
              <CalendarIcon className="date-control__icon" />
            </div>
          </label>

          <label className="date-field" htmlFor="history-end">
            <span>Tanggal akhir</span>
            <div className={`date-control${invalid ? ' is-invalid' : ''}`}>
              <input
                id="history-end"
                className="date-control__input"
                type="date"
                value={draft.end}
                onChange={(event) => handleDateChange('end', event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                aria-invalid={invalid || undefined}
                aria-describedby={periodError ? 'history-period-error' : undefined}
              />
              <span className="date-control__value" aria-hidden="true">
                {formatSingleDate(draft.end)}
              </span>
              <CalendarIcon className="date-control__icon" />
            </div>
          </label>

          <label className="select-field" htmlFor="history-status">
            <span>Status</span>
            <div className="select-control">
              <select
                id="history-status"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, status: event.target.value as FilterStatus }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option value={option} key={option || 'all'}>
                    {option || 'Semua'}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="select-control__icon" />
            </div>
          </label>

          <label className="select-field" htmlFor="history-label">
            <span>Label cacat</span>
            <div className="select-control">
              <select
                id="history-label"
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, label: event.target.value as FilterLabel }))
                }
              >
                {LABEL_OPTIONS.map((option) => (
                  <option value={option} key={option || 'all'}>
                    {option || 'Semua'}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="select-control__icon" />
            </div>
          </label>

          <div className="filters__actions">
            <button className="btn btn--primary" type="submit" disabled={invalid || loading}>
              {loading ? 'Memuat…' : 'Terapkan'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={resetFilters} disabled={loading}>
              Reset
            </button>
          </div>

          {periodError ? (
            <p className="filters__error" id="history-period-error" role="alert">
              <AlertIcon className="filters__error-icon" />
              {periodError}
            </p>
          ) : null}
        </form>

        <div className="history-summary" aria-live="polite">
          <span>
            {total === 0
              ? '0 hasil'
              : `Menampilkan ${rangeStart}–${rangeEnd} dari ${total}`}
          </span>
          <span>Terbaru dulu</span>
        </div>

        {fetchError ? (
          <div className="history-empty" role="alert">
            <span className="history-empty__icon" aria-hidden="true">
              <AlertIcon />
            </span>
            <h2>Gagal memuat riwayat</h2>
            <p>{fetchError}</p>
            <button className="btn btn--primary" type="button" onClick={() => setReloadToken((value) => value + 1)}>
              Coba lagi
            </button>
          </div>
        ) : loading ? (
          <div className="history-table-card history-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((item) => (
              <div className="history-skeleton__row" key={item}>
                <span className="skeleton history-skeleton__time" />
                <span className="skeleton history-skeleton__thumb" />
                <span className="skeleton history-skeleton__wide" />
                <span className="skeleton history-skeleton__pill" />
                <span className="skeleton history-skeleton__pill" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="history-empty">
            <span className="history-empty__icon" aria-hidden="true">
              <HistoryIcon />
            </span>
            <h2>Tidak ada inspeksi yang cocok</h2>
            <p>Ubah rentang tanggal atau reset filter untuk melihat seluruh riwayat.</p>
            <button className="btn btn--primary" type="button" onClick={resetFilters}>
              Reset filter
            </button>
          </div>
        ) : (
          <>
            <div className="history-table-card history-desktop">
              <table className="history-table">
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Gambar</th>
                    <th scope="col">Label</th>
                    <th scope="col">Conf.</th>
                    <th scope="col">Hasil</th>
                    <th scope="col">Status</th>
                    <th scope="col" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="history-row"
                      tabIndex={0}
                      role="link"
                      aria-label={`Buka detail inspeksi ${record.id}`}
                      onClick={() => openRecord(record)}
                      onKeyDown={(event) => handleRowKey(event, record)}
                    >
                      <td className="history-time">{formatDateTime(record.date, record.time)}</td>
                      <td>
                        <InspectionThumb record={record} />
                      </td>
                      <td>{record.label ?? '–'}</td>
                      <td className="history-confidence">{record.confidence}%</td>
                      <td>
                        <ResultPill result={record.result} />
                      </td>
                      <td>
                        <StatusPill status={record.status} />
                      </td>
                      <td className="history-chevron" aria-hidden="true">
                        <ChevronRightIcon />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="history-cards history-mobile">
              {pageRecords.map((record) => (
                <article
                  key={record.id}
                  className="history-card"
                  tabIndex={0}
                  role="link"
                  aria-label={`Buka detail inspeksi ${record.id}`}
                  onClick={() => openRecord(record)}
                  onKeyDown={(event) => handleRowKey(event, record)}
                >
                  <InspectionThumb record={record} />
                  <div className="history-card__body">
                    <strong>{record.label ?? 'Tidak ada cacat'}</strong>
                    <span className="history-card__time">
                      {formatDateTime(record.date, record.time)} · {record.confidence}%
                    </span>
                    <div className="history-card__pills">
                      <ResultPill result={record.result} />
                      <StatusPill status={record.status} />
                    </div>
                  </div>
                  <ChevronRightIcon className="history-card__chevron" />
                </article>
              ))}
            </div>

            <div className="history-pagination">
              <span>
                Halaman {currentPage} dari {pageCount}
              </span>
              <div className="history-pages">
                <button
                  type="button"
                  className="history-page-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeftIcon />
                </button>
                {paginationItems(currentPage, pageCount).map((item, index) =>
                  item === 'gap' ? (
                    <span className="history-page-gap" key={`gap-${index}`}>
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`history-page-btn${item === currentPage ? ' is-active' : ''}`}
                      onClick={() => goToPage(item)}
                      aria-current={item === currentPage ? 'page' : undefined}
                      disabled={loading}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="history-page-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === pageCount || loading}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
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

      {exportOpen ? (
        <div
          className="history-scrim"
          onClick={() => {
            if (exportPhase !== 'processing') closeExport()
          }}
        >
          <div
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            tabIndex={-1}
            ref={modalRef}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="export-title">Export laporan</h2>
            <p>
              Mencakup {total} data sesuai filter aktif. Pilih format laporan yang
              diinginkan.
            </p>

            {exportPhase === 'error' ? (
              <p className="history-modal__error" role="alert">
                <AlertIcon className="history-modal__error-icon" />
                Gagal membuat laporan. Periksa koneksi, lalu coba lagi.
              </p>
            ) : null}

            <div className="history-export-options">
              <label
                className={`history-export-option${exportFormat === 'pdf' ? ' is-selected' : ''}${
                  exportPhase === 'processing' ? ' is-disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="export-format"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  disabled={exportPhase === 'processing'}
                  onChange={() => setExportFormat('pdf')}
                />
                <span className="history-export-option__text">
                  <strong>PDF</strong>
                  <span>Header, tabel data, dan statistik ringkasan</span>
                </span>
              </label>
              <label
                className={`history-export-option${exportFormat === 'xlsx' ? ' is-selected' : ''}${
                  exportPhase === 'processing' ? ' is-disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="export-format"
                  value="xlsx"
                  checked={exportFormat === 'xlsx'}
                  disabled={exportPhase === 'processing'}
                  onChange={() => setExportFormat('xlsx')}
                />
                <span className="history-export-option__text">
                  <strong>Excel</strong>
                  <span>Sheet data dan sheet ringkasan</span>
                </span>
              </label>
            </div>

            <div className="history-modal__actions">
              <button
                className="btn btn--ghost"
                type="button"
                onClick={closeExport}
                disabled={exportPhase === 'processing'}
              >
                Batal
              </button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={runExport}
                disabled={exportPhase === 'processing'}
              >
                {exportPhase === 'processing' ? (
                  <>
                    <span className="history-spinner" aria-hidden="true" />
                    Memproses…
                  </>
                ) : exportPhase === 'error' ? (
                  'Coba lagi'
                ) : (
                  'Export'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`history-toast history-toast--${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          {toast.kind === 'success' ? (
            <CheckIcon className="history-toast__icon" />
          ) : (
            <AlertIcon className="history-toast__icon" />
          )}
          <span>{toast.text}</span>
        </div>
      ) : null}
    </div>
  )
}

function ResultPill({ result }: { result: Result }) {
  if (!result) return <span className="history-dash">–</span>
  return (
    <span className={`pill pill--${result === 'Cacat' ? 'defect' : 'clean'}`}>{result}</span>
  )
}

function StatusPill({ status }: { status: Status }) {
  const tone = status === 'Perlu review' ? 'review' : status === 'Sudah direview' ? 'done' : 'neutral'
  return <span className={`pill pill--${tone}`}>{status}</span>
}

function InspectionThumb({ record }: { record: Inspection }) {
  const [failed, setFailed] = useState(false)
  if (!failed) {
    return (
      <img
        className="history-thumb"
        src={record.imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <svg className="history-thumb" viewBox="0 0 44 34" aria-hidden="true">
      <rect width="44" height="34" rx="5" fill="#f1f2f5" />
      <g transform="translate(9 7)">
        <path d="M13 0 26 6.5 13 13 0 6.5 13 0Z" fill="#e2e4e8" />
        <path d="M0 6.5v12L13 25V13L0 6.5Z" fill="#cfd2d8" />
        <path d="M26 6.5v12L13 25V13l13-6.5Z" fill="#bfc3cb" />
        {record.label ? (
          <path d="m7 9 4 3-2 4" fill="none" stroke="#b42318" strokeWidth="1.5" strokeLinecap="round" />
        ) : null}
      </g>
      <path d="M4 8V5h3M40 26v3h-3" stroke="#413dfa" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
