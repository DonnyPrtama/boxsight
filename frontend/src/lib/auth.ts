import { ApiError, request } from './api'
import {
  clearSession,
  readSession,
  writeSession,
  type Role,
  type Session,
} from './session'

export type { Role, Session }
export { consumeExpiredFlag } from './session'

export class AuthError extends Error {
  constructor(message = 'Username atau password salah') {
    super(message)
    this.name = 'AuthError'
  }
}

interface LoginResponse {
  token: string
  username: string
  name: string
  role: Role
  expiresAt: number
}

export async function signIn(username: string, password: string): Promise<Session> {
  try {
    const data = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username: username.trim(), password },
      auth: false,
    })
    const session: Session = {
      token: data.token,
      username: data.username,
      name: data.name,
      role: data.role,
      expiresAt: data.expiresAt,
    }
    writeSession(session)
    window.sessionStorage.removeItem('boxsight.session-expired')
    return session
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new AuthError()
    throw error
  }
}

export function getSession(): Session | null {
  return readSession()
}

export function signOut(): void {
  clearSession()
}
