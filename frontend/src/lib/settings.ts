import { request } from './api'

export interface ThresholdSettings {
  value: number
  updatedAt: string
}

export const FALLBACK_THRESHOLD: ThresholdSettings = {
  value: 0.75,
  updatedAt: '',
}

interface ThresholdDto {
  value: number
  updatedAt: string
}

export async function fetchThreshold(): Promise<ThresholdSettings> {
  const dto = await request<ThresholdDto>('/api/settings/threshold')
  return { value: dto.value, updatedAt: dto.updatedAt }
}

export async function updateThreshold(value: number): Promise<ThresholdSettings> {
  const dto = await request<ThresholdDto>('/api/settings/threshold', {
    method: 'PUT',
    body: { value },
  })
  return { value: dto.value, updatedAt: dto.updatedAt }
}

export function thresholdPercent(settings: ThresholdSettings): number {
  return Math.round(settings.value * 100)
}
