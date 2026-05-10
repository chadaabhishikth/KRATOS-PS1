import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';

export default function CreateTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    total_budget: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Trip name is required';
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      e.end_date = 'End date must be after start date';
    if (form.total_budget && isNaN(Number(form.total_budget)))
      e.total_budget = 'Budget must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const trip = await api('/api/trips', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          total_budget: form.total_budget ? Number(form.total_budget) : null,
        },
      });
      toast.success('Trip created!');
      navigate(`/trips/${trip.id}/itinerary`);
    } catch (err) {
      toast.error(err.message || 'Could not create trip');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/dashboard" className="mb-4 inline-block text-sm font-medium text-teal-600 hover:underline">
        ← Dashboard
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Plan a new trip</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in the basics — you can always edit later.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Trip name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Summer Euro Trip 2025"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="What's this trip about?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
                min={form.start_date}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
              {errors.end_date && <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Total budget ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_budget}
              onChange={(e) => set('total_budget', e.target.value)}
              placeholder="e.g. 3000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
            {errors.total_budget && <p className="mt-1 text-sm text-red-600">{errors.total_budget}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-bold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? <Spinner className="py-0" /> : 'Create trip & build itinerary →'}
          </button>
        </form>
      </div>
    </div>
  );
}
