import { request } from './api'
import type { InspectionDto } from './inspections'

export type DetectionSource = 'upload' | 'camera'

const DECISION_API = {
  Cacat: 'CACAT',
  'Tidak cacat': 'TIDAK_CACAT',
} as const

export async function uploadDetection(
  image: Blob,
  filename: string,
  source: DetectionSource,
): Promise<InspectionDto> {
  const form = new FormData()
  form.append('file', image, filename)
  form.append('sumber', source)
  return request<InspectionDto>('/api/deteksi/upload', { method: 'POST', body: form })
}

export async function reviewDetection(
  inspectionId: number,
  decision: keyof typeof DECISION_API,
  note: string,
): Promise<InspectionDto> {
  return request<InspectionDto>(`/api/deteksi/${inspectionId}/review`, {
    method: 'POST',
    body: {
      keputusan: DECISION_API[decision],
      catatan: note || null,
    },
  })
}
