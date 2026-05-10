import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import TripSubNav from '../components/TripSubNav.jsx';
import { useTrip } from '../hooks/useTrip.js';

const ACTIVITY_CATEGORIES = ['food', 'transport', 'lodging', 'entertainment', 'shopping', 'other'];

export default function ItineraryBuilder() {
  const { id } = useParams();
  const tripId = Number(id);
  const { trip, loading, refresh } = useTrip(tripId);

  const [stopForm, setStopForm] = useState({
    city_name: '',
    country: '',
    arrival_date: '',
    departure_date: '',
    notes: '',
  });
  const [stopErrors, setStopErrors] = useState({});
  const [addingStop, setAddingStop] = useState(false);

  const [activityForms, setActivityForms] = useState({});
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  function setActivityForm(stopId, patch) {
    setActivityForms((prev) => ({
      ...prev,
      [stopId]: { ...defaultActivityForm(), ...prev[stopId], ...patch },
    }));
  }

  function defaultActivityForm() {
    return {
      name: '',
      category: 'other',
      estimated_cost: '',
      duration_minutes: '',
      description: '',
      scheduled_time: '',
    };
  }

  function validateStop() {
    const e = {};
    if (!stopForm.city_name.trim()) e.city_name = 'City is required';
    setStopErrors(e);
    return Object.keys(e).length === 0;
  }

  async function addStop(e) {
    e.preventDefault();
    if (!validateStop()) return;
    setAddingStop(true);
    try {
      await api(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        body: {
          city_name: stopForm.city_name.trim(),
          country: stopForm.country.trim() || null,
          arrival_date: stopForm.arrival_date || null,
          departure_date: stopForm.departure_date || null,
          notes: stopForm.notes || null,
        },
      });
      toast.success('Stop added');
      setStopForm({ city_name: '', country: '', arrival_date: '', departure_date: '', notes: '' });
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not add stop');
    } finally {
      setAddingStop(false);
    }
  }

  async function removeStop(stopId) {
    if (!confirm('Remove this stop and its activities?')) return;
    try {
      await api(`/api/stops/${stopId}`, { method: 'DELETE' });
      toast.success('Stop removed');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not remove stop');
    }
  }

  async function addActivity(stopId) {
    const form = { ...defaultActivityForm(), ...activityForms[stopId] };
    if (!form.name?.trim()) {
      toast.error('Activity name is required');
      return;
    }
    try {
      await api(`/api/stops/${stopId}/activities`, {
        method: 'POST',
        body: {
          name: form.name.trim(),
          category: form.category,
          estimated_cost: form.estimated_cost === '' ? 0 : Number(form.estimated_cost),
          duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
          description: form.description || null,
          scheduled_time: form.scheduled_time || null,
        },
      });
      toast.success('Activity added');
      setActivityForm(stopId, defaultActivityForm());
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not add activity');
    }
  }

  async function removeActivity(activityId) {
    try {
      await api(`/api/activities/${activityId}`, { method: 'DELETE' });
      toast.success('Activity removed');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not remove activity');
    }
  }

  async function enableShare() {
    setSharing(true);
    try {
      const data = await api(`/api/trips/${tripId}/share`, { method: 'POST' });
      const url = `${window.location.origin}/share/${data.share_token}`;
      setShareUrl(url);
      toast.success('Sharing enabled');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not enable sharing');
    } finally {
      setSharing(false);
    }
  }

  function copyShareLink() {
    const token = trip?.share_token;
    if (!token) return;
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  }

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
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{trip.name}</h1>
          <p className="mt-1 text-slate-600">{trip.description || 'No description'}</p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            onClick={enableShare}
            disabled={sharing}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {sharing ? 'Working…' : trip.share_token ? 'Refresh share link' : 'Create public link'}
          </button>
          {trip.share_token && (
            <button
              type="button"
              onClick={copyShareLink}
              className="text-sm font-medium text-primary hover:underline"
            >
              Copy public URL
            </button>
          )}
          {shareUrl && <p className="max-w-xs break-all text-xs text-slate-500">{shareUrl}</p>}
        </div>
      </div>

      <TripSubNav />

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add a stop</h2>
        <form onSubmit={addStop} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">City *</label>
            <input
              value={stopForm.city_name}
              onChange={(e) => setStopForm({ ...stopForm, city_name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
            />
            {stopErrors.city_name && <p className="mt-1 text-sm text-red-600">{stopErrors.city_name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
            <input
              value={stopForm.country}
              onChange={(e) => setStopForm({ ...stopForm, country: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <input
              value={stopForm.notes}
              onChange={(e) => setStopForm({ ...stopForm, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Arrival</label>
            <input
              type="date"
              value={stopForm.arrival_date}
              onChange={(e) => setStopForm({ ...stopForm, arrival_date: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Departure</label>
            <input
              type="date"
              value={stopForm.departure_date}
              onChange={(e) => setStopForm({ ...stopForm, departure_date: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={addingStop}
              className="rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {addingStop ? 'Adding…' : 'Add stop'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        {trip.stops?.length === 0 && (
          <p className="text-center text-slate-500">No stops yet. Add your first city above.</p>
        )}
        {trip.stops?.map((stop) => (
          <div
            key={stop.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {stop.city_name}
                  {stop.country ? `, ${stop.country}` : ''}
                </h3>
                <p className="text-sm text-slate-500">
                  {stop.arrival_date || '—'} → {stop.departure_date || '—'}
                </p>
                {stop.notes && <p className="mt-2 text-slate-600">{stop.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeStop(stop.id)}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Remove stop
              </button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h4 className="font-medium text-slate-800">Activities</h4>
              <ul className="mt-3 space-y-2">
                {(stop.activities || []).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">{a.name}</span>
                    <span className="text-slate-500">
                      {a.category} · ${Number(a.estimated_cost || 0).toFixed(2)}
                      {a.duration_minutes != null ? ` · ${a.duration_minutes} min` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeActivity(a.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid gap-3 rounded-xl bg-teal-50/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Activity name</label>
                  <input
                    value={activityForms[stop.id]?.name ?? ''}
                    onChange={(e) => setActivityForm(stop.id, { name: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                  <select
                    value={activityForms[stop.id]?.category ?? 'other'}
                    onChange={(e) => setActivityForm(stop.id, { category: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={activityForms[stop.id]?.estimated_cost ?? ''}
                    onChange={(e) => setActivityForm(stop.id, { estimated_cost: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Duration (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={activityForms[stop.id]?.duration_minutes ?? ''}
                    onChange={(e) => setActivityForm(stop.id, { duration_minutes: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Time</label>
                  <input
                    type="time"
                    value={activityForms[stop.id]?.scheduled_time ?? ''}
                    onChange={(e) => setActivityForm(stop.id, { scheduled_time: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <input
                    value={activityForms[stop.id]?.description ?? ''}
                    onChange={(e) => setActivityForm(stop.id, { description: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => addActivity(stop.id)}
                    className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
                  >
                    Add activity
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
