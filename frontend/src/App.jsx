import { useCallback, useEffect, useRef, useState } from 'react'
import { getJSON, postJSON } from './api.js'
import RiskGauge from './components/RiskGauge.jsx'
import TrendChart from './components/TrendChart.jsx'
import Heatmap from './components/Heatmap.jsx'
import AlertsFeed from './components/AlertsFeed.jsx'
import Timeline from './components/Timeline.jsx'
import WhyPanel from './components/WhyPanel.jsx'

export default function App() {
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [score, setScore] = useState(0)
  const [reasons, setReasons] = useState([])
  const [events, setEvents] = useState([])
  const [sessionLabel, setSessionLabel] = useState('')
  const [chain, setChain] = useState(null) // null | {ok, ...}
  const [pqc, setPqc] = useState(null)
  const [busy, setBusy] = useState(false)
  const wsRef = useRef(null)

  const refresh = useCallback(async () => {
    const [ov, al] = await Promise.all([
      getJSON('/dashboard/overview'), getJSON('/alerts?limit=20'),
    ])
    setOverview(ov)
    setAlerts(al)
    setScore(ov.latest_score)
    const top = ov.sessions[0]
    if (top) {
      setReasons(top.reasons)
      setSessionLabel(`Session #${top.id} — ${top.user} — risk ${top.score}`)
      setEvents(await getJSON(`/sessions/${top.id}/events`))
    }
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
    getJSON('/pqc/info').then(setPqc).catch(() => {})

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/feed`)
    ws.onmessage = (msg) => {
      const frame = JSON.parse(msg.data)
      if (frame.type === 'score') setScore(frame.score)
      if (frame.type === 'alert') {
        setReasons(frame.reasons)
        refresh().catch(console.error)
      }
      if (frame.type === 'audit_tamper') {
        setChain({ ok: frame.chain_ok, problem: frame.problem, badId: frame.first_bad_id })
      }
    }
    wsRef.current = ws
    return () => ws.close()
  }, [refresh])

  const triggerAttack = async () => {
    setBusy(true)
    try { await postJSON('/demo/attack') } finally { setBusy(false) }
  }
  const tamper = async () => {
    setBusy(true)
    try { await postJSON('/demo/tamper') } finally { setBusy(false) }
  }
  const verifyChain = async () => {
    const r = await getJSON('/audit/verify')
    setChain({ ok: r.ok, problem: r.problem, badId: r.first_bad_id })
  }

  if (!overview) {
    return <div className="min-h-screen flex items-center justify-center text-sm"
                style={{ color: 'var(--muted)' }}>Loading Prahari…</div>
  }

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      {/* header */}
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold tracking-wide">
          🛡️ PRAHARI <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>
            Privileged-Access Insider-Threat Detection · SOC
          </span>
        </h1>
        {pqc && (
          <span className="text-[10px] px-2 py-1 rounded-full border"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>
            🔐 {pqc.kem} + {pqc.signature} · {pqc.provider}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={triggerAttack} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--critical)', color: '#fff' }}>
            ▶ Trigger Attack
          </button>
          <button onClick={tamper} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--serious)', color: '#1a1a19' }}>
            ✂ Tamper Audit Log
          </button>
          <button onClick={verifyChain}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>
            ⛓ Verify Audit Chain
          </button>
        </div>
      </header>

      {/* audit chain banner */}
      {chain && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
             style={{
               background: chain.ok ? 'rgba(12,163,12,0.12)' : 'rgba(208,59,59,0.15)',
               border: `1px solid ${chain.ok ? 'var(--good)' : 'var(--critical)'}`,
               color: chain.ok ? 'var(--good)' : 'var(--critical)',
             }}>
          {chain.ok
            ? '✓ AUDIT CHAIN VERIFIED — every entry hash-linked and ML-DSA-65 signature valid'
            : `⛔ AUDIT CHAIN VERIFICATION FAILED — ${chain.problem} (entry #${chain.badId}). Tampering is cryptographically evident.`}
        </div>
      )}

      {/* main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Live risk</h2>
          <RiskGauge score={score} />
          <div className="mt-3">
            <h3 className="panel-title mb-1">Recent sessions</h3>
            <TrendChart sessions={overview.sessions} />
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Alerts</h2>
          <AlertsFeed alerts={alerts} />
        </section>

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Why flagged</h2>
          <WhyPanel reasons={reasons} />
        </section>

        <section className="panel p-4 lg:col-span-2">
          <h2 className="panel-title mb-3">Risk heatmap — users × day (max session risk)</h2>
          <Heatmap heatmap={overview.heatmap} />
        </section>

        <section className="panel p-4">
          <h2 className="panel-title mb-3">Session timeline</h2>
          <Timeline events={events} sessionLabel={sessionLabel} />
        </section>
      </div>

      <footer className="mt-4 text-[10px]" style={{ color: 'var(--muted)' }}>
        Prahari · FinSpark'26 · quantum-safe audit: every entry hash-chained + ML-DSA-65 signed
      </footer>
    </div>
  )
}
