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

  // Admin
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createMsg, setCreateMsg] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadGastos(session.user.id)
    })
  }, [])

  const loadGastos = async (userId) => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('gastos')
      .select('*, categorias(nombre, icono, color)')
      .eq('user_id', userId)
      .gte('fecha', firstDay)
      .lte('fecha', lastDay)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    setGastos(data || [])
    setLoading(false)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateMsg('')
    const { error } = await supabase.auth.signUp({ email: newEmail, password: newPassword })
    if (error) {
      setCreateMsg('❌ ' + error.message)
    } else {
      setCreateMsg('✅ Usuario creado: ' + newEmail)
      setNewEmail('')
      setNewPassword('')
    }
    setCreating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const now = new Date()
  const totalMes = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0)

  // Top category this month
  const catTotals = {}
  gastos.forEach(g => {
    const name = g.categorias?.nombre || 'Otro'
    const icon = g.categorias?.icono || '📦'
    if (!catTotals[name]) catTotals[name] = { total: 0, icon }
    catTotals[name].total += parseFloat(g.monto)
  })
  const topCat = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total)[0]

  const promedio = gastos.length > 0 ? totalMes / gastos.length : 0
  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <Layout user={user}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{MESES[now.getMonth()]} {now.getFullYear()}</p>
        </div>
        <button onClick={() => router.push('/gastos')} className="btn btn-primary">
          + Agregar gasto
        </button>
      </div>

      {/* Summary cards */}
      <div className="cards-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Total del mes</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary-light)', margin: '0.3rem 0' }}>
            ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{gastos.length} gasto{gastos.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--success)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Categoría top</p>
          <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--success)', margin: '0.3rem 0' }}>
            {topCat ? `${topCat[1].icon} ${topCat[0]}` : '—'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {topCat ? `$${topCat[1].total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'sin datos'}
          </p>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Promedio por gasto</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--warning)', margin: '0.3rem 0' }}>
            {promedio > 0 ? `$${promedio.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>por transacción</p>
        </div>
      </div>

      {/* Recent expenses */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600' }}>Últimos gastos del mes</h2>
          <button
            onClick={() => router.push('/gastos')}
            className="btn"
            style={{ background: 'transparent', color: 'var(--primary-light)', fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
          >
            Ver todos →
          </button>
        </div>

        {gastos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <p style={{ marginBottom: '1rem' }}>No hay gastos registrados este mes</p>
            <button onClick={() => router.push('/gastos')} className="btn btn-primary">
              Cargar primer gasto
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gastos.slice(0, 5).map(gasto => (
              <div key={gasto.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 0.75rem',
                background: '#111',
                borderRadius: '8px',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{gasto.categorias?.icono || '📦'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '500', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {gasto.descripcion || gasto.categorias?.nombre || 'Sin descripción'}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {new Date(gasto.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      {' · '}{gasto.cuenta}
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
                <label className="form-label">Email del nuevo usuario</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@email.com" required />
              </div>
              <div>
                <label className="form-label">Contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="mínimo 6 caracteres" required />
              </div>
              {createMsg && (
                <p style={{ fontSize: '0.85rem', color: createMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{createMsg}</p>
              )}
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </form>
          )}
        </div>
      )}
    </Layout>
  )
}
