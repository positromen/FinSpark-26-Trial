import { useCallback, useEffect, useRef, useState } from 'react'
import { getJSON, postJSON, openFeed } from '../api.js'
import RiskGauge from '../components/RiskGauge.jsx'
import Heatmap from '../components/Heatmap.jsx'
import AlertsFeed from '../components/AlertsFeed.jsx'
import Timeline from '../components/Timeline.jsx'
import WhyPanel from '../components/WhyPanel.jsx'
import LiveSessions from '../components/LiveSessions.jsx'
import AccessReview from '../components/AccessReview.jsx'
import SessionRecording from '../components/SessionRecording.jsx'

const SCENARIOS = [
  { kind: 'malicious', label: '☠ Malicious', color: 'var(--critical)', ink: '#fff' },
  { kind: 'compromised', label: '🎭 Compromised', color: 'var(--accent)', ink: '#fff' },
  { kind: 'negligent', label: '⚠ Negligent', color: 'var(--warning)', ink: '#1a1a19' },
]

export default function SocConsole({ user, onLogout }) {
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [live, setLive] = useState([])
  const [access, setAccess] = useState([])
  const [selId, setSelId] = useState(null)
  const [events, setEvents] = useState([])
  const [reasons, setReasons] = useState([])
  const [recording, setRecording] = useState(null)
  const [score, setScore] = useState(0)
  const [flashId, setFlashId] = useState(null)
  const [chain, setChain] = useState(null)
  const [pqc, setPqc] = useState(null)
  const [busy, setBusy] = useState(false)
  const selRef = useRef(null)

  const loadRecording = useCallback(async (id) => {
    try { setRecording(await getJSON(`/soc/sessions/${id}/commands`)) } catch { setRecording(null) }
  }, [])

  const refresh = useCallback(async () => {
    const [ov, al, lv, ac] = await Promise.all([
      getJSON('/soc/overview'), getJSON('/soc/alerts?limit=25'),
      getJSON('/soc/live'), getJSON('/soc/access-review'),
    ])
    setOverview(ov); setAlerts(al); setLive(lv); setAccess(ac)
    const focus = lv.find((s) => s.id === selRef.current) || lv[0] || ov.sessions[0]
    if (focus) {
      const id = focus.id; selRef.current = id; setSelId(id)
      setScore(focus.score); setReasons(focus.reasons || [])
      setEvents(focus.events || await getJSON(`/soc/sessions/${id}/events`))
      loadRecording(id)
    }
  }, [loadRecording])

  useEffect(() => {
    refresh().catch(console.error)
    getJSON('/pqc/info').then(setPqc).catch(() => {})
    const ws = openFeed((frame) => {
      if (frame.type === 'activity' || frame.type === 'alert') {
        setFlashId(frame.session_id); setTimeout(() => setFlashId(null), 1000)
        refresh().catch(console.error)
      }
      if (frame.type === 'audit_tamper') {
        setChain({ ok: frame.chain_ok, problem: frame.problem, badId: frame.first_bad_id })
      }
    })
    return () => ws.close()
  }, [refresh])

  const select = async (id) => {
    selRef.current = id; setSelId(id)
    const s = live.find((x) => x.id === id) || overview.sessions.find((x) => x.id === id)
    if (s) { setScore(s.score); setReasons(s.reasons || []) }
    setEvents(await getJSON(`/soc/sessions/${id}/events`))
    loadRecording(id)
  }
  const runScenario = async (kind) => { setBusy(true); try { await postJSON(`/demo/scenario/${kind}`) } finally { setBusy(false); refresh() } }
  const tamper = async () => { setBusy(true); try { await postJSON('/demo/tamper') } finally { setBusy(false) } }
  const verify = async () => {
    const r = await getJSON('/audit/verify')
    setChain({ ok: r.ok, problem: r.problem, badId: r.first_bad_id })
  }

  if (!overview) return <div className="min-h-screen grid place-items-center text-sm"
                             style={{ color: 'var(--muted)' }}>Loading SOC console…</div>

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold tracking-wide">
          🛡️ PRAHARI <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>
            SOC Console · {user.name}
          </span>
        </h1>
        {pqc && (
          <span className="text-[10px] px-2 py-1 rounded-full border"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>
            🔐 {pqc.kem} + {pqc.signature}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <span className="text-[10px] self-center" style={{ color: 'var(--muted)' }}>simulate insider:</span>
          {SCENARIOS.map((s) => (
            <button key={s.kind} onClick={() => runScenario(s.kind)} disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                    style={{ background: s.color, color: s.ink }}>{s.label}</button>
          ))}
          <button onClick={tamper} disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>✂ Tamper</button>
          <button onClick={verify}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>⛓ Verify</button>
          <button onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>Sign out</button>
        </div>
      </header>

      {chain && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
             style={{ background: chain.ok ? 'rgba(12,163,12,0.12)' : 'rgba(208,59,59,0.15)',
                      border: `1px solid ${chain.ok ? 'var(--good)' : 'var(--critical)'}`,
                      color: chain.ok ? 'var(--good)' : 'var(--critical)' }}>
          {chain.ok
            ? '✓ AUDIT CHAIN VERIFIED — every entry hash-linked and ML-DSA-65 signature valid'
            : `⛔ AUDIT CHAIN FAILED — ${chain.problem} (entry #${chain.badId}). Tampering is cryptographically evident.`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Live privileged sessions</h2>
          <LiveSessions sessions={live} selectedId={selId} onSelect={select} flashId={flashId} />
        </section>
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Selected session risk</h2>
          <RiskGauge score={score} />
        </section>
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Why flagged</h2>
          <WhyPanel reasons={reasons} />
        </section>

        <section className="panel p-4 lg:col-span-2">
          <h2 className="panel-title mb-3">Alerts (tagged by insider type)</h2>
          <AlertsFeed alerts={alerts} flashId={flashId} />
        </section>
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Session timeline</h2>
          <Timeline events={events} sessionLabel={selId ? `Session #${selId}` : ''} />
        </section>

        <section className="panel p-4 lg:col-span-2">
          <h2 className="panel-title mb-3">🎬 Privileged-session recording (replay)</h2>
          <SessionRecording recording={recording} />
        </section>
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Risk heatmap — users × day</h2>
          <Heatmap heatmap={overview.heatmap} />
        </section>

        <section className="panel p-4 lg:col-span-3">
          <h2 className="panel-title mb-3">🔑 PAM access review — dormant / vendor / expired grants</h2>
          <AccessReview rows={access} />
        </section>
      </div>

      <footer className="mt-4 text-[10px]" style={{ color: 'var(--muted)' }}>
        Prahari · FinSpark'26 · live behavioural scoring across malicious / negligent / compromised
        insiders · NIST post-quantum audit (ML-KEM-768 / ML-DSA-65)
      </footer>
    </div>
  )
}
