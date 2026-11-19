export type Role = 'Operator' | 'Manajemen' | 'Admin'

export interface Session {
  token: string
  username: string
  name: string
  role: Role
  expiresAt: number
}

export const SESSION_KEY = 'boxsight.session'
export const EXPIRED_KEY = 'boxsight.session-expired'

export function readSession(): Session | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    if (!session.expiresAt || session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY)
      window.sessionStorage.setItem(EXPIRED_KEY, '1')
      return null
    }
    return session
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function writeSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage bisa tidak tersedia di mode privat; abaikan.
  }
}

export function markExpired(): void {
  try {
    window.sessionStorage.setItem(EXPIRED_KEY, '1')
  } catch {
    // idem
  }
}

/** Returns true once when the previous session expired, then clears the marker. */
export function consumeExpiredFlag(): boolean {
  const expired = window.sessionStorage.getItem(EXPIRED_KEY) === '1'
  window.sessionStorage.removeItem(EXPIRED_KEY)
  return expired
}
