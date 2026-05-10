import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Toggle packed status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const r = await pool.query(
      `SELECT p.id FROM packing_items p
       JOIN trips t ON t.id = p.trip_id
       WHERE p.id = $1 AND t.user_id = $2`,
      [itemId, req.userId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Item not found' });
    const result = await pool.query(
      `UPDATE packing_items SET is_packed = NOT is_packed WHERE id = $1
       RETURNING id, trip_id, name, category, is_packed`,
      [itemId],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

// DELETE a packing item (was missing — caused errors in the UI)
router.delete('/:id', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const r = await pool.query(
      `SELECT p.id FROM packing_items p
       JOIN trips t ON t.id = p.trip_id
       WHERE p.id = $1 AND t.user_id = $2`,
      [itemId, req.userId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Item not found' });
    await pool.query('DELETE FROM packing_items WHERE id = $1', [itemId]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
