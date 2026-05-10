import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import TripSubNav from '../components/TripSubNav.jsx';
import { useTrip } from '../hooks/useTrip.js';

const DEFAULT_CATEGORIES = ['clothing', 'toiletries', 'electronics', 'documents', 'medicine', 'snacks', 'general'];
const CATEGORY_ICONS = {
  clothing: '👕', toiletries: '🧴', electronics: '💻', documents: '📄',
  medicine: '💊', snacks: '🍫', general: '🎒',
};

export default function PackingPage() {
  const { id } = useParams();
  const tripId = Number(id);
  const { trip, loading: tripLoading } = useTrip(tripId);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [errors, setErrors] = useState({});
  const [adding, setAdding] = useState(false);

  async function loadPacking() {
    setListLoading(true);
    try {
      const data = await api(`/api/trips/${tripId}/packing`);
      setItems(data);
    } catch (err) {
      toast.error(err.message || 'Could not load packing list');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { if (tripId) loadPacking(); }, [tripId]);

  async function addItem(e) {
    e.preventDefault();
    if (!name.trim()) { setErrors({ name: 'Item name is required' }); return; }
    setErrors({});
    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/packing`, { method: 'POST', body: { name: name.trim(), category } });
      toast.success('Item added');
      setName('');
      loadPacking();
    } catch (err) {
      toast.error(err.message || 'Could not add item');
    } finally {
      setAdding(false);
    }
  }

  async function toggleItem(itemId) {
    try {
      const updated = await api(`/api/packing/${itemId}/toggle`, { method: 'PATCH' });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      toast.error(err.message || 'Could not update item');
    }
  }

  async function deleteItem(itemId) {
    try {
      await api(`/api/packing/${itemId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      toast.error(err.message || 'Could not delete item');
    }
  }

  const grouped = items.reduce((acc, item) => {
    const c = item.category || 'general';
    if (!acc[c]) acc[c] = [];
    acc[c].push(item);
    return acc;
  }, {});

  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((packed / total) * 100);

  if (tripLoading) return <div><TripSubNav /><Spinner className="py-20" /></div>;
  if (!trip) return <div><Link to="/dashboard" className="text-sm font-medium text-teal-600 hover:underline">← Dashboard</Link><p className="mt-6 text-slate-600">Trip not found.</p></div>;

  return (
    <div>
      <div className="mb-2">
        <Link to="/dashboard" className="text-sm font-medium text-teal-600 hover:underline">← Dashboard</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Packing · {trip.name}</h1>
      <p className="mt-1 text-slate-500">Organize and check off items before you go.</p>

      <TripSubNav />

      {total > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Progress</span>
            <span className="font-bold text-teal-600">{packed}/{total} packed ({pct}%)</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <p className="mt-2 text-center text-sm font-semibold text-teal-600">🎉 All packed — ready to go!</p>
          )}
        </div>
      )}

      <form
        onSubmit={addItem}
        className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Item name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors({}); }}
            placeholder="e.g. Passport, Charger…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          >
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_ICONS[c] || '•'} {c}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {adding ? 'Adding…' : '+ Add item'}
        </button>
      </form>

      {listLoading ? (
        <Spinner className="py-12" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No items yet. Add your first packing item above.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped).sort().map((cat) => (
            <div key={cat}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-teal-600">
                <span>{CATEGORY_ICONS[cat] || '•'}</span> {cat}
                <span className="ml-auto rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600 normal-case tracking-normal">
                  {grouped[cat].filter((i) => i.is_packed).length}/{grouped[cat].length}
                </span>
              </h2>
              <ul className="space-y-2">
                {grouped[cat].map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        item.is_packed
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-slate-300 bg-white hover:border-teal-400'
                      }`}
                      aria-label={item.is_packed ? 'Mark unpacked' : 'Mark packed'}
                    >
                      {item.is_packed ? '✓' : ''}
                    </button>
                    <span className={`flex-1 ${item.is_packed ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>
                      {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
