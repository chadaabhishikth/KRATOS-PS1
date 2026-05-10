import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

async function assertStopOwner(stopId, userId) {
  const r = await pool.query(
    `SELECT s.id FROM stops s
     JOIN trips t ON t.id = s.trip_id
     WHERE s.id = $1 AND t.user_id = $2`,
    [stopId, userId],
  );
  return r.rows[0];
}

router.post('/:id/activities', async (req, res) => {
  try {
    const stopId = Number(req.params.id);
    if (!(await assertStopOwner(stopId, req.userId))) {
      return res.status(404).json({ error: 'Stop not found' });
    }
    const { name, category, estimated_cost, duration_minutes, description, scheduled_time } =
      req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Activity name is required' });
    }
    const result = await pool.query(
      `INSERT INTO activities (stop_id, name, category, estimated_cost, duration_minutes, description, scheduled_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, stop_id, name, category, estimated_cost, duration_minutes, description, scheduled_time`,
      [
        stopId,
        name.trim(),
        category?.trim() || 'other',
        estimated_cost != null ? Number(estimated_cost) : 0,
        duration_minutes != null ? Number(duration_minutes) : null,
        description ?? null,
        scheduled_time || null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const stopId = Number(req.params.id);
    if (!(await assertStopOwner(stopId, req.userId))) {
      return res.status(404).json({ error: 'Stop not found' });
    }
    const cur = await pool.query(
      `SELECT city_name, country, arrival_date, departure_date, position, notes FROM stops WHERE id = $1`,
      [stopId],
    );
    const row = cur.rows[0];
    const { city_name, country, arrival_date, departure_date, position, notes } = req.body || {};
    const result = await pool.query(
      `UPDATE stops SET
        city_name = $1,
        country = $2,
        arrival_date = $3,
        departure_date = $4,
        position = $5,
        notes = $6
       WHERE id = $7
       RETURNING id, trip_id, city_name, country, arrival_date, departure_date, position, notes`,
      [
        city_name !== undefined ? city_name : row.city_name,
        country !== undefined ? country : row.country,
        arrival_date !== undefined ? arrival_date : row.arrival_date,
        departure_date !== undefined ? departure_date : row.departure_date,
        position !== undefined ? position : row.position,
        notes !== undefined ? notes : row.notes,
        stopId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update stop' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const stopId = Number(req.params.id);
    if (!(await assertStopOwner(stopId, req.userId))) {
      return res.status(404).json({ error: 'Stop not found' });
    }
    await pool.query('DELETE FROM stops WHERE id = $1', [stopId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stop' });
  }
});

export default router;
