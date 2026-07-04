import { useCallback, useEffect, useRef, useState } from 'react'
import { getJSON, postJSON, openFeed } from '../api.js'
import RiskGauge from '../components/RiskGauge.jsx'
import Heatmap from '../components/Heatmap.jsx'
import AlertsFeed from '../components/AlertsFeed.jsx'
import Timeline from '../components/Timeline.jsx'
import WhyPanel from '../components/WhyPanel.jsx'
import LiveSessions from '../components/LiveSessions.jsx'

export default function SocConsole({ user, onLogout }) {
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [live, setLive] = useState([])
  const [selId, setSelId] = useState(null)
  const [events, setEvents] = useState([])
  const [reasons, setReasons] = useState([])
  const [score, setScore] = useState(0)
  const [flashId, setFlashId] = useState(null)
  const [chain, setChain] = useState(null)
  const [pqc, setPqc] = useState(null)
  const [busy, setBusy] = useState(false)
  const selRef = useRef(null)

  const loadSelected = useCallback(async (id) => {
    if (!id) return
    const s = (await getJSON('/soc/live')).find((x) => x.id === id)
    if (s) { setEvents(s.events); setReasons(s.reasons); setScore(s.score) }
  }, [])

  const refresh = useCallback(async () => {
    const [ov, al, lv] = await Promise.all([
      getJSON('/soc/overview'), getJSON('/soc/alerts?limit=25'), getJSON('/soc/live'),
    ])
    setOverview(ov); setAlerts(al); setLive(lv)
    const focus = lv.find((s) => s.id === selRef.current) || lv[0] || ov.sessions[0]
    if (focus) {
      const id = focus.id; selRef.current = id; setSelId(id)
      setScore(focus.score); setReasons(focus.reasons || [])
      if (focus.events) setEvents(focus.events)
      else setEvents(await getJSON(`/soc/sessions/${id}/events`))
    }
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
    getJSON('/pqc/info').then(setPqc).catch(() => {})
    const ws = openFeed((frame) => {
      if (frame.type === 'activity' || frame.type === 'alert') {
        setFlashId(frame.session_id); setTimeout(() => setFlashId(null), 1000)
        if (frame.type === 'activity' && frame.session_id === selRef.current) {
          setScore(frame.score); setReasons(frame.reasons || [])
        }
        refresh().catch(console.error)
      }
      if (frame.type === 'audit_tamper') {
        setChain({ ok: frame.chain_ok, problem: frame.problem, badId: frame.first_bad_id })
      }
    })
    return () => ws.close()
  }, [refresh])

  const select = async (id) => {
    selRef.current = id; setSelId(id); await loadSelected(id)
  }
  const triggerAttack = async () => { setBusy(true); try { await postJSON('/demo/attack') } finally { setBusy(false); refresh() } }
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
        <div className="ml-auto flex gap-2">
          <button onClick={triggerAttack} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--critical)', color: '#fff' }}>▶ Scripted Attack</button>
          <button onClick={tamper} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--serious)', color: '#1a1a19' }}>✂ Tamper Audit Log</button>
          <button onClick={verify}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>⛓ Verify Chain</button>
          <button onClick={onLogout}
                  className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
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

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Alerts</h2>
          <AlertsFeed alerts={alerts} flashId={flashId} />
        </section>

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Session timeline</h2>
          <Timeline events={events} sessionLabel={selId ? `Session #${selId}` : ''} />
        </section>

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Risk heatmap — users × day</h2>
          <Heatmap heatmap={overview.heatmap} />
        </section>
      </div>

      <footer className="mt-4 text-[10px]" style={{ color: 'var(--muted)' }}>
        Prahari · FinSpark'26 · live behavioural scoring + NIST post-quantum audit (ML-KEM-768 / ML-DSA-65)
      </footer>
    </div>
  )
}
