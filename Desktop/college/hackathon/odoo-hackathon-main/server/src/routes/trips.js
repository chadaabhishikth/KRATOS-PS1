import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

async function assertTripOwner(tripId, userId) {
  const r = await pool.query('SELECT id FROM trips WHERE id = $1 AND user_id = $2', [
    tripId,
    userId,
  ]);
  return r.rows[0];
}

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, start_date, end_date, is_public, share_token,
              total_budget, created_at
       FROM trips WHERE user_id = $1 ORDER BY start_date DESC NULLS LAST, created_at DESC`,
      [req.userId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load trips' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, start_date, end_date, total_budget } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Trip name is required' });
    }
    const result = await pool.query(
      `INSERT INTO trips (user_id, name, description, start_date, end_date, total_budget)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, name, description, start_date, end_date, is_public,
                 share_token, total_budget, created_at`,
      [
        req.userId,
        name.trim(),
        description ?? null,
        start_date || null,
        end_date || null,
        total_budget != null ? Number(total_budget) : null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.get('/:tripId/budget', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const result = await pool.query(
      `SELECT COALESCE(a.category, 'other') AS category,
              COALESCE(SUM(a.estimated_cost), 0)::float AS total
       FROM activities a
       JOIN stops s ON s.id = a.stop_id
       WHERE s.trip_id = $1
       GROUP BY COALESCE(a.category, 'other')
       ORDER BY category`,
      [tripId],
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

router.get('/:tripId/packing', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const result = await pool.query(
      `SELECT id, trip_id, name, category, is_packed
       FROM packing_items WHERE trip_id = $1 ORDER BY category, id`,
      [tripId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load packing list' });
  }
});

router.post('/:tripId/packing', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { name, category } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    const result = await pool.query(
      `INSERT INTO packing_items (trip_id, name, category)
       VALUES ($1, $2, $3)
       RETURNING id, trip_id, name, category, is_packed`,
      [tripId, name.trim(), category?.trim() || 'general'],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

router.post('/:tripId/stops', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { city_name, country, arrival_date, departure_date, position, notes } = req.body || {};
    if (!city_name?.trim()) {
      return res.status(400).json({ error: 'City name is required' });
    }
    let pos = position;
    if (pos == null) {
      const max = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS n FROM stops WHERE trip_id = $1',
        [tripId],
      );
      pos = max.rows[0].n;
    }
    const result = await pool.query(
      `INSERT INTO stops (trip_id, city_name, country, arrival_date, departure_date, position, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, trip_id, city_name, country, arrival_date, departure_date, position, notes`,
      [
        tripId,
        city_name.trim(),
        country?.trim() || null,
        arrival_date || null,
        departure_date || null,
        pos,
        notes ?? null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create stop' });
  }
});

router.post('/:tripId/share', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const result = await pool.query(
      `UPDATE trips SET is_public = TRUE, share_token = $1 WHERE id = $2 AND user_id = $3
       RETURNING id, is_public, share_token`,
      [token, tripId, req.userId],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enable sharing' });
  }
});

router.get('/:tripId', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    const tripResult = await pool.query(
      `SELECT id, user_id, name, description, start_date, end_date, is_public,
              share_token, total_budget, created_at
       FROM trips WHERE id = $1 AND user_id = $2`,
      [tripId, req.userId],
    );
    const trip = tripResult.rows[0];
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

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
    const stopsWithActivities = stops.map((s) => ({
      ...s,
      activities: activitiesByStop[s.id] || [],
    }));

    res.json({ ...trip, stops: stopsWithActivities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load trip' });
  }
});

router.put('/:tripId', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const existing = await pool.query(
      'SELECT name, description, start_date, end_date, total_budget FROM trips WHERE id = $1',
      [tripId],
    );
    const cur = existing.rows[0];
    const { name, description, start_date, end_date, total_budget } = req.body || {};
    const result = await pool.query(
      `UPDATE trips SET
        name = $1,
        description = $2,
        start_date = $3,
        end_date = $4,
        total_budget = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, user_id, name, description, start_date, end_date, is_public,
                 share_token, total_budget, created_at`,
      [
        name !== undefined ? name : cur.name,
        description !== undefined ? description : cur.description,
        start_date !== undefined ? start_date : cur.start_date,
        end_date !== undefined ? end_date : cur.end_date,
        total_budget !== undefined ? total_budget : cur.total_budget,
        tripId,
        req.userId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

router.delete('/:tripId', async (req, res) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!(await assertTripOwner(tripId, req.userId))) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [tripId, req.userId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

export default router;
