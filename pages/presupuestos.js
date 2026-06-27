import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const getPctColor = (pct) => {
  if (pct >= 100) return 'var(--danger)'
  if (pct >= 80) return 'var(--warning)'
  if (pct >= 60) return '#f97316'
  return 'var(--success)'
}

export default function Presupuestos() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [gastosMap, setGastosMap] = useState({}) // categoria_id -> total spent

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadCategorias(session.user.id)
    })
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user, mes, anio])

  const loadCategorias = async (userId) => {
    const { data } = await supabase.from('categorias').select('*').order('nombre')
    setCategorias(data || [])
    setLoading(false)
  }

  const loadData = async () => {
    const firstDay = new Date(anio, mes, 1).toISOString().split('T')[0]
    const lastDay = new Date(anio, mes + 1, 0).toISOString().split('T')[0]

    const [gastosRes, presRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('categoria_id, monto')
        .eq('user_id', user.id)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay),
      supabase
        .from('presupuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mes)
        .eq('anio', anio),
    ])

    // Build spending map
    const map = {}
    ;(gastosRes.data || []).forEach(g => {
      const k = g.categoria_id || 'sin_cat'
      map[k] = (map[k] || 0) + parseFloat(g.monto)
    })
    setGastosMap(map)
    setPresupuestos(presRes.data || [])
  }

  const openEdit = (cat, presupuesto) => {
    setEditingCat(cat)
    setLimitInput(presupuesto ? String(presupuesto.monto_limite) : '')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!limitInput || parseFloat(limitInput) <= 0) return
    setSaving(true)

    await supabase
      .from('presupuestos')
      .upsert({
        user_id: user.id,
        categoria_id: editingCat.id,
        mes,
        anio,
        monto_limite: parseFloat(limitInput),
      }, { onConflict: 'user_id,categoria_id,mes,anio' })

    await loadData()
    setShowModal(false)
    setSaving(false)
  }

  const handleDelete = async (presupuesto) => {
    if (!confirm('¿Eliminar el límite de esta categoría?')) return
    await supabase.from('presupuestos').delete().eq('id', presupuesto.id)
    loadData()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const presMap = {}
  presupuestos.forEach(p => { presMap[p.categoria_id] = p })

  const totalLimit = presupuestos.reduce((s, p) => s + parseFloat(p.monto_limite), 0)
  const totalGastadoConLimit = presupuestos.reduce((s, p) => s + (gastosMap[p.categoria_id] || 0), 0)

  const anios = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) anios.push(y)

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>🎯 Presupuestos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Límites de gasto por categoría</p>
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

      {/* Summary */}
      {presupuestos.length > 0 && (
        <div className="cards-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Presupuesto total</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--primary-light)', margin: '0.3rem 0' }}>
              ${totalLimit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{presupuestos.length} categorías con límite</p>
          </div>
          <div className="card" style={{ borderLeft: `3px solid ${totalGastadoConLimit > totalLimit ? 'var(--danger)' : 'var(--success)'}` }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Gastado (categorizados)</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: totalGastadoConLimit > totalLimit ? 'var(--danger)' : 'var(--success)', margin: '0.3rem 0' }}>
              ${totalGastadoConLimit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {totalLimit > 0 ? `${Math.round((totalGastadoConLimit / totalLimit) * 100)}% del presupuesto` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Categories with budgets */}
      {presupuestos.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem' }}>Con límite asignado</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {categorias
              .filter(c => presMap[c.id])
              .map(cat => {
                const pres = presMap[cat.id]
                const gastado = gastosMap[cat.id] || 0
                const limite = parseFloat(pres.monto_limite)
                const pct = Math.min((gastado / limite) * 100, 999)
                const color = getPctColor(pct)
                const disponible = limite - gastado
                return (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{cat.icono} {cat.nombre}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color }}>
                          ${gastado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          <span style={{ color: 'var(--text-muted)' }}>
                            {' / '}${limite.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color, minWidth: '36px', textAlign: 'right' }}>
                          {Math.round(pct)}%
                        </span>
                        <button onClick={() => openEdit(cat, pres)} className="btn icon-btn" style={{ fontSize: '0.8rem' }}>✏️</button>
                        <button onClick={() => handleDelete(pres)} className="btn icon-btn danger" style={{ fontSize: '0.8rem' }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ background: '#222', borderRadius: '4px', height: '6px' }}>
                      <div style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: color,
                        height: '100%', borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    {pct >= 80 && (
                      <p style={{ fontSize: '0.73rem', color, marginTop: '0.25rem' }}>
                        {pct >= 100
                          ? `⚠️ Superado por $${Math.abs(disponible).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : `⚡ Quedan $${disponible.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      </p>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Categories without budgets */}
      <div className="card">
        <h2 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem' }}>
          {presupuestos.length === 0 ? 'Asignar límites por categoría' : 'Sin límite asignado'}
        </h2>
        {presupuestos.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Hacé clic en "+ Límite" para definir cuánto querés gastar en cada categoría este mes.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {categorias
            .filter(c => !presMap[c.id])
            .map(cat => {
              const gastado = gastosMap[cat.id] || 0
              return (
                <div key={cat.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.75rem', background: '#111', borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '0.88rem' }}>{cat.icono} {cat.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {gastado > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        ${gastado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} gastado
                      </span>
                    )}
                    <button onClick={() => openEdit(cat, null)} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                      + Límite
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                {editingCat?.icono} {editingCat?.nombre}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Límite para {MESES[mes]} {anio}
            </p>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Monto límite ($)</label>
                <input
                  type="number" step="0.01" min="1"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  placeholder="ej: 50000"
                  autoFocus required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar límite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
