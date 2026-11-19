const sizeFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

export const WIB_TIME_ZONE = 'Asia/Jakarta'

function toInputDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Rentang 7 hari terakhir, termasuk hari ini. */
export function defaultPeriodRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return { start: toInputDate(start), end: toInputDate(end) }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${sizeFormat.format(bytes / 1024 / 1024)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const wibDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: WIB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const wibTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Pecah timestamp ISO menjadi tanggal `YYYY-MM-DD` dan jam `HH.MM` versi WIB. */
export function splitWibTimestamp(iso: string): { date: string; time: string } {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
  return {
    date: wibDate.format(parsed),
    time: wibTime.format(parsed).replace(':', '.'),
  }
}
