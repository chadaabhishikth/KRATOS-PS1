import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api.js';

export function useTrip(tripId) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const data = await api(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      toast.error(err.message || 'Could not load trip');
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trip, loading, refresh, setTrip };
}
