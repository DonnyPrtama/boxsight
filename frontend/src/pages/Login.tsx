import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TextField } from '../components/TextField'
import { AlertIcon, Barcode, EyeIcon, EyeOffIcon, InfoIcon } from '../components/icons'
import { AuthError, consumeExpiredFlag, signIn } from '../lib/auth'
import './Login.css'

type Status = 'idle' | 'submitting'
type Banner = { kind: 'error' | 'info'; text: string } | null
type FieldErrors = { username?: string; password?: string }

const EXPIRED_MESSAGE = 'Sesi berakhir karena tidak aktif 30 menit. Silakan masuk lagi.'
const INVALID_MESSAGE = 'Username atau password salah. Periksa lalu coba lagi.'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [banner, setBanner] = useState<Banner>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const submitting = status === 'submitting'
  const credentialError = banner?.kind === 'error'

  useEffect(() => {
    const fromUrl = searchParams.get('expired') === '1'
    if (fromUrl || consumeExpiredFlag()) {
      setBanner({ kind: 'info', text: EXPIRED_MESSAGE })
      if (fromUrl) setSearchParams({}, { replace: true })
    }
    // Runs once on mount; the flag is consumed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) usernameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (banner?.kind === 'error') {
      passwordRef.current?.focus()
    }
  }, [banner])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const nextErrors: FieldErrors = {}
    if (!username.trim()) nextErrors.username = 'Username wajib diisi'
    if (!password) nextErrors.password = 'Password wajib diisi'

    setFieldErrors(nextErrors)
    if (nextErrors.username) {
      setBanner(null)
      usernameRef.current?.focus()
      return
    }
    if (nextErrors.password) {
      setBanner(null)
      passwordRef.current?.focus()
      return
    }

    setStatus('submitting')
    setBanner(null)

    try {
      await signIn(username, password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setStatus('idle')
      setBanner({
        kind: 'error',
        text:
          error instanceof AuthError
            ? INVALID_MESSAGE
            : 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.',
      })
    }
  }

  return (
    <div className="login">
      <div className="login__backdrop" aria-hidden="true">
        <img
          className="login__backdrop-img"
          src="/assets/new-login-background.svg"
          alt=""
        />
        <div className="login__backdrop-tint" />
      </div>

      <div className="login__tag" aria-hidden="true">
        <Barcode className="login__tag-code" />
        <div className="login__tag-meta">
          <span className="login__tag-id">BOX-LGN-0427</span>
          <span className="login__tag-place">GUDANG · GATE 04</span>
        </div>
      </div>

      <main className="login__panel">
        <div className={`login__inner${submitting ? ' is-submitting' : ''}`}>
          <header className="login__head">
            <img
              className="login__mark"
              src="/assets/new-boxsight_logo_blue.svg"
              alt=""
              width="64"
              height="64"
            />
            <h1 className="login__title">Sistem Deteksi Cacat Kemasan</h1>
            <p className="login__subtitle">Masuk untuk melanjutkan</p>
          </header>

          {banner ? (
            <div
              className={`banner banner--${banner.kind}`}
              role={banner.kind === 'error' ? 'alert' : 'status'}
            >
              {banner.kind === 'error' ? (
                <AlertIcon className="banner__icon" />
              ) : (
                <InfoIcon className="banner__icon" />
              )}
              <p className="banner__text">{banner.text}</p>
            </div>
          ) : null}

          <form className="login__form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <TextField
              ref={usernameRef}
              id="username"
              label="Username"
              name="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setFieldErrors((current) => ({ ...current, username: undefined }))
                if (credentialError) setBanner(null)
              }}
              placeholder="contoh: budi"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={submitting}
              invalid={credentialError}
              error={fieldErrors.username}
            />

            <TextField
              ref={passwordRef}
              id="password"
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setFieldErrors((current) => ({ ...current, password: undefined }))
                if (credentialError) setBanner(null)
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={submitting}
              invalid={credentialError}
              error={fieldErrors.password}
              trailing={
                <button
                  type="button"
                  className="field__reveal"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOffIcon className="field__reveal-icon" />
                  ) : (
                    <EyeIcon className="field__reveal-icon" />
                  )}
                </button>
              }
            />

            <button className="login__submit" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="login__spinner" aria-hidden="true" />
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <footer className="login__foot">
            <span>BoxSight · Sistem internal</span>
            <span>v0.1</span>
          </footer>
        </div>
      </main>
    </div>
  )
}
