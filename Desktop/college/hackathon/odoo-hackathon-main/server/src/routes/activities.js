import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

async function assertActivityOwner(activityId, userId) {
  const r = await pool.query(
    `SELECT a.id FROM activities a
     JOIN stops s ON s.id = a.stop_id
     JOIN trips t ON t.id = s.trip_id
     WHERE a.id = $1 AND t.user_id = $2`,
    [activityId, userId],
  );
  return r.rows[0];
}

router.use(authenticate);

router.put('/:id', async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    if (!(await assertActivityOwner(activityId, req.userId))) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    const cur = await pool.query(
      `SELECT name, category, estimated_cost, duration_minutes, description, scheduled_time
       FROM activities WHERE id = $1`,
      [activityId],
    );
    const row = cur.rows[0];
    const { name, category, estimated_cost, duration_minutes, description, scheduled_time } =
      req.body || {};
    const result = await pool.query(
      `UPDATE activities SET
        name = $1,
        category = $2,
        estimated_cost = $3,
        duration_minutes = $4,
        description = $5,
        scheduled_time = $6
       WHERE id = $7
       RETURNING id, stop_id, name, category, estimated_cost, duration_minutes, description, scheduled_time`,
      [
        name !== undefined ? name : row.name,
        category !== undefined ? category : row.category,
        estimated_cost !== undefined ? Number(estimated_cost) : row.estimated_cost,
        duration_minutes !== undefined ? duration_minutes : row.duration_minutes,
        description !== undefined ? description : row.description,
        scheduled_time !== undefined ? scheduled_time : row.scheduled_time,
        activityId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    if (!(await assertActivityOwner(activityId, req.userId))) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    await pool.query('DELETE FROM activities WHERE id = $1', [activityId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
