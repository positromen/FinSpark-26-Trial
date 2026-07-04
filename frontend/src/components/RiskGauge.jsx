import { riskBand } from '../api.js'

// Semicircular gauge: arc + needle position encode the live 0-100 risk score;
// color and label come from the response band (status palette, icon+label).
export default function RiskGauge({ score }) {
  const band = riskBand(score)
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const r = 80
  const circumference = Math.PI * r
  const angle = Math.PI * (1 - pct)
  const nx = 100 + (r - 14) * Math.cos(angle)
  const ny = 96 - (r - 14) * Math.sin(angle)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 104" className="w-full max-w-[260px]">
        <path d="M 20 96 A 80 80 0 0 1 180 96" fill="none"
              stroke="var(--grid)" strokeWidth="10" strokeLinecap="round" />
        <path d="M 20 96 A 80 80 0 0 1 180 96" fill="none"
              stroke={band.color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${pct * circumference} ${circumference}`}
              style={{ transition: 'stroke-dasharray 600ms ease, stroke 600ms ease' }} />
        <line x1="100" y1="96" x2={nx} y2={ny} stroke="var(--ink)" strokeWidth="2" />
        <circle cx="100" cy="96" r="4" fill="var(--ink)" />
      </svg>
      <div className="num text-5xl font-bold -mt-6" style={{ color: band.color }}>
        {Math.round(score)}
      </div>
      <div className="mt-1 text-xs font-semibold tracking-widest"
           style={{ color: band.color }}>
        {band.name === 'critical' ? '⛔ ' : band.name === 'good' ? '✓ ' : '⚠ '}
        {band.label}
      </div>
    </div>
  )
}
