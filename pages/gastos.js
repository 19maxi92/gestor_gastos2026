import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const CUENTAS = ['Efectivo', 'Débito', 'Crédito', 'Billetera digital', 'Ahorros']
const DIVISAS = ['ARS', 'USD Blue', 'USD Oficial']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CAT_KEYWORDS = {
  'Comida': ['comida', 'restaurant', 'resto', 'almuerzo', 'cena', 'desayuno', 'pizza', 'hambur', 'sushi', 'cafe', 'café', 'medialunas', 'facturas', 'empanadas', 'tostadas', 'panaderia'],
  'Transporte': ['uber', 'taxi', 'colectivo', 'nafta', 'combustible', 'tren', 'subte', 'remis', 'peaje', 'estacionamiento', 'cabify'],
  'Supermercado': ['super', 'coto', 'carrefour', 'dia ', 'jumbo', 'verdur', 'feria', 'despensa', 'almacen'],
  'Hogar': ['hogar', 'alquiler', 'expensas', 'luz', 'gas ', 'agua ', 'internet', 'cable', 'plomero', 'electricista', 'limpieza'],
  'Salud': ['farmacia', 'medico', 'médico', 'doctor', 'medicina', 'clinica', 'clínica', 'prepaga', 'salud', 'dentista', 'turno'],
  'Entretenimiento': ['cine', 'teatro', 'concierto', 'show', 'spotify', 'netflix', 'entretenimiento', 'juego', 'bowling'],
  'Ropa': ['ropa', 'zapatillas', 'zapatos', 'vestimenta', 'indumentaria', 'camisa', 'pantalon', 'remera'],
  'Tecnología': ['tecnologia', 'tecnología', 'celular', 'computadora', 'notebook', 'tablet', 'cable usb', 'auricular', 'cargador'],
}

const CUENTA_KEYWORDS = {
  'Débito': ['débito', 'debito', 'debit', 'tarjeta debito'],
  'Crédito': ['crédito', 'credito', 'credit', 'tarjeta credito', 'tarjeta'],
  'Billetera digital': ['billetera', 'mercado pago', 'mp', 'uala', 'personal pay', 'brubank'],
  'Ahorros': ['ahorros', 'caja de ahorro'],
  'Efectivo': ['efectivo', 'cash', 'plata', 'billetes'],
}

function parseTextoLibre(texto, categorias) {
  const t = texto.toLowerCase()

  // Amount: find first number (handles "5000", "5.000", "$5000")
  const montoMatch = t.match(/\$?\s*([\d]+(?:[.,][\d]+)?)/)
  let monto = ''
  if (montoMatch) {
    const raw = montoMatch[1].replace(/\./g, '').replace(',', '.')
    monto = String(parseFloat(raw))
  }

  // Account
  let cuenta = 'Efectivo'
  for (const [cta, keys] of Object.entries(CUENTA_KEYWORDS)) {
    if (keys.some(k => t.includes(k))) { cuenta = cta; break }
  }

  // Category: match against keywords first, then against category names
  let categoria_id = ''
  for (const cat of categorias) {
    const keywords = CAT_KEYWORDS[cat.nombre] || [cat.nombre.toLowerCase()]
    if (keywords.some(k => t.includes(k))) { categoria_id = String(cat.id); break }
  }

  // Description: text after "en" / "para" / "de" before cuenta keywords
  let descripcion = ''
  const enMatch = texto.match(/(?:en|para|de)\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)(?:\s+(?:con|por|usando|$))/i)
  if (enMatch) descripcion = enMatch[1].trim()

  return { monto, cuenta, categoria_id, descripcion }
}

const emptyForm = {
  fecha: new Date().toISOString().split('T')[0],
  monto: '',
  categoria_id: '',
  cuenta: 'Efectivo',
  divisa: 'ARS',
  descripcion: '',
  notas: '',
}

