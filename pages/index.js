import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const ADMIN_EMAIL = 'maxiburgos92@gmail.com'
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gastos, setGastos] = useState([])
  const [ingreso, setIngreso] = useState(null)
  const [vencimientos, setVencimientos] = useState([])

  // Ingreso form
  const [showIngresoForm, setShowIngresoForm] = useState(false)
  const [ingresoMonto, setIngresoMonto] = useState('')
  const [savingIngreso, setSavingIngreso] = useState(false)

  // Admin
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createMsg, setCreateMsg] = useState('')
  const [creating, setCreating] = useState(false)

  const now = new Date()
  const mesCurrent = now.getMonth()
  const anioCurrent = now.getFullYear()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadAll(session.user.id)
    })
  }, [])

  const loadAll = async (userId) => {
    const firstDay = new Date(anioCurrent, mesCurrent, 1).toISOString().split('T')[0]
    const lastDay = new Date(anioCurrent, mesCurrent + 1, 0).toISOString().split('T')[0]

    const [gastosRes, ingresoRes, vencRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('*, categorias(nombre, icono, color)')
        .eq('user_id', userId)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('ingresos')
        .select('*')
        .eq('user_id', userId)
        .eq('mes', mesCurrent)
        .eq('anio', anioCurrent)
        .maybeSingle(),
      supabase
        .from('vencimientos')
        .select('*, categorias(nombre, icono)')
        .eq('user_id', userId)
        .eq('activo', true),
    ])

    setGastos(gastosRes.data || [])
    setIngreso(ingresoRes.data || null)
    setVencimientos(vencRes.data || [])
    setLoading(false)
  }

  const handleSaveIngreso = async (e) => {
    e.preventDefault()
    if (!ingresoMonto || parseFloat(ingresoMonto) <= 0) return
    setSavingIngreso(true)

    const payload = { user_id: user.id, mes: mesCurrent, anio: anioCurrent, monto: parseFloat(ingresoMonto) }
    const { data } = await supabase
      .from('ingresos')
      .upsert(payload, { onConflict: 'user_id,mes,anio' })
      .select()
      .single()

    if (data) setIngreso(data)
    setShowIngresoForm(false)
    setIngresoMonto('')
    setSavingIngreso(false)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateMsg('')
    const { error } = await supabase.auth.signUp({ email: newEmail, password: newPassword })
    if (error) { setCreateMsg('❌ ' + error.message) }
    else { setCreateMsg('✅ Usuario creado: ' + newEmail); setNewEmail(''); setNewPassword('') }
    setCreating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  // Calculations
  const totalMes = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0)
  const ingresoMes = ingreso ? parseFloat(ingreso.monto) : null
  const balance = ingresoMes !== null ? ingresoMes - totalMes : null

  // Category breakdown
  const catTotals = {}
  gastos.forEach(g => {
    const key = g.categorias?.nombre || 'Otro'
    if (!catTotals[key]) catTotals[key] = { total: 0, icon: g.categorias?.icono || '📦', color: g.categorias?.color || '#71717a' }
    catTotals[key].total += parseFloat(g.monto)
  })
  const catBreakdown = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total)
  const maxCat = catBreakdown[0]?.[1].total || 1
  const topCat = catBreakdown[0]

  // Upcoming vencimientos (next 10 days)
  const todayDay = now.getDate()
  const daysInMonth = new Date(anioCurrent, mesCurrent + 1, 0).getDate()
  const proximos = vencimientos
    .map(v => {
      const diff = v.dia_vencimiento >= todayDay
        ? v.dia_vencimiento - todayDay
        : daysInMonth - todayDay + v.dia_vencimiento
      return { ...v, daysUntil: diff }
    })
    .filter(v => v.daysUntil <= 10)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <Layout user={user}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{MESES[mesCurrent]} {anioCurrent}</p>
        </div>
        <button onClick={() => router.push('/gastos')} className="btn btn-primary">+ Agregar gasto</button>
      </div>

      {/* Summary cards */}
      <div className="cards-grid" style={{ marginBottom: '1rem' }}>
        <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Gastos del mes</p>
          <p style={{ fontSize: '1.7rem', fontWeight: '700', color: 'var(--primary-light)', margin: '0.3rem 0' }}>
            ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{gastos.length} transacción{gastos.length !== 1 ? 'es' : ''}</p>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Ingreso {MESES[mesCurrent]}</p>
            <button
              onClick={() => { setShowIngresoForm(!showIngresoForm); setIngresoMonto(ingreso?.monto || '') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 0 }}
            >
              {ingreso ? '✏️' : '+ cargar'}
            </button>
          </div>
          {showIngresoForm ? (
            <form onSubmit={handleSaveIngreso} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                value={ingresoMonto}
                onChange={e => setIngresoMonto(e.target.value)}
                placeholder="Monto"
                min="1"
                autoFocus
                style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
              />
              <button type="submit" className="btn btn-primary" disabled={savingIngreso} style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                {savingIngreso ? '...' : 'OK'}
              </button>
            </form>
          ) : (
            <>
              <p style={{ fontSize: '1.7rem', fontWeight: '700', color: 'var(--success)', margin: '0.3rem 0' }}>
                {ingresoMes !== null
                  ? `$${ingresoMes.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '—'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{ingreso ? 'registrado' : 'sin cargar'}</p>
            </>
          )}
        </div>

        <div className="card" style={{ borderLeft: `3px solid ${balance === null ? 'var(--border)' : balance >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Balance</p>
          <p style={{
            fontSize: '1.7rem', fontWeight: '700', margin: '0.3rem 0',
            color: balance === null ? 'var(--text-muted)' : balance >= 0 ? 'var(--success)' : 'var(--danger)'
          }}>
            {balance !== null
              ? `${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : '—'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {balance === null ? 'cargá tu ingreso' : balance >= 0 ? 'disponible' : 'en rojo'}
          </p>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Categoría top</p>
          <p style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--warning)', margin: '0.3rem 0' }}>
            {topCat ? `${topCat[1].icon} ${topCat[0]}` : '—'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {topCat
              ? `$${topCat[1].total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} · ${Math.round((topCat[1].total / totalMes) * 100)}% del total`
              : 'sin datos'}
          </p>
        </div>
      </div>

      {/* Middle section: Category breakdown + Upcoming dues */}
      <div className="two-col-grid" style={{ marginBottom: '1.5rem' }}>
        {/* Category breakdown */}
        <div className="card">
          <h2 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem' }}>Gastos por categoría</h2>
          {catBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Sin gastos este mes</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {catBreakdown.slice(0, 6).map(([name, { total, icon, color }]) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>{icon} {name}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color }}>
                      ${total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{ background: '#222', borderRadius: '4px', height: '5px' }}>
                    <div style={{
                      width: `${Math.max((total / maxCat) * 100, 3)}%`,
                      background: color,
                      height: '100%',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming vencimientos */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Próximos vencimientos</h2>
            <button
              onClick={() => router.push('/vencimientos')}
              className="btn"
              style={{ background: 'transparent', color: 'var(--primary-light)', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
            >
              Ver todos →
            </button>
          </div>

          {vencimientos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Sin vencimientos cargados</p>
              <button onClick={() => router.push('/vencimientos')} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                + Agregar
              </button>
            </div>
          ) : proximos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Sin vencimientos en los próximos 10 días ✅
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {proximos.map(v => {
                const urgent = v.daysUntil <= 2
                const soon = v.daysUntil <= 5
                const color = urgent ? 'var(--danger)' : soon ? 'var(--warning)' : 'var(--text-muted)'
                return (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    background: urgent ? '#ef444410' : '#111',
                    borderRadius: '8px',
                    border: urgent ? '1px solid #ef444430' : '1px solid transparent',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.88rem', fontWeight: '500' }}>
                        {v.categorias?.icono || '📄'} {v.nombre}
                      </p>
                      {v.monto && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ${parseFloat(v.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: '700', color }}>
                        {v.daysUntil === 0 ? '¡Hoy!' : v.daysUntil === 1 ? 'Mañana' : `${v.daysUntil} días`}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>día {v.dia_vencimiento}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent expenses */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Últimos gastos</h2>
          <button
            onClick={() => router.push('/gastos')}
            className="btn"
            style={{ background: 'transparent', color: 'var(--primary-light)', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
          >
            Ver todos →
          </button>
        </div>

        {gastos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
            <p style={{ marginBottom: '1rem' }}>No hay gastos este mes</p>
            <button onClick={() => router.push('/gastos')} className="btn btn-primary">Cargar primer gasto</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gastos.slice(0, 5).map(gasto => (
              <div key={gasto.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.75rem', background: '#111', borderRadius: '8px', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{gasto.categorias?.icono || '📦'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '500', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {gasto.descripcion || gasto.categorias?.nombre || 'Sin descripción'}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {new Date(gasto.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      {' · '}{gasto.cuenta}
                      {gasto.divisa && gasto.divisa !== 'ARS' && <span className="badge-divisa">{gasto.divisa}</span>}
                    </p>
                  </div>
                </div>
                <span style={{ fontWeight: '700', color: 'var(--danger)', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>
                  -${parseFloat(gasto.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin panel */}
      {isAdmin && (
        <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCreateUser ? '1rem' : 0 }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: '600' }}>👤 Gestión de usuarios</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Solo visible para admin</p>
            </div>
            <button onClick={() => setShowCreateUser(!showCreateUser)} className="btn btn-primary">
              {showCreateUser ? 'Cancelar' : '+ Nuevo usuario'}
            </button>
          </div>
          {showCreateUser && (
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@email.com" required />
              </div>
              <div>
                <label className="form-label">Contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="mínimo 6 caracteres" required />
              </div>
              {createMsg && <p style={{ fontSize: '0.85rem', color: createMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{createMsg}</p>}
              <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creando...' : 'Crear usuario'}</button>
            </form>
          )}
        </div>
      )}
    </Layout>
  )
}
