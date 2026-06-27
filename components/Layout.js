import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Layout({ user, children }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/', icon: '📊', label: 'Dashboard' },
    { href: '/gastos', icon: '💸', label: 'Gastos' },
    { href: '/ingresos', icon: '💵', label: 'Ingresos' },
    { href: '/presupuestos', icon: '🎯', label: 'Presupuestos' },
    { href: '/recurrentes', icon: '🔄', label: 'Recurrentes' },
    { href: '/metas', icon: '⭐', label: 'Metas' },
    { href: '/suscripciones', icon: '💳', label: 'Suscripciones' },
    { href: '/vencimientos', icon: '📅', label: 'Vencimientos' },
    { href: '/finscore', icon: '📈', label: 'FinScore' },
    { href: '/deudas', icon: '🤝', label: 'Deudas' },
    { href: '/tarjetas', icon: '🏦', label: 'Tarjetas' },
    { href: '/logros', icon: '🏆', label: 'Logros' },
    { href: '/perfil', icon: '👤', label: 'Perfil' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '0.5rem',
      }}>
        <div style={{ fontWeight: '700', color: 'var(--primary-light)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span className="brand-full" style={{ fontSize: '0.95rem' }}>💰 Mis Gastos</span>
          <span className="brand-short" style={{ fontSize: '1.2rem' }}>💰</span>
        </div>

        <div className="nav-scroll" style={{ display: 'flex', gap: '0.2rem', flex: 1, padding: '0 0.25rem' }}>
          {navItems.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="btn nav-btn"
              style={{
                background: router.pathname === item.href ? 'var(--primary)' : 'transparent',
                color: router.pathname === item.href ? 'white' : 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="btn"
          style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.35rem 0.65rem', flexShrink: 0 }}
        >
          Salir
        </button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {children}
      </main>
    </div>
  )
}