export default function Gastos() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [catFiltro, setCatFiltro] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingGasto, setEditingGasto] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Carga rápida
  const [textoLibre, setTextoLibre] = useState('')
  const [parseMsg, setParseMsg] = useState('')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadCategorias()
    })
  }, [])

  useEffect(() => {
    if (user) loadGastos()
  }, [user, mes, anio, catFiltro])

  const loadCategorias = async () => {
    const { data } = await supabase.from('categorias').select('*').order('nombre')
    setCategorias(data || [])
    setLoading(false)
  }

  const loadGastos = async () => {
    const firstDay = new Date(anio, mes, 1).toISOString().split('T')[0]
    const lastDay = new Date(anio, mes + 1, 0).toISOString().split('T')[0]

    let query = supabase
      .from('gastos')
      .select('*, categorias(nombre, icono, color)')
      .eq('user_id', user.id)
      .gte('fecha', firstDay)
      .lte('fecha', lastDay)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (catFiltro) query = query.eq('categoria_id', catFiltro)

    const { data } = await query
    setGastos(data || [])
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setParseMsg('Tu navegador no soporta voz. Usá Chrome en el celu.')
      return
    }
    const recognition = new SR()
    recognition.lang = 'es-AR'
    recognition.continuous = false
    recognition.interimResults = false
    setListening(true)
    setParseMsg('')
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setListening(false)
      const parsed = parseTextoLibre(transcript, categorias)
      if (parsed.monto) {
        setEditingGasto(null)
        setForm({ ...emptyForm, ...parsed })
        setFormError('')
        setShowModal(true)
      } else {
        setTextoLibre(transcript)
        setParseMsg(`Escuché: "${transcript}" — no encontré el monto, editá y presioná Parsear`)
      }
    }
    recognition.onerror = () => { setListening(false); setParseMsg('Error de micrófono. Revisá los permisos.') }
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  const handleTextoLibre = (e) => {
    e.preventDefault()
    if (!textoLibre.trim()) return
    const parsed = parseTextoLibre(textoLibre, categorias)
    if (!parsed.monto) { setParseMsg('No encontré el monto. Intentá: "gasté 5000 en comida"'); return }
    setEditingGasto(null)
    setForm({ ...emptyForm, ...parsed })
    setParseMsg('')
    setTextoLibre('')
    setFormError('')
    setShowModal(true)
  }

  const openAdd = () => {
    setEditingGasto(null)
    setForm({ ...emptyForm, categoria_id: categorias[0]?.id?.toString() || '' })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (gasto) => {
    setEditingGasto(gasto)
    setForm({
      fecha: gasto.fecha,
      monto: String(gasto.monto),
      categoria_id: gasto.categoria_id ? String(gasto.categoria_id) : '',
      cuenta: gasto.cuenta,
      divisa: gasto.divisa || 'ARS',
      descripcion: gasto.descripcion || '',
      notas: gasto.notas || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.monto || parseFloat(form.monto) <= 0) {
      setFormError('El monto debe ser mayor a 0')
      return
    }
    setSaving(true)
    setFormError('')

    const payload = {
      fecha: form.fecha,
      monto: parseFloat(form.monto),
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      cuenta: form.cuenta,
      divisa: form.divisa,
      descripcion: form.descripcion || null,
      notas: form.notas || null,
    }

    let error
    if (editingGasto) {
      ;({ error } = await supabase.from('gastos').update(payload).eq('id', editingGasto.id))
    } else {
      ;({ error } = await supabase.from('gastos').insert({ ...payload, user_id: user.id }))
    }

    if (error) { setFormError('Error al guardar: ' + error.message) }
    else { setShowModal(false); loadGastos() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    loadGastos()
  }

  const exportCSV = () => {
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Divisa', 'Cuenta', 'Notas']
    const rows = gastos.map(g => [
      g.fecha,
      g.descripcion || '',
      g.categorias?.nombre || '',
      g.monto,
      g.divisa || 'ARS',
      g.cuenta,
      g.notas || '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos_${MESES[mes]}_${anio}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0)
  const anios = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) anios.push(y)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  return (
    <Layout user={user}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>💸 Gastos</h1>
        <button onClick={openAdd} className="btn btn-primary">+ Agregar gasto</button>
      </div>

      {/* Carga rápida */}
      <form onSubmit={handleTextoLibre} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={startListening}
          disabled={listening}
          className="btn"
          title="Dictar gasto por voz"
          style={{
            flexShrink: 0,
            background: listening ? '#ef444422' : 'var(--border)',
            color: listening ? 'var(--danger)' : 'var(--text)',
            border: listening ? '1px solid var(--danger)' : '1px solid transparent',
            fontSize: '1.1rem',
            padding: '0.4rem 0.65rem',
            animation: listening ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}
        >
          🎤
        </button>
        <input
          type="text"
          value={listening ? '🔴 Escuchando...' : textoLibre}
          onChange={e => { if (!listening) { setTextoLibre(e.target.value); setParseMsg('') } }}
          placeholder='"gasté 5000 en comida con débito" o dictar 🎤'
          style={{ flex: 1, fontStyle: listening ? 'italic' : 'normal', color: listening ? 'var(--text-muted)' : 'var(--text)' }}
          readOnly={listening}
        />
        <button type="submit" className="btn btn-primary" disabled={listening} style={{ whiteSpace: 'nowrap' }}>Parsear</button>
      </form>
      {parseMsg && <p style={{ color: 'var(--warning)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{parseMsg}</p>}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Mes</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ width: 'auto', minWidth: '120px' }}>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Año</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ width: 'auto' }}>
              {anios.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Categoría</label>
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 'auto', minWidth: '140px' }}>
              <option value=''>Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} · {MESES[mes]} {anio}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--primary-light)' }}>
            Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          {gastos.length > 0 && (
            <button onClick={exportCSV} className="btn" style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
              ⬇️ CSV
            </button>
          )}
        </div>
      </div>

      {/* Expense list */}
      {gastos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No hay gastos para este período</p>
          <button onClick={openAdd} className="btn btn-primary">+ Agregar gasto</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {gastos.map(gasto => (
            <div key={gasto.id} className="gasto-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  background: (gasto.categorias?.color || '#7c3aed') + '25',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {gasto.categorias?.icono || '📦'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gasto.descripcion || gasto.categorias?.nombre || 'Sin descripción'}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {new Date(gasto.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{gasto.categorias?.nombre || 'Sin cat.'}
                    {' · '}{gasto.cuenta}
                    {gasto.divisa && gasto.divisa !== 'ARS' && (
                      <span className="badge-divisa">{gasto.divisa}</span>
                    )}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                <span style={{ fontWeight: '700', color: 'var(--danger)', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>
                  -${parseFloat(gasto.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <button onClick={() => openEdit(gasto)} className="btn icon-btn" title="Editar">✏️</button>
                <button onClick={() => handleDelete(gasto.id)} className="btn icon-btn danger" title="Eliminar">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal add/edit */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{editingGasto ? 'Editar gasto' : 'Nuevo gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Monto</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.monto}
                    onChange={e => setForm({ ...form, monto: e.target.value })}
                    placeholder="0" required autoFocus
                  />
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
                  <label className="form-label">Divisa</label>
                  <select value={form.divisa} onChange={e => setForm({ ...form, divisa: e.target.value })}>
                    {DIVISAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Cuenta</label>
                <select value={form.cuenta} onChange={e => setForm({ ...form, cuenta: e.target.value })}>
                  {CUENTAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <input
                  type="text" value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="¿En qué gastaste?" maxLength={100}
                />
              </div>

              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea
                  value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  placeholder="Notas adicionales..." rows={2} style={{ resize: 'vertical' }}
                />
              </div>

              {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{formError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingGasto ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
