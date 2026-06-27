import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const emptyForm = {
  nombre: '',
  monto: '',
  dia_vencimiento: '',
  categoria_id: '',
  notas: '',
}

export default function Vencimientos() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vencimientos, setVencimientos] = useState([])
  const [categorias, setCategorias] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadAll(session.user.id)
    })
  }, [])

  const loadAll = async (userId) => {
    const [vencRes, catRes] = await Promise.all([
      supabase
        .from('vencimientos')
        .select('*, categorias(nombre, icono, color)')
        .eq('user_id', userId)
        .order('dia_vencimiento'),
      supabase.from('categorias').select('*').order('nombre'),
    ])
    setVencimientos(vencRes.data || [])
    setCategorias(catRes.data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (v) => {
    setEditingId(v.id)
    setForm({
      nombre: v.nombre,
      monto: v.monto ? String(v.monto) : '',
      dia_vencimiento: String(v.dia_vencimiento),
      categoria_id: v.categoria_id ? String(v.categoria_id) : '',
      notas: v.notas || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const dia = parseInt(form.dia_vencimiento)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!dia || dia < 1 || dia > 31) { setFormError('El día debe ser entre 1 y 31'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      nombre: form.nombre.trim(),
      monto: form.monto ? parseFloat(form.monto) : null,
      dia_vencimiento: dia,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      notas: form.notas || null,
      activo: true,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('vencimientos').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('vencimientos').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadAll(user.id) }
    setSaving(false)
  }

  const handleToggle = async (v) => {
    await supabase.from('vencimientos').update({ activo: !v.activo }).eq('id', v.id)
    loadAll(user.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este vencimiento?')) return
    await supabase.from('vencimientos').delete().eq('id', id)
    loadAll(user.id)
  }

  // Days until next occurrence
  const getDaysUntil = (dia) => {
    const today = new Date()
    const todayDay = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return dia >= todayDay ? dia - todayDay : daysInMonth - todayDay + dia
  }

  const urgencyColor = (days) => {
    if (days <= 2) return 'var(--danger)'
    if (days <= 5) return 'var(--warning)'
    return 'var(--text-muted)'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const activos = vencimientos.filter(v => v.activo)
  const inactivos = vencimientos.filter(v => !v.activo)

  return (
    <Layout user={user}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>📅 Vencimientos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Facturas y cuentas a pagar cada mes</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Agregar</button>
      </div>

      {/* Active vencimientos */}
      {activos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés vencimientos cargados</p>
          <button onClick={openAdd} className="btn btn-primary">+ Agregar primer vencimiento</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {activos.map(v => {
            const days = getDaysUntil(v.dia_vencimiento)
            const color = urgencyColor(days)
            return (
              <div key={v.id} className="gasto-row" style={{
                borderLeft: days <= 2 ? '3px solid var(--danger)' : days <= 5 ? '3px solid var(--warning)' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: (v.categorias?.color || '#06b6d4') + '25',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                  }}>
                    {v.categorias?.icono || '📄'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.nombre}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {v.categorias?.nombre || 'Sin categoría'} · día {v.dia_vencimiento} de cada mes
                      {v.monto && ` · $${parseFloat(v.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: '700', color }}>
                      {days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days} días`}
                    </p>
                  </div>
                  <button onClick={() => openEdit(v)} className="btn icon-btn" title="Editar">✏️</button>
                  <button onClick={() => handleToggle(v)} className="btn icon-btn" title="Desactivar" style={{ fontSize: '0.75rem' }}>⏸</button>
                  <button onClick={() => handleDelete(v.id)} className="btn icon-btn danger" title="Eliminar">🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inactive vencimientos */}
      {inactivos.length > 0 && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Desactivados</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inactivos.map(v => (
              <div key={v.id} className="gasto-row" style={{ opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '1.3rem' }}>{v.categorias?.icono || '📄'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.88rem', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nombre}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>día {v.dia_vencimiento}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleToggle(v)} className="btn icon-btn" title="Reactivar" style={{ fontSize: '0.75rem' }}>▶</button>
                  <button onClick={() => handleDelete(v.id)} className="btn icon-btn danger" title="Eliminar">🗑️</button>
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar vencimiento' : 'Nuevo vencimiento'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Nombre *</label>
                <input
                  type="text" value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="ej: Alquiler, Netflix, Luz..." autoFocus required
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="form-label">Día del mes *</label>
                  <input
                    type="number" min="1" max="31"
                    value={form.dia_vencimiento}
                    onChange={e => setForm({ ...form, dia_vencimiento: e.target.value })}
                    placeholder="ej: 10"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Monto estimado</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.monto}
                    onChange={e => setForm({ ...form, monto: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Categoría</label>
                <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                  <option value=''>Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea
                  value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  placeholder="Notas..." rows={2} style={{ resize: 'vertical' }}
                />
              </div>

              {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{formError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
