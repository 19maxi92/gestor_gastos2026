import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const emptyForm = {
  persona: '',
  tipo: 'me_debe',
  monto: '',
  descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
}

export default function Deudas() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deudas, setDeudas] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showSaldadas, setShowSaldadas] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadDeudas(session.user.id)
    })
  }, [])

  const loadDeudas = async (userId) => {
    const { data } = await supabase
      .from('deudas')
      .select('*')
      .eq('user_id', userId)
      .order('saldada')
      .order('fecha', { ascending: false })
    setDeudas(data || [])
    setLoading(false)
  }

  const openAdd = (tipoDefault = 'me_debe') => {
    setEditingId(null)
    setForm({ ...emptyForm, tipo: tipoDefault })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (d) => {
    setEditingId(d.id)
    setForm({
      persona: d.persona,
      tipo: d.tipo,
      monto: String(d.monto),
      descripcion: d.descripcion || '',
      fecha: d.fecha,
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.persona.trim()) { setFormError('El nombre es obligatorio'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setFormError('El monto debe ser mayor a 0'); return }

    setSaving(true)
    setFormError('')

    const payload = {
      persona: form.persona.trim(),
      tipo: form.tipo,
      monto: parseFloat(form.monto),
      descripcion: form.descripcion || null,
      fecha: form.fecha,
      saldada: false,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('deudas').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('deudas').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error: ' + error.message) }
    else { setShowModal(false); loadDeudas(user.id) }
    setSaving(false)
  }

  const handleSaldar = async (id) => {
    await supabase.from('deudas').update({ saldada: true }).eq('id', id)
    loadDeudas(user.id)
  }

  const handleReabrir = async (id) => {
    await supabase.from('deudas').update({ saldada: false }).eq('id', id)
    loadDeudas(user.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta deuda?')) return
    await supabase.from('deudas').delete().eq('id', id)
    loadDeudas(user.id)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const activas = deudas.filter(d => !d.saldada)
  const saldadas = deudas.filter(d => d.saldada)

  const meDebenTotal = activas.filter(d => d.tipo === 'me_debe').reduce((s, d) => s + parseFloat(d.monto), 0)
  const leDoboTotal = activas.filter(d => d.tipo === 'le_debo').reduce((s, d) => s + parseFloat(d.monto), 0)
  const balance = meDebenTotal - leDoboTotal

  // Group by persona
  const personasMap = {}
  activas.forEach(d => {
    if (!personasMap[d.persona]) personasMap[d.persona] = { me_debe: 0, le_debo: 0 }
    personasMap[d.persona][d.tipo] += parseFloat(d.monto)
  })

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>🤝 Deudas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Quién te debe y a quién le debés</p>
        </div>
        <button onClick={() => openAdd()} className="btn btn-primary">+ Registrar deuda</button>
      </div>

      {/* Summary cards */}
      {activas.length > 0 && (
        <div className="cards-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ borderLeft: '3px solid var(--success)', cursor: 'pointer' }} onClick={() => openAdd('me_debe')}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Me deben</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--success)', margin: '0.3rem 0' }}>
              +${meDebenTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {activas.filter(d => d.tipo === 'me_debe').length} deuda{activas.filter(d => d.tipo === 'me_debe').length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="card" style={{ borderLeft: '3px solid var(--danger)', cursor: 'pointer' }} onClick={() => openAdd('le_debo')}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Le debo a</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--danger)', margin: '0.3rem 0' }}>
              -${leDoboTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {activas.filter(d => d.tipo === 'le_debo').length} deuda{activas.filter(d => d.tipo === 'le_debo').length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="card" style={{ borderLeft: `3px solid ${balance >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Balance neto</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '700', color: balance >= 0 ? 'var(--success)' : 'var(--danger)', margin: '0.3rem 0' }}>
              {balance >= 0 ? '+' : ''}${balance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{balance >= 0 ? 'a tu favor' : 'en contra'}</p>
          </div>
        </div>
      )}

      {/* Resumen por persona */}
      {Object.keys(personasMap).length > 1 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Resumen por persona</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.entries(personasMap).map(([persona, { me_debe, le_debo }]) => {
              const net = me_debe - le_debo
              return (
                <div key={persona} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                  <span>{persona}</span>
                  <span style={{ fontWeight: '600', color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {net >= 0 ? `te debe $${net.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `le debés $${Math.abs(net).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active debts */}
      {activas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤝</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No tenés deudas activas registradas</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => openAdd('me_debe')} className="btn btn-primary">+ Me deben</button>
            <button onClick={() => openAdd('le_debo')} className="btn" style={{ background: '#ef444420', color: 'var(--danger)', border: '1px solid #ef444440' }}>+ Le debo a</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {/* Me deben */}
          {activas.filter(d => d.tipo === 'me_debe').length > 0 && (
            <>
              <p style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.25rem' }}>Me deben ↓</p>
              {activas.filter(d => d.tipo === 'me_debe').map(d => (
                <DeudaRow key={d.id} d={d} onSaldar={handleSaldar} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </>
          )}
          {/* Le debo */}
          {activas.filter(d => d.tipo === 'le_debo').length > 0 && (
            <>
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.75rem' }}>Le debo a ↓</p>
              {activas.filter(d => d.tipo === 'le_debo').map(d => (
                <DeudaRow key={d.id} d={d} onSaldar={handleSaldar} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Settled debts toggle */}
      {saldadas.length > 0 && (
        <div>
          <button
            onClick={() => setShowSaldadas(!showSaldadas)}
            className="btn"
            style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.3rem 0', marginBottom: '0.5rem' }}
          >
            {showSaldadas ? '▲' : '▼'} {saldadas.length} deuda{saldadas.length !== 1 ? 's' : ''} saldada{saldadas.length !== 1 ? 's' : ''}
          </button>
          {showSaldadas && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {saldadas.map(d => (
                <div key={d.id} className="gasto-row" style={{ opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '1.1rem' }}>{d.tipo === 'me_debe' ? '✅' : '✅'}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.88rem', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.tipo === 'me_debe' ? `${d.persona} te pagó` : `Pagaste a ${d.persona}`}
                      </p>
                      <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{d.descripcion || '—'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      ${parseFloat(d.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <button onClick={() => handleReabrir(d.id)} className="btn icon-btn" title="Reabrir" style={{ fontSize: '0.75rem' }}>↩</button>
                    <button onClick={() => handleDelete(d.id)} className="btn icon-btn danger">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingId ? 'Editar deuda' : 'Nueva deuda'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tipo selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { val: 'me_debe', label: '💚 Me deben', color: 'var(--success)' },
                  { val: 'le_debo', label: '🔴 Le debo a', color: 'var(--danger)' },
                ].map(opt => (
                  <button
                    key={opt.val} type="button"
                    onClick={() => setForm({ ...form, tipo: opt.val })}
                    style={{
                      padding: '0.6rem', borderRadius: '8px', border: '2px solid',
                      borderColor: form.tipo === opt.val ? opt.color : 'var(--border)',
                      background: form.tipo === opt.val ? opt.color + '18' : 'transparent',
                      color: form.tipo === opt.val ? opt.color : 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="form-label">Persona *</label>
                <input type="text" value={form.persona} onChange={e => setForm({ ...form, persona: e.target.value })} placeholder="Nombre" autoFocus required />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Monto ($) *</label>
                  <input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" required />
                </div>
                <div>
                  <label className="form-label">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Descripción (opcional)</label>
                <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="¿Por qué?" />
              </div>
              {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

function DeudaRow({ d, onSaldar, onEdit, onDelete }) {
  const esMeDebe = d.tipo === 'me_debe'
  const color = esMeDebe ? 'var(--success)' : 'var(--danger)'
  return (
    <div className="gasto-row" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
          background: color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
        }}>
          {esMeDebe ? '💚' : '🔴'}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>{d.persona}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.descripcion || (esMeDebe ? 'Te debe' : 'Le debés')}
            {' · '}{new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        <span style={{ fontWeight: '700', color, whiteSpace: 'nowrap' }}>
          {esMeDebe ? '+' : '-'}${parseFloat(d.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
        <button
          onClick={() => onSaldar(d.id)}
          className="btn btn-primary"
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: color }}
          title="Marcar como saldada"
        >
          ✓ Saldar
        </button>
        <button onClick={() => onEdit(d)} className="btn icon-btn">✏️</button>
        <button onClick={() => onDelete(d.id)} className="btn icon-btn danger">🗑️</button>
      </div>
    </div>
  )
}
