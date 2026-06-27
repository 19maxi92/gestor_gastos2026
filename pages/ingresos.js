import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Ingresos() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const [historial, setHistorial] = useState([])       // all ingresos records
  const [gastosPorMes, setGastosPorMes] = useState({}) // { 'YYYY-MM': total }

  const now = new Date()
  const mesActual = now.getMonth()
  const anioActual = now.getFullYear()

  // Inline edit state
  const [editingKey, setEditingKey] = useState(null)   // 'YYYY-MM'
  const [editMonto, setEditMonto] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      loadAll(session.user.id)
    })
  }, [])

  const loadAll = async (userId) => {
    // Load all ingresos
    const { data: ingresos } = await supabase
      .from('ingresos')
      .select('*')
      .eq('user_id', userId)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })

    // Load gastos from last 24 months to compute monthly spending
    const hace24 = new Date(now.getFullYear(), now.getMonth() - 23, 1).toISOString().split('T')[0]
    const { data: gastos } = await supabase
      .from('gastos')
      .select('fecha, monto')
      .eq('user_id', userId)
      .gte('fecha', hace24)

    // Group gastos by YYYY-MM
    const gpm = {}
    ;(gastos || []).forEach(g => {
      const key = g.fecha.slice(0, 7)
      gpm[key] = (gpm[key] || 0) + parseFloat(g.monto)
    })

    setHistorial(ingresos || [])
    setGastosPorMes(gpm)
    setLoading(false)
  }

  const getMesKey = (mes, anio) => `${anio}-${String(mes + 1).padStart(2, '0')}`

  const openEdit = (mes, anio, monto) => {
    setEditingKey(getMesKey(mes, anio))
    setEditMonto(monto !== undefined ? String(monto) : '')
  }

  const handleSave = async (mes, anio) => {
    const monto = parseFloat(editMonto)
    if (isNaN(monto) || monto <= 0) return
    setSaving(true)
    await supabase
      .from('ingresos')
      .upsert({ user_id: user.id, mes, anio, monto }, { onConflict: 'user_id,mes,anio' })
    setEditingKey(null)
    setSaving(false)
    loadAll(user.id)
  }

  const handleDelete = async (mes, anio) => {
    if (!confirm(`¿Eliminar el ingreso de ${MESES[mes]} ${anio}?`)) return
    await supabase.from('ingresos').delete().eq('user_id', user.id).eq('mes', mes).eq('anio', anio)
    loadAll(user.id)
  }

  // Copy previous month's ingreso into the current month
  const handleCopiarAnterior = async () => {
    const prevMes = mesActual === 0 ? 11 : mesActual - 1
    const prevAnio = mesActual === 0 ? anioActual - 1 : anioActual
    const prev = historial.find(h => h.mes === prevMes && h.anio === prevAnio)
    if (!prev) { alert('No hay ingreso cargado en el mes anterior.'); return }
    setSaving(true)
    await supabase
      .from('ingresos')
      .upsert({ user_id: user.id, mes: mesActual, anio: anioActual, monto: prev.monto }, { onConflict: 'user_id,mes,anio' })
    setSaving(false)
    loadAll(user.id)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const ingresoActual = historial.find(h => h.mes === mesActual && h.anio === anioActual)
  const ingresoAnterior = historial.find(h => {
    const prevMes = mesActual === 0 ? 11 : mesActual - 1
    const prevAnio = mesActual === 0 ? anioActual - 1 : anioActual
    return h.mes === prevMes && h.anio === prevAnio
  })
  const mesActualKey = getMesKey(mesActual, anioActual)
  const gastosMesActual = gastosPorMes[mesActualKey] || 0
  const balanceActual = ingresoActual ? parseFloat(ingresoActual.monto) - gastosMesActual : null

  // Build all months to show: current month + any month that has ingreso data
  const keysConIngreso = new Set(historial.map(h => getMesKey(h.mes, h.anio)))
  keysConIngreso.add(mesActualKey)
  const sortedKeys = Array.from(keysConIngreso).sort((a, b) => b.localeCompare(a))

  // Total acumulado este año
  const totalAnio = historial
    .filter(h => h.anio === anioActual)
    .reduce((s, h) => s + parseFloat(h.monto), 0)

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700' }}>💵 Ingresos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sueldo y entradas por mes</p>
        </div>
        {totalAnio > 0 && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total {anioActual}</p>
            <p style={{ fontWeight: '700', color: 'var(--success)' }}>
              ${totalAnio.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        )}
      </div>

      {/* Mes actual — hero card */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--success)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              {MESES[mesActual]} {anioActual} — mes actual
            </p>
            {editingKey === mesActualKey ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={editMonto}
                  onChange={e => setEditMonto(e.target.value)}
                  autoFocus
                  placeholder="Monto"
                  style={{ width: '160px' }}
                />
                <button onClick={() => handleSave(mesActual, anioActual)} disabled={saving} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}>
                  {saving ? '...' : 'Guardar'}
                </button>
                <button onClick={() => setEditingKey(null)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)', padding: '0.4rem 0.6rem' }}>✕</button>
              </div>
            ) : (
              <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)', margin: '0.2rem 0' }}>
                {ingresoActual
                  ? `$${parseFloat(ingresoActual.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '—'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!ingresoActual && ingresoAnterior && editingKey !== mesActualKey && (
              <button
                onClick={handleCopiarAnterior}
                disabled={saving}
                className="btn"
                style={{ background: '#22c55e20', color: 'var(--success)', border: '1px solid #22c55e40', fontSize: '0.82rem' }}
              >
                📋 Copiar mes anterior (${parseFloat(ingresoAnterior.monto).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
              </button>
            )}
            {editingKey !== mesActualKey && (
              <button
                onClick={() => openEdit(mesActual, anioActual, ingresoActual?.monto)}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem' }}
              >
                {ingresoActual ? '✏️ Editar' : '+ Cargar sueldo'}
              </button>
            )}
          </div>
        </div>

        {ingresoActual && balanceActual !== null && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gastos del mes</p>
              <p style={{ fontWeight: '600', color: 'var(--primary-light)' }}>
                ${gastosMesActual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Balance</p>
              <p style={{ fontWeight: '600', color: balanceActual >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {balanceActual >= 0 ? '+' : ''}${balanceActual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tasa de ahorro</p>
              <p style={{ fontWeight: '600', color: balanceActual >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {Math.round((balanceActual / parseFloat(ingresoActual.monto)) * 100)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      {sortedKeys.filter(k => k !== mesActualKey).length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Historial</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedKeys
              .filter(k => k !== mesActualKey)
              .map(key => {
                const [anioStr, mesStr] = key.split('-')
                const anio = parseInt(anioStr)
                const mes = parseInt(mesStr) - 1
                const registro = historial.find(h => h.mes === mes && h.anio === anio)
                const monto = registro ? parseFloat(registro.monto) : null
                const gastosMes = gastosPorMes[key] || 0
                const balance = monto !== null ? monto - gastosMes : null
                const editing = editingKey === key

                return (
                  <div key={key} className="card" style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', align: 'center', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.88rem', fontWeight: '600', minWidth: '110px' }}>
                          {MESES[mes]} {anio}
                        </p>
                        {editing ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={editMonto}
                              onChange={e => setEditMonto(e.target.value)}
                              autoFocus
                              style={{ width: '130px', fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
                            />
                            <button onClick={() => handleSave(mes, anio)} disabled={saving} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                              {saving ? '...' : 'OK'}
                            </button>
                            <button onClick={() => setEditingKey(null)} className="btn" style={{ background: 'var(--border)', color: 'var(--text)', padding: '0.3rem 0.45rem', fontSize: '0.8rem' }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <p style={{ fontWeight: '700', color: monto !== null ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.92rem' }}>
                              {monto !== null ? `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '— sin cargar'}
                            </p>
                            {gastosMes > 0 && (
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                gastos: ${gastosMes.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                {balance !== null && (
                                  <span style={{ marginLeft: '0.5rem', color: balance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                                    ({balance >= 0 ? '+' : ''}${balance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                                  </span>
                                )}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {!editing && (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => openEdit(mes, anio, monto)} className="btn icon-btn" title="Editar" style={{ fontSize: '0.85rem' }}>✏️</button>
                          {registro && (
                            <button onClick={() => handleDelete(mes, anio)} className="btn icon-btn danger" title="Eliminar">🗑️</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {historial.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💵</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Todavía no cargaste ningún ingreso</p>
          <button onClick={() => openEdit(mesActual, anioActual)} className="btn btn-primary">+ Cargar mi sueldo</button>
        </div>
      )}
    </Layout>
  )
}
