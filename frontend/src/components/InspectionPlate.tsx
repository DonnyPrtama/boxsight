import { useState } from 'react'
import type { BoundingBox, Label } from '../lib/inspections'

interface InspectionPlateProps {
  imageUrl: string
  bbox: BoundingBox | null
  defect: boolean
  label: Label
  confidence: number
  tone: 'defect' | 'review' | 'clean'
}

export function InspectionPlate({
  imageUrl,
  bbox,
  defect,
  label,
  confidence,
  tone,
}: InspectionPlateProps) {
  const [failed, setFailed] = useState(false)
  const box =
    !failed && bbox && defect
      ? {
          left: `${bbox.x * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.lebar * 100}%`,
          height: `${bbox.tinggi * 100}%`,
        }
      : null

  return (
    <div
      className="inspection-plate"
      role="img"
      aria-label={
        defect && label
          ? `Gambar kemasan dengan kotak deteksi ${label} ${confidence}%`
          : 'Gambar kemasan tanpa cacat terdeteksi'
      }
    >
      <div className={`inspection-plate__frame${failed ? ' is-fallback' : ''}`}>
        {failed ? (
          <svg
            className="inspection-plate__art inspection-plate__art--fallback"
            viewBox="0 0 800 600"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <rect width="800" height="600" fill="#eef0f3" />
            <g stroke="#e3e5ea" strokeWidth="1.5" opacity="0.8">
              <path d="M0 455h800M0 490h800M0 525h800M0 560h800" />
              <path d="M100 455v145M250 455v145M400 455v145M550 455v145M700 455v145" />
            </g>
            <ellipse cx="400" cy="505" rx="208" ry="32" fill="#d8dbe1" opacity="0.7" />
            <g>
              <path d="M190 300 400 210l210 90-210 90-210-90Z" fill="#e3e5e9" />
              <path d="M190 300v140l210 90V390L190 300Z" fill="#cfd2d8" />
              <path d="M610 300v140l-210 90V390l210-90Z" fill="#bcc0c9" />
              <path d="M400 210v-8l210 90v8l-210-90Z" fill="#d8dbe1" />
              <path d="M400 210 190 300v8l210-90v-8Z" fill="#f4f5f7" />
              <path d="M360 240 250 287l39 17 109-47-38-17Z" fill="#f8f9fb" opacity="0.9" />
              <path d="M400 210 190 300l210 90 210-90-210-90Z" fill="none" stroke="#aeb3bd" strokeWidth="1.2" />
              {defect ? (
                <>
                  <path d="m330 330 30 13 12 34" fill="none" stroke="#b42318" strokeWidth="4" strokeLinecap="round" />
                  <path d="m339 341-6 26m23 3 15 9" fill="none" stroke="#b42318" strokeWidth="3" strokeLinecap="round" />
                </>
              ) : null}
              <rect x="446" y="326" width="92" height="48" rx="2" fill="#f8f9fb" transform="rotate(22 446 326)" />
              <g transform="rotate(22 446 326)" fill="#626262">
                <rect x="456" y="338" width="3" height="20" />
                <rect x="462" y="338" width="1.5" height="20" />
                <rect x="467" y="338" width="3" height="20" />
                <rect x="474" y="338" width="1.5" height="20" />
                <rect x="479" y="338" width="2.5" height="20" />
                <rect x="486" y="338" width="1.5" height="20" />
                <rect x="491" y="338" width="3" height="20" />
                <rect x="498" y="338" width="1.5" height="20" />
                <rect x="503" y="338" width="2.5" height="20" />
                <rect x="510" y="338" width="1.5" height="20" />
                <rect x="516" y="338" width="3" height="20" />
                <rect x="523" y="338" width="1.5" height="20" />
              </g>
              <path d="M610 300v140l-90 38v-138l90-40Z" fill="#b1b6c0" opacity="0.4" />
            </g>
            <path
              d="M26 70V46h24M774 530v24h-24"
              fill="none"
              stroke="#413dfa"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <img
            className="inspection-plate__art"
            src={imageUrl}
            alt=""
            onError={() => setFailed(true)}
          />
        )}

        {box ? (
          <div
            className={`inspection-plate__bbox inspection-plate__bbox--${tone}`}
            style={box}
          >
            <span>
              {label} {confidence}%
            </span>
          </div>
        ) : null}
      </div>

      <div className="inspection-plate__corners" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
