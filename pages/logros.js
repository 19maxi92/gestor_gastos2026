import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const LOGROS = [
  {
    id: 'primer_gasto',
    icon: '🌱',
    nombre: 'Primer paso',
    desc: 'Registraste tu primer gasto',
    check: (d) => d.totalGastos >= 1,
  },
  {
    id: 'organizador',
    icon: '📊',
    nombre: 'Organizador',
    desc: 'Registraste 25 o más gastos',
    check: (d) => d.totalGastos >= 25,
    progreso: (d) => ({ actual: Math.min(d.totalGastos, 25), total: 25 }),
  },
  {
    id: 'ahorrista',
    icon: '💰',
    nombre: 'Ahorrista',
    desc: 'Ahorraste el 20%+ de tu ingreso este mes',
    check: (d) => d.tasaAhorro >= 0.2,
  },
  {
    id: 'presupuestador',
    icon: '🎯',
    nombre: 'Presupuestador',
    desc: 'Configuraste 3 o más presupuestos',
    check: (d) => d.totalPresupuestos >= 3,
    progreso: (d) => ({ actual: Math.min(d.totalPresupuestos, 3), total: 3 }),
  },
  {
    id: 'soñador',
    icon: '⭐',
    nombre: 'Soñador',
    desc: 'Creaste tu primera meta de ahorro',
    check: (d) => d.totalMetas >= 1,
  },
  {
    id: 'cumplidor',
    icon: '✅',
    nombre: 'Cumplidor',
    desc: 'Completaste una meta de ahorro',
    check: (d) => d.metasCompletadas >= 1,
  },
  {
    id: 'rutinario',
    icon: '🔄',
    nombre: 'Rutinario',
    desc: 'Tenés gastos recurrentes configurados',
    check: (d) => d.totalRecurrentes >= 1,
  },
  {
    id: 'suscriptor',
    icon: '💳',
    nombre: 'Suscriptor',
    desc: 'Registraste tus suscripciones',
    check: (d) => d.totalSuscripciones >= 1,
  },
  {
    id: 'previsto',
    icon: '📅',
    nombre: 'Previsto',
    desc: 'Cargaste 3 o más vencimientos',
    check: (d) => d.totalVencimientos >= 3,
    progreso: (d) => ({ actual: Math.min(d.totalVencimientos, 3), total: 3 }),
  },
  {
    id: 'solidario',
    icon: '🤝',
    nombre: 'Deudor sano',
    desc: 'Saldaste al menos una deuda',
    check: (d) => d.deudasSaldadas >= 1,
  },
  {
    id: 'banquero',
    icon: '🏦',
    nombre: 'Banquero',
    desc: 'Cargaste tus tarjetas de crédito',
    check: (d) => d.totalTarjetas >= 1,
  },
  {
    id: 'maestro',
    icon: '🏆',
    nombre: 'Maestro financiero',
    desc: 'Desbloqueaste 8 o más logros',
    check: (d, unlocked) => unlocked >= 8,
    progreso: (d, unlocked) => ({ actual: Math.min(unlocked, 8), total: 8 }),
  },
]

export default function Logros() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadData(session.user.id)
    })
  }, [])

  const loadData = async (userId) => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const [
      gastosRes, ingresoRes, presRes, metasRes,
      recRes, suscRes, vencRes, deudasRes, tarjRes,
    ] = await Promise.all([
      supabase.from('gastos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('ingresos').select('monto').eq('user_id', userId).eq('mes', now.getMonth()).eq('anio', now.getFullYear()).maybeSingle(),
      supabase.from('presupuestos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('metas').select('monto_objetivo, monto_actual').eq('user_id', userId),
      supabase.from('recurrentes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('activo', true),
      supabase.from('suscripciones').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('activo', true),
      supabase.from('vencimientos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('activo', true),
      supabase.from('deudas').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('saldada', true),
      supabase.from('tarjetas').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('activa', true),
    ])

    // Spending this month for savings rate
    const gastosMontoRes = await supabase
      .from('gastos')
      .select('monto')
      .eq('user_id', userId)
      .gte('fecha', firstDay)
      .lte('fecha', lastDay)

    const gastosMes = (gastosMontoRes.data || []).reduce((s, g) => s + parseFloat(g.monto), 0)
    const ingresoMes = ingresoRes.data ? parseFloat(ingresoRes.data.monto) : 0
    const tasaAhorro = ingresoMes > 0 ? Math.max(0, (ingresoMes - gastosMes) / ingresoMes) : 0

    const metas = metasRes.data || []
    const metasCompletadas = metas.filter(m => parseFloat(m.monto_actual) >= parseFloat(m.monto_objetivo)).length

    setDatos({
      totalGastos: gastosRes.count || 0,
      tasaAhorro,
      totalPresupuestos: presRes.count || 0,
      totalMetas: metas.length,
      metasCompletadas,
      totalRecurrentes: recRes.count || 0,
      totalSuscripciones: suscRes.count || 0,
      totalVencimientos: vencRes.count || 0,
      deudasSaldadas: deudasRes.count || 0,
      totalTarjetas: tarjRes.count || 0,
    })
    setLoading(false)
  }

  if (loading || !datos) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Calculando logros...</p>
    </div>
  )

  // First pass: compute unlocked count for maestro
  let unlockedCount = 0
  LOGROS.slice(0, -1).forEach(l => { if (l.check(datos, 0)) unlockedCount++ })

  const logroData = LOGROS.map(l => ({
    ...l,
    unlocked: l.check(datos, unlockedCount),
    prog: l.progreso ? l.progreso(datos, unlockedCount) : null,
  }))
  const totalUnlocked = logroData.filter(l => l.unlocked).length

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>🏆 Logros</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {totalUnlocked} de {LOGROS.length} desbloqueados
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progreso general</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary-light)' }}>
            {totalUnlocked}/{LOGROS.length}
          </span>
        </div>
        <div style={{ background: '#222', borderRadius: '6px', height: '8px' }}>
          <div style={{
            width: `${(totalUnlocked / LOGROS.length) * 100}%`,
            background: totalUnlocked === LOGROS.length ? 'var(--warning)' : 'var(--primary)',
            height: '100%', borderRadius: '6px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        {totalUnlocked === LOGROS.length && (
          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--warning)' }}>
            🎉 ¡Completaste todos los logros!
          </p>
        )}
      </div>

      {/* Logros grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {logroData.map(l => (
          <div key={l.id} className="card" style={{
            borderLeft: `3px solid ${l.unlocked ? 'var(--primary)' : 'var(--border)'}`,
            opacity: l.unlocked ? 1 : 0.55,
            transition: 'opacity 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: l.prog ? '0.75rem' : 0 }}>
              <span style={{ fontSize: '2rem', filter: l.unlocked ? 'none' : 'grayscale(100%)' }}>{l.icon}</span>
              <div>
                <p style={{ fontWeight: '600', fontSize: '0.9rem', color: l.unlocked ? 'var(--text)' : 'var(--text-muted)' }}>
                  {l.nombre}
                  {l.unlocked && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--success)' }}>✓</span>}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{l.desc}</p>
              </div>
            </div>
            {l.prog && !l.unlocked && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Progreso</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.prog.actual}/{l.prog.total}</span>
                </div>
                <div style={{ background: '#222', borderRadius: '4px', height: '4px' }}>
                  <div style={{
                    width: `${(l.prog.actual / l.prog.total) * 100}%`,
                    background: 'var(--primary)', height: '100%', borderRadius: '4px',
                  }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
