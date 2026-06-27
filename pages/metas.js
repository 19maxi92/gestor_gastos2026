import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const ICONOS = ['⭐','🏖️','🚗','🏠','💻','✈️','🎓','💍','🏋️','📱','🎸','🌍','💊','🐾','🎮','💰']

const emptyForm = { nombre: '', monto_objetivo: '', fecha_limite: '', icono: '⭐', notas: '' }

export default function Metas() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metas, setMetas] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [showAporte, setShowAporte] = useState(null) // meta id
  const [aporteInput, setAporteInput] = useState('')
  const [savingAporte, setSavingAporte] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadMetas(session.user.id)
    })
  }, [])

  const loadMetas = async (userId) => {
    const { data } = await supabase
      .from('metas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setMetas(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (m) => {
    setEditingId(m.id)
    setForm({
      nombre: m.nombre,
      monto_objetivo: String(m.monto_objetivo),
      fecha_limite: m.fecha_limite || '',
      icono: m.icono || '⭐',
      notas: m.notas || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.monto_objetivo || parseFloat(form.monto_objetivo) <= 0) { setFormError('El objetivo debe ser mayor a 0'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      nombre: form.nombre.trim(),
      monto_objetivo: parseFloat(form.monto_objetivo),
      fecha_limite: form.fecha_limite || null,
      icono: form.icono,
      notas: form.notas || null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('metas').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('metas').insert({ ...payload, user_id: user.id, monto_actual: 0 }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadMetas(user.id) }
    setSaving(false)
  }

  const handleAporte = async (meta) => {
    const monto = parseFloat(aporteInput)
    if (!monto || monto <= 0) return
    setSavingAporte(true)
    const nuevo = Math.min(parseFloat(meta.monto_actual) + monto, parseFloat(meta.monto_objetivo))
    await supabase.from('metas').update({ monto_actual: nuevo }).eq('id', meta.id)
    setShowAporte(null)
    setAporteInput('')
    loadMetas(user.id)
    setSavingAporte(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta meta?')) return
    await supabase.from('metas').delete().eq('id', id)
    loadMetas(user.id)
  }

  const getDaysLeft = (fechaLimite) => {
    if (!fechaLimite) return null
    const diff = Math.ceil((new Date(fechaLimite + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const completadas = metas.filter(m => parseFloat(m.monto_actual) >= parseFloat(m.monto_objetivo))
  const activas = metas.filter(m => parseFloat(m.monto_actual) < parseFloat(m.monto_objetivo))

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>⭐ Metas de Ahorro</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Objetivos de ahorro con seguimiento</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Nueva meta</button>
      </div>

      {metas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⭐</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés metas de ahorro creadas</p>
          <button onClick={openAdd} className="btn btn-primary">+ Crear primera meta</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activas.map(meta => {
            const actual = parseFloat(meta.monto_actual)
            const objetivo = parseFloat(meta.monto_objetivo)
            const pct = Math.min((actual / objetivo) * 100, 100)
            const daysLeft = getDaysLeft(meta.fecha_limite)
            const falta = objetivo - actual
            return (
              <div key={meta.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{meta.icono}</span>
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '1rem' }}>{meta.nombre}</p>
                      {daysLeft !== null && (
                        <p style={{ fontSize: '0.78rem', color: daysLeft < 30 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {daysLeft > 0 ? `${daysLeft} días restantes` : '⚠️ Plazo vencido'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => openEdit(meta)} className="btn icon-btn">✏️</button>
                    <button onClick={() => handleDelete(meta.id)} className="btn icon-btn danger">🗑️</button>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      ${actual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ahorrado
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                      ${objetivo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} objetivo · {Math.round(pct)}%
                    </span>
                  </div>
                  <div style={{ background: '#222', borderRadius: '6px', height: '10px' }}>
                    <div style={{
                      width: `${pct}%`,
                      background: pct >= 80 ? 'var(--success)' : 'var(--primary)',
                      height: '100%', borderRadius: '6px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Falta: ${falta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>

                {showAporte === meta.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={aporteInput}
                      onChange={e => setAporteInput(e.target.value)}
                      placeholder="¿Cuánto aportás?"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAporte(meta)}
                      disabled={savingAporte}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {savingAporte ? '...' : 'Aportar'}
                    </button>
                    <button onClick={() => { setShowAporte(null); setAporteInput('') }} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowAporte(meta.id); setAporteInput('') }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    + Aportar
                  </button>
                )}
              </div>
            )
          })}

          {completadas.length > 0 && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Completadas 🎉</p>
              {completadas.map(meta => (
                <div key={meta.id} className="card" style={{ opacity: 0.7, borderLeft: '3px solid var(--success)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.8rem' }}>{meta.icono}</span>
                      <div>
                        <p style={{ fontWeight: '600' }}>{meta.nombre} ✅</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--success)' }}>
                          ${parseFloat(meta.monto_objetivo).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} alcanzado
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(meta.id)} className="btn icon-btn danger">🗑️</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar meta' : 'Nueva meta de ahorro'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Ícono</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {ICONOS.map(ic => (
                    <button
                      key={ic} type="button"
                      onClick={() => setForm({ ...form, icono: ic })}
                      style={{
                        background: form.icono === ic ? 'var(--primary)' : 'var(--border)',
                        border: 'none', borderRadius: '8px', padding: '0.4rem 0.5rem',
                        cursor: 'pointer', fontSize: '1.1rem',
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej: Viaje a Europa, Auto nuevo..." autoFocus required />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Objetivo ($) *</label>
                  <input type="number" step="0.01" min="1" value={form.monto_objetivo} onChange={e => setForm({ ...form, monto_objetivo: e.target.value })} placeholder="0" required />
                </div>
                <div>
                  <label className="form-label">Fecha límite</label>
                  <input type="date" value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ resize: 'vertical' }} />
              </div>
              {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear meta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
