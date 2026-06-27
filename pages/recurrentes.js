import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const CUENTAS = ['Efectivo', 'Débito', 'Crédito', 'Billetera digital', 'Ahorros']

const emptyForm = {
  nombre: '',
  monto: '',
  categoria_id: '',
  cuenta: 'Débito',
  dia_cobro: '',
  descripcion: '',
}

export default function Recurrentes() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recurrentes, setRecurrentes] = useState([])
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
    const [recRes, catRes] = await Promise.all([
      supabase
        .from('recurrentes')
        .select('*, categorias(nombre, icono, color)')
        .eq('user_id', userId)
        .order('dia_cobro'),
      supabase.from('categorias').select('*').order('nombre'),
    ])
    setRecurrentes(recRes.data || [])
    setCategorias(catRes.data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (r) => {
    setEditingId(r.id)
    setForm({
      nombre: r.nombre,
      monto: String(r.monto),
      categoria_id: r.categoria_id ? String(r.categoria_id) : '',
      cuenta: r.cuenta,
      dia_cobro: String(r.dia_cobro),
      descripcion: r.descripcion || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const dia = parseInt(form.dia_cobro)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setFormError('El monto debe ser mayor a 0'); return }
    if (!dia || dia < 1 || dia > 31) { setFormError('El día debe ser entre 1 y 31'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      nombre: form.nombre.trim(),
      monto: parseFloat(form.monto),
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      cuenta: form.cuenta,
      dia_cobro: dia,
      descripcion: form.descripcion || null,
      activo: true,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('recurrentes').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('recurrentes').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadAll(user.id) }
    setSaving(false)
  }

  const handleRegistrar = async (r) => {
    setRegistrando(r.id)
    const hoy = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('gastos').insert({
      user_id: user.id,
      fecha: hoy,
      monto: r.monto,
      categoria_id: r.categoria_id,
      cuenta: r.cuenta,
      descripcion: r.nombre,
      notas: 'Gasto recurrente',
      divisa: 'ARS',
    })
    if (!error) {
      setSuccessMsg(`✅ "${r.nombre}" registrado como gasto`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
    setRegistrando(null)
  }

  const handleToggle = async (r) => {
    await supabase.from('recurrentes').update({ activo: !r.activo }).eq('id', r.id)
    loadAll(user.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto recurrente?')) return
    await supabase.from('recurrentes').delete().eq('id', id)
    loadAll(user.id)
  }

  const getDaysUntil = (dia) => {
    const today = new Date()
    const todayDay = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return dia >= todayDay ? dia - todayDay : daysInMonth - todayDay + dia
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const activos = recurrentes.filter(r => r.activo)
  const inactivos = recurrentes.filter(r => !r.activo)
  const totalMensual = activos.reduce((s, r) => s + parseFloat(r.monto), 0)

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>🔄 Gastos Recurrentes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gastos fijos que se repiten cada mes</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Agregar</button>
      </div>

      {successMsg && (
        <div style={{ background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: 'var(--success)' }}>
          {successMsg}
        </div>
      )}

      {activos.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{activos.length} recurrentes activos</p>
          <p style={{ fontWeight: '700', color: 'var(--primary-light)' }}>
            ${totalMensual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mes
          </p>
        </div>
      )}

      {activos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés gastos recurrentes cargados</p>
          <button onClick={openAdd} className="btn btn-primary">+ Agregar primero</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {activos.map(r => {
            const days = getDaysUntil(r.dia_cobro)
            const soon = days <= 3
            return (
              <div key={r.id} className="gasto-row" style={{ borderLeft: soon ? '3px solid var(--warning)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: (r.categorias?.color || '#7c3aed') + '25',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                  }}>
                    {r.categorias?.icono || '🔄'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.nombre}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {r.categorias?.nombre || 'Sin cat.'} · {r.cuenta} · día {r.dia_cobro}
                      {' · '}
                      <span style={{ color: soon ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {days === 0 ? '¡hoy!' : days === 1 ? 'mañana' : `en ${days} días`}
                      </span>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontWeight: '700', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                    -${parseFloat(r.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <button
                    onClick={() => handleRegistrar(r)}
                    disabled={registrando === r.id}
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    title="Registrar como gasto hoy"
                  >
                    {registrando === r.id ? '...' : '✓ Pagar'}
                  </button>
                  <button onClick={() => openEdit(r)} className="btn icon-btn">✏️</button>
                  <button onClick={() => handleToggle(r)} className="btn icon-btn" title="Desactivar" style={{ fontSize: '0.75rem' }}>⏸</button>
                  <button onClick={() => handleDelete(r.id)} className="btn icon-btn danger">🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {inactivos.length > 0 && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Desactivados</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inactivos.map(r => (
              <div key={r.id} className="gasto-row" style={{ opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '1.2rem' }}>{r.categorias?.icono || '🔄'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.88rem', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>día {r.dia_cobro} · ${parseFloat(r.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleToggle(r)} className="btn icon-btn" title="Reactivar" style={{ fontSize: '0.75rem' }}>▶</button>
                  <button onClick={() => handleDelete(r.id)} className="btn icon-btn danger">🗑️</button>
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar recurrente' : 'Nuevo gasto recurrente'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Alquiler, Gimnasio..." autoFocus required />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Monto ($) *</label>
                  <input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" required />
                </div>
                <div>
                  <label className="form-label">Día del mes *</label>
                  <input type="number" min="1" max="31" value={form.dia_cobro} onChange={e => setForm({ ...form, dia_cobro: e.target.value })} placeholder="1-31" required />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Categoría</label>
                  <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                    <option value=''>Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Cuenta</label>
                  <select value={form.cuenta} onChange={e => setForm({ ...form, cuenta: e.target.value })}>
                    {CUENTAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
