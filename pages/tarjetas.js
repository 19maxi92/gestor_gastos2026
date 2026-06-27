import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const BANCOS = ['', 'Galicia', 'Santander', 'Macro', 'BBVA', 'HSBC', 'Icbc', 'Naranja X', 'Brubank', 'Uala', 'Mercado Pago', 'Personal Pay', 'Otro']

const emptyForm = {
  nombre: '',
  banco: '',
  limite: '',
  dia_corte: '',
  dia_pago: '',
  deuda_actual: '0',
}

const CARD_COLORS = ['#7c3aed', '#ef4444', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#6366f1', '#f97316']

export default function Tarjetas() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tarjetas, setTarjetas] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingDeuda, setEditingDeuda] = useState(null)
  const [deudaInput, setDeudaInput] = useState('')
  const [savingDeuda, setSavingDeuda] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadTarjetas(session.user.id)
    })
  }, [])

  const loadTarjetas = async (userId) => {
    const { data } = await supabase
      .from('tarjetas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    setTarjetas(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditingId(t.id)
    setForm({
      nombre: t.nombre,
      banco: t.banco || '',
      limite: t.limite ? String(t.limite) : '',
      dia_corte: String(t.dia_corte),
      dia_pago: String(t.dia_pago),
      deuda_actual: String(t.deuda_actual || 0),
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.dia_corte || !form.dia_pago) { setFormError('Los días de corte y pago son obligatorios'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      nombre: form.nombre.trim(),
      banco: form.banco || null,
      limite: form.limite ? parseFloat(form.limite) : null,
      dia_corte: parseInt(form.dia_corte),
      dia_pago: parseInt(form.dia_pago),
      deuda_actual: parseFloat(form.deuda_actual) || 0,
      activa: true,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('tarjetas').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('tarjetas').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadTarjetas(user.id) }
    setSaving(false)
  }

  const handleUpdateDeuda = async (tarjeta) => {
    const monto = parseFloat(deudaInput)
    if (isNaN(monto) || monto < 0) return
    setSavingDeuda(true)
    await supabase.from('tarjetas').update({ deuda_actual: monto }).eq('id', tarjeta.id)
    setEditingDeuda(null)
    setDeudaInput('')
    loadTarjetas(user.id)
    setSavingDeuda(false)
  }

  const handleToggle = async (t) => {
    await supabase.from('tarjetas').update({ activa: !t.activa }).eq('id', t.id)
    loadTarjetas(user.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta tarjeta?')) return
    await supabase.from('tarjetas').delete().eq('id', id)
    loadTarjetas(user.id)
  }

  const getDaysUntil = (dia) => {
    const today = new Date()
    const todayDay = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const diff = dia >= todayDay ? dia - todayDay : daysInMonth - todayDay + dia
    return diff
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const activas = tarjetas.filter(t => t.activa)
  const inactivas = tarjetas.filter(t => !t.activa)
  const totalDeuda = activas.reduce((s, t) => s + (parseFloat(t.deuda_actual) || 0), 0)

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>🏦 Tarjetas de Crédito</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Límites, cortes y fechas de pago</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Agregar tarjeta</button>
      </div>

      {activas.length > 1 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{activas.length} tarjetas activas</p>
          <p style={{ fontWeight: '700', color: 'var(--danger)' }}>
            Total deuda: ${totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      )}

      {activas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏦</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés tarjetas cargadas</p>
          <button onClick={openAdd} className="btn btn-primary">+ Agregar primera tarjeta</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {activas.map((t, idx) => {
            const deuda = parseFloat(t.deuda_actual) || 0
            const limite = t.limite ? parseFloat(t.limite) : null
            const pct = limite ? Math.min((deuda / limite) * 100, 100) : null
            const color = pct === null ? '#71717a' : pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
            const cardColor = CARD_COLORS[idx % CARD_COLORS.length]
            const diasCorte = getDaysUntil(t.dia_corte)
            const diasPago = getDaysUntil(t.dia_pago)
            const cortePróximo = diasCorte <= 5

            return (
              <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card visual */}
                <div style={{
                  background: `linear-gradient(135deg, ${cardColor}, ${cardColor}99)`,
                  padding: '1.25rem',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: '700', fontSize: '1rem', color: 'white' }}>{t.nombre}</p>
                      {t.banco && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.2rem' }}>{t.banco}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => openEdit(t)} className="btn icon-btn" style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.15)' }}>✏️</button>
                      <button onClick={() => handleToggle(t)} className="btn icon-btn" style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>⏸</button>
                      <button onClick={() => handleDelete(t.id)} className="btn icon-btn" style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.15)' }}>🗑️</button>
                    </div>
                  </div>
                  {limite && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
                      Límite: ${limite.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '1rem' }}>
                  {/* Deuda actual */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Deuda actual</p>
                      <button
                        onClick={() => { setEditingDeuda(t.id); setDeudaInput(String(deuda)) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem' }}
                      >
                        ✏️ actualizar
                      </button>
                    </div>
                    {editingDeuda === t.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input type="number" step="0.01" min="0" value={deudaInput} onChange={e => setDeudaInput(e.target.value)} autoFocus style={{ fontSize: '0.88rem', padding: '0.35rem 0.5rem' }} />
                        <button onClick={() => handleUpdateDeuda(t)} disabled={savingDeuda} className="btn btn-primary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>{savingDeuda ? '...' : 'OK'}</button>
                        <button onClick={() => setEditingDeuda(null)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    ) : (
                      <p style={{ fontWeight: '700', fontSize: '1.3rem', color: pct !== null && pct >= 70 ? color : 'var(--text)' }}>
                        ${deuda.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        {limite && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'normal' }}> / ${limite.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>}
                      </p>
                    )}
                    {pct !== null && editingDeuda !== t.id && (
                      <div style={{ background: '#222', borderRadius: '4px', height: '5px', marginTop: '0.4rem' }}>
                        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{
                      flex: 1, padding: '0.5rem 0.6rem', borderRadius: '8px',
                      background: cortePróximo ? '#f59e0b15' : '#111',
                      border: cortePróximo ? '1px solid #f59e0b40' : '1px solid transparent',
                    }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Corte (día {t.dia_corte})</p>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600', color: cortePróximo ? 'var(--warning)' : 'var(--text)' }}>
                        {diasCorte === 0 ? '¡Hoy!' : diasCorte === 1 ? 'Mañana' : `${diasCorte} días`}
                      </p>
                    </div>
                    <div style={{ flex: 1, padding: '0.5rem 0.6rem', borderRadius: '8px', background: '#111' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pago (día {t.dia_pago})</p>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        {diasPago === 0 ? '¡Hoy!' : diasPago === 1 ? 'Mañana' : `${diasPago} días`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {inactivas.length > 0 && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Inactivas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inactivas.map(t => (
              <div key={t.id} className="gasto-row" style={{ opacity: 0.5 }}>
                <p style={{ fontSize: '0.88rem', textDecoration: 'line-through' }}>{t.nombre} {t.banco && `· ${t.banco}`}</p>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleToggle(t)} className="btn icon-btn" title="Reactivar" style={{ fontSize: '0.75rem' }}>▶</button>
                  <button onClick={() => handleDelete(t.id)} className="btn icon-btn danger">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Nombre / apodo *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Visa Galicia" autoFocus required />
                </div>
                <div>
                  <label className="form-label">Banco</label>
                  <select value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}>
                    {BANCOS.map(b => <option key={b} value={b}>{b || '— Sin banco —'}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Límite ($)</label>
                  <input type="number" step="0.01" min="0" value={form.limite} onChange={e => setForm({ ...form, limite: e.target.value })} placeholder="Opcional" />
                </div>
                <div>
                  <label className="form-label">Deuda actual ($)</label>
                  <input type="number" step="0.01" min="0" value={form.deuda_actual} onChange={e => setForm({ ...form, deuda_actual: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Día de corte *</label>
                  <input type="number" min="1" max="31" value={form.dia_corte} onChange={e => setForm({ ...form, dia_corte: e.target.value })} placeholder="ej: 15" required />
                </div>
                <div>
                  <label className="form-label">Día de pago *</label>
                  <input type="number" min="1" max="31" value={form.dia_pago} onChange={e => setForm({ ...form, dia_pago: e.target.value })} placeholder="ej: 5" required />
                </div>
              </div>
              {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar' : 'Agregar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
