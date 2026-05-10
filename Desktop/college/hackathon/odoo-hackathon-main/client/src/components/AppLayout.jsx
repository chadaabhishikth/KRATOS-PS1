import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-teal-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white text-sm font-black">
              T
            </span>
            Traveloop
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              My Trips
            </NavLink>
            <Link
              to="/trips/new"
              className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              + New Trip
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-sm text-slate-400">
        Traveloop — Built for Odoo Hackathon 🌍
      </footer>
    </div>
  );
}
