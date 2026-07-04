import { useState } from 'react'
import { login } from '../api.js'

const DEMO = [
  { u: 'soc_admin', label: 'SOC analyst — Prahari console', tag: 'ANALYST' },
  { u: 'rmehta', label: 'Rajesh Mehta — DBA (normal staff)', tag: 'EMPLOYEE' },
  { u: 'ext_dsouza', label: "Kevin D'Souza — dormant vendor (the attacker)", tag: 'ATTACKER' },
]

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('prahari123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { onLogin(await login(username, password)) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'radial-gradient(1200px 600px at 50% -10%, #14243d 0%, var(--page) 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl">🛡️</div>
          <h1 className="text-2xl font-bold tracking-wide mt-1">PRAHARI</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Privileged-Access Insider-Threat Detection
          </p>
        </div>

        <form onSubmit={submit} className="panel p-5 space-y-3">
          <div>
            <label className="panel-title">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
                   autoFocus autoComplete="username"
                   className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                   style={{ background: 'var(--page)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
          <div>
            <label className="panel-title">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   autoComplete="current-password"
                   className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                   style={{ background: 'var(--page)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
          {error && <div className="text-xs" style={{ color: 'var(--critical)' }}>⛔ {error}</div>}
          <button type="submit" disabled={busy}
                  className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 panel p-3">
          <div className="panel-title mb-2">Demo accounts · password <span className="num">prahari123</span></div>
          <ul className="space-y-1">
            {DEMO.map((d) => (
              <li key={d.u}>
                <button onClick={() => setUsername(d.u)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-md cursor-pointer flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="num font-semibold" style={{ color: 'var(--accent)' }}>{d.u}</span>
                  <span style={{ color: 'var(--muted)' }}>{d.label}</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--grid)', color: 'var(--ink-2)' }}>{d.tag}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
