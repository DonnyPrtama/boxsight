import { request } from './api'
import type { Role } from './session'

export interface ManagedUser {
  id: number
  name: string
  username: string
  role: Role
}

interface UserDto {
  id: number
  nama: string
  username: string
  role: Role
}

export interface UserPayload {
  nama: string
  username: string
  role: Role
  password?: string
}

function toManagedUser(dto: UserDto): ManagedUser {
  return { id: dto.id, name: dto.nama, username: dto.username, role: dto.role }
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const rows = await request<UserDto[]>('/api/users')
  return rows.map(toManagedUser)
}

export async function createUser(payload: UserPayload): Promise<ManagedUser> {
  const dto = await request<UserDto>('/api/users', { method: 'POST', body: payload })
  return toManagedUser(dto)
}

export async function updateUser(id: number, payload: UserPayload): Promise<ManagedUser> {
  const dto = await request<UserDto>(`/api/users/${id}`, { method: 'PUT', body: payload })
  return toManagedUser(dto)
}

export async function deleteUser(id: number): Promise<void> {
  await request<void>(`/api/users/${id}`, { method: 'DELETE' })
}
