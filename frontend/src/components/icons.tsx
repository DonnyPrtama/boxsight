interface IconProps {
  className?: string
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="19" height="19" aria-hidden="true">
      <path
        d="M2.2 10s2.8-5.1 7.8-5.1S17.8 10 17.8 10s-2.8 5.1-7.8 5.1S2.2 10 2.2 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="19" height="19" aria-hidden="true">
      <path
        d="M2.2 10s2.8-5.1 7.8-5.1S17.8 10 17.8 10s-2.8 5.1-7.8 5.1S2.2 10 2.2 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.4 3.4 16.6 16.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5v4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="12.6" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 8.2v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.9" fill="currentColor" />
    </svg>
  )
}

const BARS = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2]

export function Barcode({ className }: IconProps) {
  let x = 0
  return (
    <svg
      className={className}
      viewBox="0 0 54 18"
      width="54"
      height="18"
      aria-hidden="true"
      role="presentation"
    >
      {BARS.map((width, index) => {
        const bar = (
          <rect
            key={index}
            x={x}
            y={0}
            width={width}
            height={index % 7 === 0 ? 18 : 14}
            fill="currentColor"
          />
        )
        x += width + 1.4
        return bar
      })}
    </svg>
  )
}
