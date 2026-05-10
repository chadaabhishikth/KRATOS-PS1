import { Link, useParams } from 'react-router-dom';
import Spinner from '../components/Spinner.jsx';
import TripSubNav from '../components/TripSubNav.jsx';
import { useTrip } from '../hooks/useTrip.js';

function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ItineraryView() {
  const { id } = useParams();
  const tripId = Number(id);
  const { trip, loading } = useTrip(tripId);

  if (loading) {
    return (
      <div>
        <TripSubNav />
        <Spinner className="py-20" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div>
        <Link to="/dashboard" className="text-sm font-medium text-primary hover:underline">
          ← Dashboard
        </Link>
        <p className="mt-6 text-slate-600">We could not find that trip.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/dashboard" className="text-sm font-medium text-primary hover:underline">
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{trip.name}</h1>
      <p className="mt-1 text-slate-600">{trip.description || 'Your itinerary timeline'}</p>

      <TripSubNav />

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-accent md:left-6" />
        <ul className="space-y-10">
          {(trip.stops || []).map((stop, idx) => (
            <li key={stop.id} className="relative pl-12 md:pl-16">
              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white md:left-2 md:h-10 md:w-10">
                {idx + 1}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">
                  {stop.city_name}
                  {stop.country ? ` · ${stop.country}` : ''}
                </h2>
                <p className="text-sm text-slate-500">
                  {stop.arrival_date || '—'} — {stop.departure_date || '—'}
                </p>
                {stop.notes && <p className="mt-2 text-slate-600">{stop.notes}</p>}

                <ol className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  {(stop.activities || []).length === 0 && (
                    <li className="text-sm text-slate-400">No activities for this stop.</li>
                  )}
                  {(stop.activities || []).map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{a.name}</p>
                        {a.description && <p className="text-sm text-slate-600">{a.description}</p>}
                        <p className="mt-1 text-xs uppercase tracking-wide text-primary">{a.category}</p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        {formatTime(a.scheduled_time) && (
                          <p className="font-semibold text-slate-800">{formatTime(a.scheduled_time)}</p>
                        )}
                        <p>${Number(a.estimated_cost || 0).toFixed(2)}</p>
                        {a.duration_minutes != null && <p>{a.duration_minutes} min</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </li>
          ))}
        </ul>
        {trip.stops?.length === 0 && (
          <p className="pl-12 text-slate-500 md:pl-16">Add stops in the itinerary builder.</p>
        )}
      </div>
    </div>
  );
}
