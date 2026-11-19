import { request } from './api'
import type { Label } from './inspections'

export interface DefectSlice {
  label: Exclude<Label, null>
  count: number
}

export interface TrendPoint {
  date: string
  clean: number
  defect: number
}

export interface DashboardData {
  total: number
  cacat: number
  tidakCacat: number
  reviewManual: number
  defects: DefectSlice[]
  trend: TrendPoint[]
}

interface DashboardDto {
  total: number
  cacat: number
  tidak_cacat: number
  review_manual: number
  defects: { label: string; count: number }[]
  trend: TrendPoint[]
}

const LABEL_DISPLAY: Record<string, Exclude<Label, null>> = {
  penyok: 'Penyok',
  robek: 'Robek',
  label_rusak: 'Label rusak',
}

export async function fetchDashboard(start: string, end: string): Promise<DashboardData> {
  const params = new URLSearchParams()
  if (start) params.set('start_date', start)
  if (end) params.set('end_date', end)
  const dto = await request<DashboardDto>(`/api/dashboard?${params.toString()}`)
  return {
    total: dto.total,
    cacat: dto.cacat,
    tidakCacat: dto.tidak_cacat,
    reviewManual: dto.review_manual,
    defects: dto.defects.map((item) => ({
      label: LABEL_DISPLAY[item.label] ?? 'Penyok',
      count: item.count,
    })),
    trend: dto.trend,
  }
}
