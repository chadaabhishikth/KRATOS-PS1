import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const tripResult = await pool.query(
      `SELECT id, name, description, start_date, end_date, total_budget, created_at
       FROM trips WHERE is_public = TRUE AND share_token = $1`,
      [token],
    );
    const trip = tripResult.rows[0];
    if (!trip) {
      return res.status(404).json({ error: 'Shared trip not found' });
    }
    const tripId = trip.id;
    const stopsResult = await pool.query(
      `SELECT id, trip_id, city_name, country, arrival_date, departure_date, position, notes
       FROM stops WHERE trip_id = $1 ORDER BY position ASC, id ASC`,
      [tripId],
    );
    const stops = stopsResult.rows;
    const stopIds = stops.map((s) => s.id);
    const activitiesByStop = {};
    if (stopIds.length) {
      const actResult = await pool.query(
        `SELECT id, stop_id, name, category, estimated_cost, duration_minutes,
                description, scheduled_time
         FROM activities WHERE stop_id = ANY($1::int[])
         ORDER BY scheduled_time NULLS LAST, id ASC`,
        [stopIds],
      );
      for (const row of actResult.rows) {
        if (!activitiesByStop[row.stop_id]) activitiesByStop[row.stop_id] = [];
        activitiesByStop[row.stop_id].push(row);
      }
    }
    const packingResult = await pool.query(
      `SELECT id, trip_id, name, category, is_packed FROM packing_items WHERE trip_id = $1 ORDER BY category, id`,
      [tripId],
    );
    const stopsWithActivities = stops.map((s) => ({
      ...s,
      activities: activitiesByStop[s.id] || [],
    }));
    res.json({
      ...trip,
      stops: stopsWithActivities,
      packing_items: packingResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load shared trip' });
  }
});

export default router;
