import { API_BASE, ApiError, request } from './api'
import { formatBytes, splitWibTimestamp } from './format'

export type Result = 'Cacat' | 'Tidak cacat' | null
export type Status = 'Final' | 'Perlu review' | 'Sudah direview'
export type Label = 'Penyok' | 'Robek' | 'Label rusak' | null
export type Source = 'Upload file' | 'Kamera'

export interface Inspection {
  id: string
  date: string
  time: string
  label: Label
  confidence: number
  result: Result
  status: Status
  operator: string
  source: Source
  file: string
  fileSize: string
  imageUrl: string
  boundingBox: BoundingBox | null
  reviewDecision?: 'Cacat' | 'Tidak cacat'
  reviewNote?: string
}

export interface BoundingBox {
  x: number
  y: number
  lebar: number
  tinggi: number
}

/** Bentuk mentah dari API, snake_case sesuai kontrak backend. */
export interface InspectionDto {
  id: number
  display_id: string
  timestamp: string
  label: 'penyok' | 'robek' | 'label_rusak' | null
  confidence: number
  result: Result
  status: Status
  operator: string
  source: 'UPLOAD' | 'KAMERA'
  file: string
  file_size: number
  image_url: string
  bounding_box: BoundingBox | null
  review_decision: 'CACAT' | 'TIDAK_CACAT' | null
  review_note: string | null
}

export const LABEL_DISPLAY: Record<Exclude<InspectionDto['label'], null>, Exclude<Label, null>> = {
  penyok: 'Penyok',
  robek: 'Robek',
  label_rusak: 'Label rusak',
}

const SOURCE_DISPLAY: Record<InspectionDto['source'], Source> = {
  UPLOAD: 'Upload file',
  KAMERA: 'Kamera',
}

const DECISION_DISPLAY: Record<'CACAT' | 'TIDAK_CACAT', 'Cacat' | 'Tidak cacat'> = {
  CACAT: 'Cacat',
  TIDAK_CACAT: 'Tidak cacat',
}

/** Konversi DTO API ke bentuk yang dipakai komponen. Satu-satunya titik konversi. */
export function toInspection(dto: InspectionDto): Inspection {
  const { date, time } = splitWibTimestamp(dto.timestamp)
  return {
    id: dto.display_id,
    date,
    time,
    label: dto.label ? LABEL_DISPLAY[dto.label] : null,
    confidence: Math.round(dto.confidence * 100),
    result: dto.result,
    status: dto.status,
    operator: dto.operator,
    source: SOURCE_DISPLAY[dto.source],
    file: dto.file,
    fileSize: formatBytes(dto.file_size),
    imageUrl: `${API_BASE}${dto.image_url}`,
    boundingBox: dto.bounding_box,
    ...(dto.review_decision
      ? { reviewDecision: DECISION_DISPLAY[dto.review_decision] }
      : {}),
    ...(dto.review_note ? { reviewNote: dto.review_note } : {}),
  }
}

export interface HistoryFilters {
  start: string
  end: string
  status: '' | Status
  label: '' | Exclude<Label, null>
}

export interface HistoryPage {
  data: Inspection[]
  total: number
  page: number
  pageCount: number
}

interface HistoryResponse {
  data: InspectionDto[]
  total: number
  page: number
  page_size: number
  page_count: number
}

const STATUS_API: Record<Exclude<HistoryFilters['status'], ''>, string> = {
  Final: 'final',
  'Perlu review': 'review',
  'Sudah direview': 'reviewed',
}

const LABEL_API: Record<Exclude<HistoryFilters['label'], ''>, string> = {
  Penyok: 'penyok',
  Robek: 'robek',
  'Label rusak': 'label_rusak',
}

export async function fetchHistory(
  filters: HistoryFilters,
  page: number,
  pageSize: number,
): Promise<HistoryPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (filters.start) params.set('start_date', filters.start)
  if (filters.end) params.set('end_date', filters.end)
  if (filters.status) params.set('status', STATUS_API[filters.status])
  if (filters.label) params.set('label', LABEL_API[filters.label])

  const response = await request<HistoryResponse>(`/api/riwayat?${params.toString()}`)
  return {
    data: response.data.map(toInspection),
    total: response.total,
    page: response.page,
    pageCount: response.page_count,
  }
}

export async function fetchInspection(id: string): Promise<Inspection | null> {
  const numeric = Number(id.replace(/^INS-/i, ''))
  if (!Number.isInteger(numeric) || numeric <= 0) return null
  try {
    const dto = await request<InspectionDto>(`/api/riwayat/${numeric}`)
    return toInspection(dto)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const singleDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function formatSingleDate(value: string): string {
  return value ? singleDate.format(parseDate(value)) : 'Pilih tanggal'
}

export function formatDateTime(date: string, time: string): string {
  return `${shortDate.format(parseDate(date))}, ${time}`
}

export function formatLongDateTime(date: string, time: string): string {
  return `${longDate.format(parseDate(date))}, ${time}`
}

export function inspectionNumber(record: Inspection): string {
  return record.id.replace('INS-', '')
}
