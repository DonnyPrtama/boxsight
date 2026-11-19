interface IconProps {
  className?: string
}

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 34 34"
      width="34"
      height="34"
      role="img"
      aria-label="BoxSight"
    >
      <rect width="34" height="34" rx="9" fill="var(--dash-blue)" />
      <path
        d="M17 9.2 24.2 13.4 17 17.6 9.8 13.4 17 9.2Z"
        fill="none"
        stroke="#f6f7f8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 13.4v6.8l7.2 4.2 7.2-4.2v-6.8M17 17.6v6.8"
        fill="none"
        stroke="#f6f7f8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 9.5V7.2h2.3M27.4 9.5V7.2h-2.3M6.6 24.5v2.3h2.3M27.4 24.5v2.3h-2.3"
        fill="none"
        stroke="#f6f7f8"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="13.8" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="4" y="13.8" width="6.2" height="6.2" rx="1.4" />
      <rect x="13.8" y="13.8" width="6.2" height="6.2" rx="1.4" />
    </svg>
  )
}

export function ScanIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
      <path d="M12 8.8 16 11l-4 2.2L8 11l4-2.2Z" />
      <path d="M8 11v4l4 2.3 4-2.3v-4" />
    </svg>
  )
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.6 8.4V4.8m0 0h3.6M4.6 4.8l2.1 2.1" />
      <path d="M5.1 13.4a7 7 0 1 0 2.1-5.4" />
      <path d="M12 8.6V12l2.6 1.6" />
    </svg>
  )
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h6M14 7h6M4 12h10M18 12h2M4 17h3M11 17h9" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  )
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8.5" r="3.1" />
      <path d="M3.8 19.2c.4-3.1 2.5-4.8 5.2-4.8s4.8 1.7 5.2 4.8" />
      <path d="M16 5.8a3 3 0 0 1 0 5.4M17.4 14.9c2 .4 3.1 1.9 3.4 4.3" />
    </svg>
  )
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4.8H6.8A1.8 1.8 0 0 0 5 6.6v10.8a1.8 1.8 0 0 0 1.8 1.8H14" />
      <path d="M17 8.2 20.8 12 17 15.8M10 12h10.5" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m7 9.5 5 5 5-5" />
    </svg>
  )
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />
    </svg>
  )
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m12 3.8 8 4.3-8 4.3-8-4.3 8-4.3Z" />
      <path d="m4 12 8 4.3 8-4.3M4 16.1l8 4.3 8-4.3" />
    </svg>
  )
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.2 21 19.4H3L12 4.2Z" />
      <path d="M12 9.2v4.3" />
      <circle cx="12" cy="16.4" r=".8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m8.2 12.2 2.6 2.6 5-5.4" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3 1.9" />
    </svg>
  )
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 15.5V4.2M7.8 8.4 12 4.2l4.2 4.2" />
      <path d="M4.2 15.2v2.6a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-2v-2.6" />
    </svg>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.2h3l1.4-2.4h7.2L17 8.2h3v10.4H4V8.2Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.8" y="4.8" width="16.4" height="14.4" rx="2" />
      <circle cx="9" cy="9.6" r="1.5" />
      <path d="m4.5 17 4.8-4.6 3.4 3.1 2.7-2.5 4.1 4" />
    </svg>
  )
}

export function RotateIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.8 8.6V4.9m0 0h3.7M4.8 4.9l2.1 2.1a7 7 0 1 1-1.7 7.1" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 6.8h15M9.2 4.2h5.6M7.2 6.8l.8 13h8l.8-13M10 10.2v6M14 10.2v6" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.2v10.4M7.8 10.4l4.2 4.2 4.2-4.2" />
      <path d="M4.2 16.2v1.8a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-2v-1.8" />
    </svg>
  )
}

export function FilterIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.6 5.4h16.8l-6.5 7.4v5.8l-3.8 2v-7.8L3.6 5.4Z" />
    </svg>
  )
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </svg>
  )
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  )
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.8" y="5.4" width="16.4" height="14.8" rx="2" />
      <path d="M8 3.4v4M16 3.4v4M3.8 9.6h16.4" />
    </svg>
  )
}

export function BoxIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="28" height="28">
      <path d="m12 4 7 4v8l-7 4-7-4V8l7-4Z" />
      <path d="m5 8 7 4 7-4M12 12v8" />
    </svg>
  )
}
