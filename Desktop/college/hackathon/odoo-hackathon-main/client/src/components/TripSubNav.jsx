import { NavLink, useParams } from 'react-router-dom';

const tabs = [
  { to: 'itinerary', label: 'Itinerary builder' },
  { to: 'view', label: 'Itinerary view' },
  { to: 'budget', label: 'Budget' },
  { to: 'packing', label: 'Packing' },
];

export default function TripSubNav() {
  const { id } = useParams();

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={`/trips/${id}/${tab.to}`}
          className={({ isActive }) =>
            `rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-primary text-white shadow'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
