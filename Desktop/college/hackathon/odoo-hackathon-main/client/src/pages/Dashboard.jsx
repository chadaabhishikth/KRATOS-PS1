import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function TripCard({ trip, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api(`/api/trips/${trip.id}`, { method: 'DELETE' });
      toast.success('Trip deleted');
      onDelete(trip.id);
    } catch (err) {
      toast.error(err.message || 'Could not delete trip');
      setDeleting(false);
    }
  }

  const start = formatDate(trip.start_date);
  const end = formatDate(trip.end_date);
  const duration =
    trip.start_date && trip.end_date
      ? Math.max(1, Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000))
      : null;

  return (
    <li className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-teal-300 hover:shadow-md">
      <Link to={`/trips/${trip.id}/itinerary`} className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900 group-hover:text-teal-700">{trip.name}</h2>
          {trip.is_public && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Public
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{trip.description || 'No description'}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {start && (
            <span className="flex items-center gap-1">
              📅 {start} {end ? `— ${end}` : ''}
            </span>
          )}
          {duration && <span className="flex items-center gap-1">⏱ {duration}d</span>}
          {trip.total_budget && (
            <span className="flex items-center gap-1">💰 ${Number(trip.total_budget).toLocaleString()}</span>
          )}
        </div>
      </Link>
      <div className="flex border-t border-slate-100">
        <Link
          to={`/trips/${trip.id}/itinerary`}
          className="flex-1 py-2.5 text-center text-xs font-semibold text-teal-600 hover:bg-teal-50"
        >
          Itinerary
        </Link>
        <Link
          to={`/trips/${trip.id}/budget`}
          className="flex-1 py-2.5 text-center text-xs font-semibold text-slate-500 hover:bg-slate-50"
        >
          Budget
        </Link>
        <Link
          to={`/trips/${trip.id}/packing`}
          className="flex-1 py-2.5 text-center text-xs font-semibold text-slate-500 hover:bg-slate-50"
        >
          Packing
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/api/trips');
        if (!cancelled) setTrips(data);
      } catch (err) {
        toast.error(err.message || 'Could not load trips');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upcoming = trips.filter((t) => !t.end_date || new Date(t.end_date) >= new Date());
  const past = trips.filter((t) => t.end_date && new Date(t.end_date) < new Date());

  function removeTrip(id) {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} ✈️
          </h1>
          <p className="mt-1 text-slate-500">
            {trips.length === 0
              ? 'You have no trips yet — start planning!'
              : `${trips.length} trip${trips.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link
          to="/trips/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-900 shadow hover:bg-amber-300"
        >
          + Plan New Trip
        </Link>
      </div>

      {loading ? (
        <Spinner className="py-24" />
      ) : trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mb-4 text-5xl">🗺️</div>
          <p className="text-lg font-semibold text-slate-700">No trips yet</p>
          <p className="mt-2 text-slate-500">Create your first trip and start building your itinerary.</p>
          <Link
            to="/trips/new"
            className="mt-6 inline-block rounded-xl bg-teal-600 px-6 py-3 font-bold text-white hover:bg-teal-700"
          >
            Create a trip
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-teal-600">Upcoming</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onDelete={removeTrip} />
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Past trips</h2>
              <ul className="grid gap-4 sm:grid-cols-2 opacity-75">
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onDelete={removeTrip} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
