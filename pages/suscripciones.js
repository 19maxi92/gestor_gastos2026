import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const emptyForm = {
  nombre: '',
  monto: '',
  frecuencia: 'mensual',
  fecha_proximo_cobro: '',
  categoria_id: '',
  notas: '',
}

export default function Suscripciones() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [suscripciones, setSuscripciones] = useState([])
  const [categorias, setCategorias] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [registrando, setRegistrando] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadAll(session.user.id)
    })
  }, [])

  const loadAll = async (userId) => {
    const [suscRes, catRes] = await Promise.all([
      supabase
        .from('suscripciones')
        .select('*, categorias(nombre, icono, color)')
        .eq('user_id', userId)
        .order('fecha_proximo_cobro'),
      supabase.from('categorias').select('*').order('nombre'),
    ])
    setSuscripciones(suscRes.data || [])
    setCategorias(catRes.data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    const hoy = new Date()
    hoy.setMonth(hoy.getMonth() + 1)
    setForm({ ...emptyForm, fecha_proximo_cobro: hoy.toISOString().split('T')[0] })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({
      nombre: s.nombre,
      monto: String(s.monto),
      frecuencia: s.frecuencia,
      fecha_proximo_cobro: s.fecha_proximo_cobro,
      categoria_id: s.categoria_id ? String(s.categoria_id) : '',
      notas: s.notas || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setFormError('El monto debe ser mayor a 0'); return }
    if (!form.fecha_proximo_cobro) { setFormError('La fecha de próximo cobro es obligatoria'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      nombre: form.nombre.trim(),
      monto: parseFloat(form.monto),
      frecuencia: form.frecuencia,
      fecha_proximo_cobro: form.fecha_proximo_cobro,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      notas: form.notas || null,
      activo: true,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('suscripciones').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('suscripciones').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadAll(user.id) }
    setSaving(false)
  }

  const handleRegistrar = async (s) => {
    setRegistrando(s.id)
    const hoy = new Date().toISOString().split('T')[0]

    // Create gasto
    await supabase.from('gastos').insert({
      user_id: user.id,
      fecha: hoy,
      monto: s.monto,
      categoria_id: s.categoria_id,
      cuenta: 'Débito',
      descripcion: s.nombre,
      notas: `Suscripción ${s.frecuencia}`,
      divisa: 'ARS',
    })

    // Advance next billing date
    const nextDate = new Date(s.fecha_proximo_cobro + 'T12:00:00')
    if (s.frecuencia === 'anual') nextDate.setFullYear(nextDate.getFullYear() + 1)
    else nextDate.setMonth(nextDate.getMonth() + 1)

    await supabase.from('suscripciones').update({
      fecha_proximo_cobro: nextDate.toISOString().split('T')[0]
    }).eq('id', s.id)

    setSuccessMsg(`✅ "${s.nombre}" registrado. Próximo cobro: ${nextDate.toLocaleDateString('es-AR')}`)
    setTimeout(() => setSuccessMsg(''), 4000)
    loadAll(user.id)
    setRegistrando(null)
  }

  const handleToggle = async (s) => {
    await supabase.from('suscripciones').update({ activo: !s.activo }).eq('id', s.id)
    loadAll(user.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta suscripción?')) return
    await supabase.from('suscripciones').delete().eq('id', id)
    loadAll(user.id)
  }

  const getDaysUntil = (fecha) => {
    const diff = Math.ceil((new Date(fecha + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const activas = suscripciones.filter(s => s.activo)
  const inactivas = suscripciones.filter(s => !s.activo)
  const totalMensual = activas.reduce((s, sub) => {
    const m = parseFloat(sub.monto)
    return s + (sub.frecuencia === 'anual' ? m / 12 : m)
  }, 0)

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>💳 Suscripciones</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Netflix, Spotify, y todo lo que se renueva</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Agregar</button>
      </div>

      {successMsg && (
        <div style={{ background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: 'var(--success)' }}>
          {successMsg}
        </div>
      )}

      {activas.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{activas.length} suscripciones activas</p>
          <p style={{ fontWeight: '700', color: 'var(--primary-light)' }}>
            ~${totalMensual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mes
          </p>
        </div>
      )}

      {activas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💳</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés suscripciones cargadas</p>
          <button onClick={openAdd} className="btn btn-primary">+ Agregar primera</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {activas.map(s => {
            const days = getDaysUntil(s.fecha_proximo_cobro)
            const overdue = days < 0
            const urgent = days >= 0 && days <= 3
            const soon = days > 3 && days <= 7
            const borderColor = overdue || urgent ? 'var(--danger)' : soon ? 'var(--warning)' : 'var(--border)'
            const daysColor = overdue || urgent ? 'var(--danger)' : soon ? 'var(--warning)' : 'var(--text-muted)'
            return (
              <div key={s.id} className="gasto-row" style={{ borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: (s.categorias?.color || '#06b6d4') + '25',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                  }}>
                    {s.categorias?.icono || '💳'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.nombre}
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.4rem' }}>
                        ({s.frecuencia})
                      </span>
                    </p>
                    <p style={{ color: daysColor, fontSize: '0.74rem' }}>
                      Próximo cobro: {new Date(s.fecha_proximo_cobro + 'T12:00:00').toLocaleDateString('es-AR')}
                      {' · '}
                      {overdue ? '⚠️ Vencida' : days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days} días`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontWeight: '700', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                    -${parseFloat(s.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <button
                    onClick={() => handleRegistrar(s)}
                    disabled={registrando === s.id}
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  >
                    {registrando === s.id ? '...' : '✓ Cobrado'}
                  </button>
                  <button onClick={() => openEdit(s)} className="btn icon-btn">✏️</button>
                  <button onClick={() => handleToggle(s)} className="btn icon-btn" title="Pausar" style={{ fontSize: '0.75rem' }}>⏸</button>
                  <button onClick={() => handleDelete(s.id)} className="btn icon-btn danger">🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {inactivas.length > 0 && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Pausadas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inactivas.map(s => (
              <div key={s.id} className="gasto-row" style={{ opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.categorias?.icono || '💳'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.88rem', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>${parseFloat(s.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} · {s.frecuencia}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleToggle(s)} className="btn icon-btn" title="Reactivar" style={{ fontSize: '0.75rem' }}>▶</button>
                  <button onClick={() => handleDelete(s.id)} className="btn icon-btn danger">🗑️</button>
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar suscripción' : 'Nueva suscripción'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Netflix, Spotify, Adobe..." autoFocus required />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Monto ($) *</label>
                  <input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" required />
                </div>
                <div>
                  <label className="form-label">Frecuencia</label>
                  <select value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value })}>
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Próximo cobro *</label>
                  <input type="date" value={form.fecha_proximo_cobro} onChange={e => setForm({ ...form, fecha_proximo_cobro: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Categoría</label>
                  <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                    <option value=''>Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ resize: 'vertical' }} />
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
