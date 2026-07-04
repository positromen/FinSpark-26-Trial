// The explanation panel: every reason the engine used for the current score.
export default function WhyPanel({ reasons }) {
  if (!reasons.length) {
    return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>
      No flags on the current session.
    </div>
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-2 leading-snug">
          <span style={{ color: 'var(--serious)' }}>▸</span>
          <span style={{ color: 'var(--ink-2)' }}>{r}</span>
        </li>
      ))}
    </ul>
  )
}
