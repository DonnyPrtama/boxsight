import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getSession, signOut, type Session } from '../lib/auth'
import { reviewDetection, uploadDetection } from '../lib/detections'
import { LABEL_DISPLAY } from '../lib/inspections'
import { FALLBACK_THRESHOLD, fetchThreshold, thresholdPercent } from '../lib/settings'
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  GridIcon,
  HistoryIcon,
  ImageIcon,
  LogoMark,
  LogoutIcon,
  RotateIcon,
  ScanIcon,
  UploadIcon,
} from '../components/DashboardIcons'
import './Dashboard.css'
import './Detection.css'

type Source = 'upload' | 'camera'
type Phase =
  | 'idle'
  | 'invalid'
  | 'file'
  | 'camera-requesting'
  | 'camera-live'
  | 'camera-denied'
  | 'camera-captured'
  | 'processing'
  | 'result'
type Decision = 'Cacat' | 'Tidak cacat'
type Tone = 'defect' | 'review' | 'clean'

interface PickedFile {
  name: string
  size: string
  url: string
  blob: File
}

interface DetectionResult {
  id?: number
  status: 'final' | 'review'
  label: string
  confidence: number
  decision?: Decision
  note?: string
  saved?: boolean
}

const MAX_BYTES = 5 * 1024 * 1024
const CAMERA_ERROR =
  'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, atau gunakan Upload file.'
const INVALID_ERROR = 'Format file harus PNG atau JPEG. Pilih file lain.'
const SIZE_ERROR = 'Ukuran file maksimal 5 MB. Pilih file yang lebih kecil.'

const NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: GridIcon },
  { label: 'Deteksi', to: '/detection', icon: ScanIcon },
  { label: 'Riwayat', to: '/history', icon: HistoryIcon },
]

const sizeFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${sizeFormat.format(bytes / 1024 / 1024)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Detection() {
  const session = getSession()
  if (!session) return null
  if (session.role !== 'Operator') return <Navigate to="/dashboard" replace />
  return <DetectionWorkspace session={session} />
}

function DetectionWorkspace({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [source, setSource] = useState<Source>('upload')
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<PickedFile | null>(null)
  const [capture, setCapture] = useState<string | null>(null)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [threshold, setThreshold] = useState(() => thresholdPercent(FALLBACK_THRESHOLD))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const cameraRequestRef = useRef(0)

  const currentImage = source === 'camera' ? capture : file?.url ?? null
  const userInitials = initials(session.name)
  const processing = phase === 'processing'

  useEffect(() => {
    let cancelled = false
    fetchThreshold()
      .then((settings) => {
        if (!cancelled) setThreshold(thresholdPercent(settings))
      })
      .catch(() => {
        // Biarkan nilai fallback; deteksi tetap bisa jalan.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'camera-live' || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => undefined)
  }, [phase])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function cancelDetection() {
  }

  function resetResultState() {
    cancelDetection()
    setResult(null)
    setDecision(null)
    setNote('')
    setReviewError('')
    setError('')
  }

  async function startCamera() {
    resetResultState()
    stopStream()
    const request = cameraRequestRef.current + 1
    cameraRequestRef.current = request
    setCapture(null)
    setPhase('camera-requesting')

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('camera-denied')
      setError(CAMERA_ERROR)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setError('')
      setPhase('camera-live')
    } catch {
      if (request !== cameraRequestRef.current) return
      setError(CAMERA_ERROR)
      setPhase('camera-denied')
    }
  }

  function selectSource(next: Source) {
    if (next === source) {
      if (next === 'upload') {
        resetResultState()
        setPhase(file ? 'file' : 'idle')
      } else if (phase === 'camera-denied' || phase === 'camera-captured') {
        void startCamera()
      }
      return
    }

    cameraRequestRef.current += 1
    stopStream()
    resetResultState()
    setSource(next)

    if (next === 'upload') {
      setCapture(null)
      setPhase(file ? 'file' : 'idle')
    } else {
      void startCamera()
    }
  }

  function acceptFile(next: File) {
    if (!['image/png', 'image/jpeg'].includes(next.type)) {
      cancelDetection()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      setFile(null)
      setResult(null)
      setError(INVALID_ERROR)
      setPhase('invalid')
      return
    }

    if (next.size > MAX_BYTES) {
      cancelDetection()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      setFile(null)
      setResult(null)
      setError(SIZE_ERROR)
      setPhase('invalid')
      return
    }

    cancelDetection()
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(next)
    objectUrlRef.current = url
    setFile({ name: next.name, size: formatBytes(next.size), url, blob: next })
    setResult(null)
    setCapture(null)
    setDecision(null)
    setNote('')
    setReviewError('')
    setError('')
    setPhase('file')
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    if (next) acceptFile(next)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const next = event.dataTransfer.files?.[0]
    if (next) acceptFile(next)
  }

  function handleDropzoneKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      fileInputRef.current?.click()
    }
  }

  async function runDetection() {
    if (processing) return

    const blob =
      source === 'camera'
        ? capture
          ? await (await fetch(capture)).blob()
          : null
        : file?.blob ?? null
    if (!blob) return

    if (source === 'camera') stopStream()
    cancelDetection()
    setResult(null)
    setDecision(null)
    setNote('')
    setReviewError('')
    setError('')
    setPhase('processing')

    try {
      const dto = await uploadDetection(
        blob,
        source === 'camera' ? 'kamera.jpg' : file?.name ?? 'gambar.jpg',
        source,
      )
      setResult({
        id: dto.id,
        status: dto.status === 'Perlu review' ? 'review' : 'final',
        label: dto.label ? LABEL_DISPLAY[dto.label] : 'Tidak ada cacat',
        confidence: Math.round(dto.confidence * 100),
      })
      setPhase('result')
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'Deteksi gagal. Periksa koneksi lalu coba lagi.',
      )
      setPhase(source === 'camera' ? 'camera-captured' : 'file')
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 960
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setCapture(canvas.toDataURL('image/jpeg', 0.9))
    setPhase('camera-captured')
  }

  function resetInspection() {
    cameraRequestRef.current += 1
    stopStream()
    cancelDetection()
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setSource('upload')
    setPhase('idle')
    setFile(null)
    setCapture(null)
    setResult(null)
    setDecision(null)
    setNote('')
    setReviewError('')
    setError('')
  }

  async function saveReview() {
    if (!result || result.status !== 'review' || result.saved || reviewSaving) return
    if (!decision) {
      setReviewError('Pilih keputusan review terlebih dahulu.')
      return
    }
    if (!result.id) {
      setReviewError('Hasil deteksi belum tersimpan di server.')
      return
    }

    setReviewSaving(true)
    setReviewError('')
    try {
      const dto = await reviewDetection(result.id, decision, note.trim())
      setResult({
        ...result,
        decision,
        note: dto.review_note ?? note.trim(),
        saved: true,
      })
    } catch (error) {
      setReviewError(
        error instanceof ApiError
          ? error.message
          : 'Gagal menyimpan review. Periksa koneksi lalu coba lagi.',
      )
    } finally {
      setReviewSaving(false)
    }
  }

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  const status = !result
    ? null
    : result.saved
      ? {
          text: `${result.decision} (hasil review)`,
          tone: (result.decision === 'Tidak cacat' ? 'clean' : 'defect') as Tone,
        }
      : result.status === 'review'
        ? { text: 'Perlu review', tone: 'review' as Tone }
        : { text: 'Cacat', tone: 'defect' as Tone }

  const bboxTone: Tone = status?.tone ?? 'defect'

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
          {NAV.map((item) => {
            const active = item.to === '/detection'
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
        <header className="topbar">
          <div className="topbar__titles">
            <h1>Deteksi cacat kemasan</h1>
            <p>
              {session.role} · {session.name}
            </p>
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

        <div className="detect">
          <section className="panel" aria-label="Gambar yang diperiksa">
            <header className="panel__head">
              <div>
                <h2>Gambar</h2>
                <p>Pilih sumber gambar kemasan</p>
              </div>
            </header>

            <div className="segmented" role="tablist" aria-label="Sumber gambar">
              <button
                className={`segmented__item${source === 'upload' ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={source === 'upload'}
                onClick={() => selectSource('upload')}
              >
                <UploadIcon className="segmented__icon" />
                Upload file
              </button>
              <button
                className={`segmented__item${source === 'camera' ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={source === 'camera'}
                onClick={() => selectSource('camera')}
              >
                <CameraIcon className="segmented__icon" />
                Kamera
              </button>
            </div>

            {error ? (
              <Notice tone="error">
                <span>{error}</span>
              </Notice>
            ) : null}

            {source === 'upload' ? (
              phase === 'idle' || phase === 'invalid' ? (
                <>
                  <div
                    className={`dropzone${dragging ? ' is-dragging' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={handleDropzoneKey}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <span className="dropzone__icon" aria-hidden="true">
                      <UploadIcon />
                    </span>
                    <p className="dropzone__title">Tarik gambar ke sini</p>
                    <p className="dropzone__copy">
                      atau <span className="dropzone__link">pilih file</span>
                    </p>
                    <p className="dropzone__hint">PNG atau JPEG · maks. 5 MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileInput}
                    tabIndex={-1}
                  />
                  <div className="panel__actions">
                    <button className="btn btn--primary" type="button" disabled>
                      Deteksi
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Preview
                    src={file?.url ?? ''}
                    alt={file ? `Pratinjau ${file.name}` : 'Pratinjau gambar kemasan'}
                    processing={processing}
                  />
                  {file ? (
                    <div className="file-meta">
                      <ImageIcon className="file-meta__icon" />
                      <div className="file-meta__text">
                        <strong>{file.name}</strong>
                        <span>{file.size}</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="panel__actions">
                    {phase === 'file' ? (
                      <>
                        <button
                          className="btn btn--ghost"
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Ganti gambar
                        </button>
                        <button className="btn btn--primary" type="button" onClick={runDetection}>
                          Deteksi
                        </button>
                      </>
                    ) : null}
                    {processing ? (
                      <button className="btn btn--primary" type="button" disabled>
                        <span className="detect-spinner" aria-hidden="true" />
                        Memproses…
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileInput}
                    tabIndex={-1}
                  />
                </>
              )
            ) : (
              <>
                {phase === 'camera-requesting' ? (
                  <div className="camera camera--requesting" aria-live="polite">
                    <span className="detect-spinner detect-spinner--dark" aria-hidden="true" />
                    <span>Menyalakan kamera…</span>
                  </div>
                ) : null}

                {phase === 'camera-denied' ? (
                  <div className="camera-blocked">
                    <span className="camera-blocked__icon" aria-hidden="true">
                      <CameraIcon />
                    </span>
                    <strong>Kamera tidak bisa diakses</strong>
                    <p>Periksa izin kamera di browser, lalu coba lagi atau gunakan upload file.</p>
                  </div>
                ) : null}

                {phase === 'camera-live' ? (
                  <div className="camera">
                    <video
                      ref={videoRef}
                      className="camera__video"
                      muted
                      playsInline
                      aria-label="Pratinjau kamera"
                    />
                    <div className="camera__hud">
                      <span className="camera__live">
                        <i aria-hidden="true" />
                        LIVE
                      </span>
                      <span className="camera__hud-label">Kamera belakang</span>
                    </div>
                    <div className="camera__corners" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <button
                      className="camera__shutter"
                      type="button"
                      onClick={capturePhoto}
                      aria-label="Ambil foto"
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                ) : null}

                {phase === 'camera-captured' || (processing && capture) || (phase === 'result' && capture) ? (
                  <>
                    <Preview
                      src={capture ?? ''}
                      alt="Foto kemasan hasil capture"
                      processing={processing}
                    />
                    <div className="file-meta">
                      <CameraIcon className="file-meta__icon" />
                      <div className="file-meta__text">
                        <strong>Foto kamera</strong>
                        <span>Diambil dari kamera belakang</span>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="panel__actions">
                  {phase === 'camera-denied' ? (
                    <>
                      <button className="btn btn--primary" type="button" onClick={() => void startCamera()}>
                        Coba lagi
                      </button>
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => selectSource('upload')}
                      >
                        Pakai upload
                      </button>
                    </>
                  ) : null}
                  {phase === 'camera-captured' ? (
                    <>
                      <button className="btn btn--ghost" type="button" onClick={() => void startCamera()}>
                        <RotateIcon className="panel__action-icon" />
                        Ulangi
                      </button>
                      <button className="btn btn--primary" type="button" onClick={runDetection}>
                        Gunakan foto
                      </button>
                    </>
                  ) : null}
                  {processing ? (
                    <button className="btn btn--primary" type="button" disabled>
                      <span className="detect-spinner" aria-hidden="true" />
                      Memproses…
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="panel panel--result" aria-label="Hasil deteksi">
            <header className="panel__head">
              <div>
                <h2>Hasil deteksi</h2>
                <p>YOLOv8 · threshold {threshold}%</p>
              </div>
            </header>

            {processing ? (
              <div className="result-processing" aria-live="polite">
                <div className="result-processing__media" aria-hidden="true">
                  <span className="result-processing__scan" />
                </div>
                <p className="result-processing__label">
                  <span className="detect-spinner detect-spinner--dark" aria-hidden="true" />
                  Memproses dengan YOLOv8…
                </p>
                <div className="skeleton skeleton--result" />
                <div className="skeleton skeleton--result skeleton--result-short" />
              </div>
            ) : phase === 'result' && result && currentImage ? (
              <div className="result">
                {result.status === 'review' && !result.saved ? (
                  <Notice tone="warn">
                    Confidence rendah ({result.confidence}% di bawah threshold {threshold}%). Perlu
                    review manual.
                  </Notice>
                ) : null}

                <div className={`result-media result-media--${bboxTone}`}>
                  <img src={currentImage} alt="Gambar kemasan hasil deteksi" />
                  <div className="result-media__bbox">
                    <span>
                      {result.label} {result.confidence}%
                    </span>
                  </div>
                </div>

                <div className="result-info">
                  <div className="result-info__row">
                    <span>Status</span>
                    <strong>
                      <span className={`pill pill--${status?.tone}`}>{status?.text}</span>
                    </strong>
                  </div>
                  <div className="result-info__row">
                    <span>Label</span>
                    <strong>{result.label}</strong>
                  </div>
                  <div className="result-info__row">
                    <span>Confidence</span>
                    <strong>{result.confidence}%</strong>
                  </div>
                  <div className="result-info__row">
                    <span>Threshold</span>
                    <strong>{threshold}%</strong>
                  </div>
                </div>

                {result.status === 'final' ? (
                  <p className="result-saved">
                    <CheckIcon className="result-saved__icon" />
                    Hasil otomatis tersimpan ke riwayat.
                  </p>
                ) : null}

                {result.saved ? (
                  <p className="result-saved">
                    <CheckIcon className="result-saved__icon" />
                    <span>
                      Review tersimpan: {result.decision}.
                      {result.note ? ` Catatan: “${result.note}”.` : ''}
                    </span>
                  </p>
                ) : null}

                {result.status === 'review' && !result.saved ? (
                  <form
                    className="review"
                    onSubmit={(event) => {
                      event.preventDefault()
                      saveReview()
                    }}
                  >
                    <h3>Review manual</h3>
                    <fieldset className="review__fieldset">
                      <legend>Keputusan akhir</legend>
                      <div className="review__options">
                        {(['Cacat', 'Tidak cacat'] as Decision[]).map((option) => (
                          <label
                            key={option}
                            className={`review__option${decision === option ? ' is-selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="decision"
                              value={option}
                              checked={decision === option}
                              onChange={() => {
                                setDecision(option)
                                setReviewError('')
                              }}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label className="review__note" htmlFor="review-note">
                      <span>Catatan (opsional)</span>
                      <textarea
                        id="review-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Tambahkan catatan hasil pemeriksaan"
                        maxLength={200}
                      />
                    </label>

                    {reviewError ? (
                      <p className="review__error" role="alert">
                        {reviewError}
                      </p>
                    ) : null}

                    <button className="btn btn--primary" type="submit">
                      Simpan review
                    </button>
                  </form>
                ) : null}

                {result.status === 'final' || result.saved ? (
                  <button className="btn btn--ghost result__new" type="button" onClick={resetInspection}>
                    Inspeksi baru
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="result-empty">
                <span className="result-empty__icon" aria-hidden="true">
                  <ScanIcon />
                </span>
                <p>Hasil tampil di sini setelah gambar diproses.</p>
                <span>Unggah atau ambil foto kemasan untuk memulai.</span>
              </div>
            )}
          </section>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {NAV.map((item) => {
          const active = item.to === '/detection'
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

function Notice({ tone, children }: { tone: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div className={`detect-notice detect-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'ok' ? (
        <CheckIcon className="detect-notice__icon" />
      ) : (
        <AlertIcon className="detect-notice__icon" />
      )}
      <div className="detect-notice__text">{children}</div>
    </div>
  )
}

function Preview({
  src,
  alt,
  processing,
}: {
  src: string
  alt: string
  processing: boolean
}) {
  return (
    <div className={`preview${processing ? ' is-processing' : ''}`}>
      {src ? <img src={src} alt={alt} /> : null}
      {processing ? <span className="preview__scan" aria-hidden="true" /> : null}
    </div>
  )
}
