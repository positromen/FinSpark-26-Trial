// Privileged-session recording: replay the recorded command trail like a terminal.
const OUTCOME_COLOR = { EXECUTED: 'var(--good)', DENIED: 'var(--critical)', HELD: 'var(--warning)' }

export default function SessionRecording({ recording }) {
  if (!recording) {
    return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>
      Select a session to replay its recorded command trail.
    </div>
  }
  const { user, role, source_ip, device, commands } = recording
  return (
    <div>
      <div className="text-[10px] mb-2 num" style={{ color: 'var(--muted)' }}>
        {user} · {role} · {source_ip} · {device}
      </div>
      <div className="rounded-lg p-2.5 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto"
           style={{ background: '#0a0a0a', border: '1px solid var(--border)' }}>
        {commands.map((c, i) => (
          <div key={i} className="flex gap-2">
            <span className="num shrink-0" style={{ color: 'var(--muted)' }}>
              {new Date(c.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="shrink-0" style={{ color: OUTCOME_COLOR[c.outcome] }}>
              {c.outcome === 'DENIED' ? '✗' : c.outcome === 'HELD' ? '‖' : '$'}
            </span>
            <span style={{ color: c.outcome === 'DENIED' ? 'var(--muted)' : 'var(--ink-2)',
                           textDecoration: c.outcome === 'DENIED' ? 'line-through' : 'none' }}>
              {c.command}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
