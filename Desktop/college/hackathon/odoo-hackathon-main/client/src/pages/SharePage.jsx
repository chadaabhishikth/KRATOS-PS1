import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';

function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await api(`/api/share/${token}`);
        if (!cancelled) setData(json);
      } catch (err) {
        toast.error(err.message || 'Could not load trip');
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-lg text-slate-600">This shared trip could not be found.</p>
        <Link to="/login" className="mt-4 font-semibold text-primary hover:underline">
          Sign in to Traveloop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold text-primary">Traveloop</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Shared view
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-900">{data.name}</h1>
        {data.description && <p className="mt-2 text-lg text-slate-600">{data.description}</p>}
        <p className="mt-2 text-sm text-slate-500">
          {data.start_date || '—'} — {data.end_date || '—'}
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">Itinerary</h2>
          <div className="relative mt-6">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-accent md:left-6" />
            <ul className="space-y-8">
              {(data.stops || []).map((stop, idx) => (
                <li key={stop.id} className="relative pl-12 md:pl-16">
                  <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white md:left-2 md:h-10 md:w-10">
                    {idx + 1}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {stop.city_name}
                      {stop.country ? ` · ${stop.country}` : ''}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {stop.arrival_date || '—'} — {stop.departure_date || '—'}
                    </p>
                    {stop.notes && <p className="mt-2 text-slate-600">{stop.notes}</p>}
                    <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                      {(stop.activities || []).map((a) => (
                        <li key={a.id} className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-800">{a.name}</span>
                          <span className="text-right text-slate-600">
                            {formatTime(a.scheduled_time) && (
                              <span className="mr-2 font-semibold">{formatTime(a.scheduled_time)}</span>
                            )}
                            ${Number(a.estimated_cost || 0).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {(data.packing_items || []).length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-slate-900">Packing list</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.packing_items.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-xl border border-slate-200 px-4 py-2 text-sm ${
                    p.is_packed ? 'bg-slate-100 text-slate-400 line-through' : 'bg-white'
                  }`}
                >
                  <span className="capitalize text-xs text-slate-400">{p.category} · </span>
                  {p.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
