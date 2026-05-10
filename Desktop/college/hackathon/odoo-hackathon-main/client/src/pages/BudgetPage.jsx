import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import TripSubNav from '../components/TripSubNav.jsx';
import { useTrip } from '../hooks/useTrip.js';

const COLORS = ['#0D9488', '#F59E0B', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#64748b'];

export default function BudgetPage() {
  const { id } = useParams();
  const tripId = Number(id);
  const { trip, loading: tripLoading } = useTrip(tripId);
  const [categories, setCategories] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tripId) return;
      setBudgetLoading(true);
      try {
        const data = await api(`/api/trips/${tripId}/budget`);
        if (!cancelled) setCategories(data.categories || []);
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load budget');
      } finally {
        if (!cancelled) setBudgetLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const chartData = useMemo(() => {
    return (categories || []).map((c) => ({
      name: c.category,
      value: Number(c.total) || 0,
    }));
  }, [categories]);

  const totalEstimated = useMemo(
    () => chartData.reduce((s, d) => s + d.value, 0),
    [chartData],
  );

  if (tripLoading) {
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
      <h1 className="text-2xl font-bold text-slate-900">Budget · {trip.name}</h1>
      <p className="mt-1 text-slate-600">Estimated spend by activity category (from your itinerary).</p>

      <TripSubNav />

      {budgetLoading ? (
        <Spinner className="py-16" />
      ) : chartData.length === 0 || totalEstimated === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">No activity costs yet.</p>
          <p className="mt-2 text-sm text-slate-500">Add activities with estimated costs in the itinerary builder.</p>
          <Link
            to={`/trips/${tripId}/itinerary`}
            className="mt-4 inline-block font-semibold text-primary hover:underline"
          >
            Go to itinerary builder
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Breakdown</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {chartData.map((row, i) => (
                <li key={row.name} className="flex justify-between py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="capitalize text-slate-800">{row.name}</span>
                  </span>
                  <span className="font-medium text-slate-900">${row.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-base font-bold text-slate-900">
              <span>Total estimated</span>
              <span>${totalEstimated.toFixed(2)}</span>
            </div>
            {trip.total_budget != null && (
              <p className="mt-3 text-sm text-slate-500">
                Trip budget cap: <span className="font-medium">${Number(trip.total_budget).toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
