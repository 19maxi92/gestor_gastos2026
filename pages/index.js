import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600' }}>💰 Gestor de Gastos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Bienvenido, {user?.email}
          </p>
        </div>
        <button onClick={handleLogout} className="btn" style={{ background: 'var(--border)', color: 'var(--text)' }}>
          Cerrar sesión
        </button>
      </div>

      {/* Cards resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Este mes</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary-light)' }}>$0</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>en gastos</p>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--success)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Categoría top</p>
          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--success)', marginTop: '0.3rem' }}>—</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>sin datos aún</p>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total gastos</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--warning)' }}>0</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>registros</p>
        </div>
      </div>

      {/* Mensaje bienvenida */}
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Todo listo para arrancar</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          El fin de semana cargamos gastos, gráficos y todo lo demás.
        </p>
      </div>

    </div>
  )
}
