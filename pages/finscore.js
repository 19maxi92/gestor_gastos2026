import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const getScoreLevel = (score) => {
  if (score >= 850) return { label: 'Excelente', color: '#06b6d4', emoji: '🏆' }
  if (score >= 700) return { label: 'Muy bueno', color: '#22c55e', emoji: '🎯' }
  if (score >= 500) return { label: 'Bueno', color: '#f97316', emoji: '📈' }
  if (score >= 300) return { label: 'Regular', color: '#f59e0b', emoji: '⚠️' }
  return { label: 'Crítico', color: '#ef4444', emoji: '🔴' }
}

function ScoreCircle({ score, color }) {
  const radius = 70
  const stroke = 10
  const normalizedRadius = radius - stroke / 2
  const circumference = 2 * Math.PI * normalizedRadius
  const progress = Math.min(score / 1000, 1)
  const strokeDashoffset = circumference - progress * circumference

  return (
    <div style={{ position: 'relative', width: radius * 2, height: radius * 2, margin: '0 auto' }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={radius} cy={radius} r={normalizedRadius} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '2rem', fontWeight: '800', color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>de 1000</span>
      </div>
    </div>
  )
}

export default function FinScore() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())

  const [data, setData] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
    })
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user, mes, anio])

  const loadData = async () => {
    setLoading(true)
    const firstDay = new Date(anio, mes, 1).toISOString().split('T')[0]
    const lastDay = new Date(anio, mes + 1, 0).toISOString().split('T')[0]

    // Last 30 days for consistency
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)
    const hace30Str = hace30.toISOString().split('T')[0]

    const [gastosRes, ingresoRes, presRes, consistRes] = await Promise.all([
      supabase.from('gastos').select('categoria_id, monto, fecha').eq('user_id', user.id).gte('fecha', firstDay).lte('fecha', lastDay),
      supabase.from('ingresos').select('monto').eq('user_id', user.id).eq('mes', mes).eq('anio', anio).maybeSingle(),
      supabase.from('presupuestos').select('*').eq('user_id', user.id).eq('mes', mes).eq('anio', anio),
      supabase.from('gastos').select('fecha').eq('user_id', user.id).gte('fecha', hace30Str),
    ])

    const gastosMes = gastosRes.data || []
    const ingreso = ingresoRes.data ? parseFloat(ingresoRes.data.monto) : 0
    const presupuestos = presRes.data || []
    const gastos30 = consistRes.data || []

    // Spending map
    const gastosMap = {}
    gastosMes.forEach(g => {
      const k = g.categoria_id || 'x'
      gastosMap[k] = (gastosMap[k] || 0) + parseFloat(g.monto)
    })
    const totalGastos = gastosMes.reduce((s, g) => s + parseFloat(g.monto), 0)

    // --- Component 1: Ahorro (0-400 pts) ---
    let ptsAhorro = 0, ahorroRate = 0, ahorroMsg = ''
    if (ingreso > 0) {
      ahorroRate = Math.max(0, (ingreso - totalGastos) / ingreso)
      ptsAhorro = Math.round(Math.min(ahorroRate, 1) * 400)
      ahorroMsg = ahorroRate >= 0.2
        ? `Ahorrás el ${Math.round(ahorroRate * 100)}% de tu ingreso 👏`
        : ahorroRate > 0
          ? `Ahorrás el ${Math.round(ahorroRate * 100)}%. Intentá llegar al 20%.`
          : 'Gastos superan el ingreso del mes.'
    } else {
      ptsAhorro = 0
      ahorroMsg = 'Cargá tu ingreso mensual para calcular este componente.'
    }

    // --- Component 2: Presupuestos (0-350 pts) ---
    let ptsPresupuesto = 175, presRate = 0.5, presMsg = '' // neutral if no budgets
    if (presupuestos.length > 0) {
      const dentroDelLimite = presupuestos.filter(p => (gastosMap[p.categoria_id] || 0) <= parseFloat(p.monto_limite)).length
      presRate = dentroDelLimite / presupuestos.length
      ptsPresupuesto = Math.round(presRate * 350)
      presMsg = presRate === 1
        ? 'Todas las categorías dentro del límite 🎯'
        : presRate >= 0.7
          ? `${dentroDelLimite} de ${presupuestos.length} categorías dentro del límite.`
          : `Solo ${dentroDelLimite} de ${presupuestos.length} categorías dentro del límite.`
    } else {
      presMsg = 'No hay presupuestos configurados. Se asigna puntuación neutral.'
    }

    // --- Component 3: Consistencia (0-250 pts) ---
    const diasUnicos = new Set(gastos30.map(g => g.fecha)).size
    const consistRate = Math.min(diasUnicos / 12, 1) // 12 días activos en 30 = 100%
    const ptsConsistencia = Math.round(consistRate * 250)
    const consistMsg = diasUnicos >= 12
      ? `Registraste gastos en ${diasUnicos} días este mes 📊`
      : diasUnicos > 0
        ? `Registraste gastos en ${diasUnicos} días. Intentá llegar a 12+ días.`
        : 'Sin registros en los últimos 30 días.'

    const score = ptsAhorro + ptsPresupuesto + ptsConsistencia

    setData({
      score,
      ingreso,
      totalGastos,
      components: [
        {
          nombre: 'Tasa de ahorro',
          peso: '40%',
          pts: ptsAhorro,
          maxPts: 400,
          pct: ingreso > 0 ? Math.round(ahorroRate * 100) : null,
          msg: ahorroMsg,
          icon: '💰',
        },
        {
          nombre: 'Cumplimiento de presupuestos',
          peso: '35%',
          pts: ptsPresupuesto,
          maxPts: 350,
          pct: Math.round(presRate * 100),
          msg: presMsg,
          icon: '🎯',
        },
        {
          nombre: 'Consistencia de registro',
          peso: '25%',
          pts: ptsConsistencia,
          maxPts: 250,
          pct: Math.round(consistRate * 100),
          msg: consistMsg,
          icon: '📅',
        },
      ],
    })
    setLoading(false)
  }

  const anios = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) anios.push(y)

  if (!user || (loading && !data)) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Calculando...</p>
    </div>
  )

  const level = data ? getScoreLevel(data.score) : null

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>📈 FinScore</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tu puntaje de salud financiera</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Mes</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ width: 'auto' }}>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Año</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ width: 'auto' }}>
              {anios.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Score card */}
          <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '2rem 1.5rem' }}>
            <ScoreCircle score={data.score} color={level.color} />
            <div style={{ marginTop: '1.25rem' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: level.color }}>
                {level.emoji} {level.label}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                {MESES[mes]} {anio}
              </p>
            </div>
            {data.ingreso > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ingreso</p>
                  <p style={{ fontWeight: '600', color: 'var(--success)' }}>
                    ${data.ingreso.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Gastos</p>
                  <p style={{ fontWeight: '600', color: 'var(--danger)' }}>
                    ${data.totalGastos.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Balance</p>
                  <p style={{ fontWeight: '600', color: data.ingreso - data.totalGastos >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ${(data.ingreso - data.totalGastos).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Component breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {data.components.map(c => {
              const pct = (c.pts / c.maxPts) * 100
              const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={c.nombre} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.icon} {c.nombre}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{c.msg}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                      <p style={{ fontWeight: '700', fontSize: '1.1rem', color }}>{c.pts}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>de {c.maxPts} pts</p>
                    </div>
                  </div>
                  <div style={{ background: '#222', borderRadius: '4px', height: '6px' }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: color,
                      height: '100%', borderRadius: '4px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Peso: {c.peso}</span>
                    <span style={{ fontSize: '0.72rem', color }}>{Math.round(pct)}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tips */}
          <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
            <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.75rem' }}>💡 Cómo mejorar tu score</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.ingreso === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  → <span style={{ color: 'var(--text)' }}>Cargá tu ingreso mensual</span> para activar el componente de ahorro (400 pts posibles).
                </p>
              )}
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                → <span style={{ color: 'var(--text)' }}>Ahorrá al menos el 20%</span> de tu ingreso para puntaje máximo en ahorro.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                → <span style={{ color: 'var(--text)' }}>Configurá presupuestos</span> por categoría y mantenelos para sumar hasta 350 pts.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                → <span style={{ color: 'var(--text)' }}>Registrá gastos regularmente</span> (12+ días al mes) para el puntaje de consistencia.
              </p>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
