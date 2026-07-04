import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// Risk score of recent sessions over time — single series, slot-1 blue.
export default function TrendChart({ sessions }) {
  const data = [...sessions].reverse().map((s) => ({
    name: `#${s.id} ${s.user}`,
    time: new Date(s.started_at).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    score: s.score,
  }))
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 10 }}
               tickLine={false} axisLine={{ stroke: 'var(--baseline)' }}
               interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 10 }}
               tickLine={false} axisLine={false} width={50} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 8, fontSize: 12, color: 'var(--ink)' }}
          labelStyle={{ color: 'var(--ink-2)' }}
          formatter={(v) => [v, 'risk score']}
        />
        <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2}
              dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
