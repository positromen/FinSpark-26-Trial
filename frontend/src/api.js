export async function getJSON(path) {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json()
}

export async function postJSON(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json()
}

// Risk band shared by gauge, chips and heatmap emphasis.
export function riskBand(score) {
  if (score >= 85) return { label: 'BLOCK', color: 'var(--critical)', name: 'critical' }
  if (score >= 70) return { label: 'MAKER-CHECKER', color: 'var(--serious)', name: 'serious' }
  if (score >= 40) return { label: 'STEP-UP MFA', color: 'var(--warning)', name: 'warning' }
  return { label: 'NORMAL', color: 'var(--good)', name: 'good' }
}
