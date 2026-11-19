import { clearSession, markExpired, readSession } from './session'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ParseMode = 'json' | 'blob' | 'none'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  parse?: ParseMode
}

function errorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length > 0) return 'Data yang dikirim tidak valid'
  return `Permintaan gagal (${status})`
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = {}
  const session = auth ? readSession() : null
  if (session) headers.Authorization = `Bearer ${session.token}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.')
  }

  if (response.status === 401 && auth) {
    clearSession()
    markExpired()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?expired=1')
    }
  }

  if (!response.ok) {
    let detail: unknown = null
    try {
      const data = (await response.json()) as { detail?: unknown }
      detail = data.detail
    } catch {
      // Respons tanpa JSON; pakai pesan generik.
    }
    throw new ApiError(response.status, errorMessage(response.status, detail))
  }

  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options)
  return response.blob()
}
