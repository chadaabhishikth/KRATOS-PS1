import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import tripsRoutes from './routes/trips.js';
import stopsRoutes from './routes/stops.js';
import activitiesRoutes from './routes/activities.js';
import packingRoutes from './routes/packing.js';
import shareRoutes from './routes/share.js';

// Startup checks
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short in .env — auth will not work.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// FIX: Allow all team members on any localhost port, plus any CLIENT_ORIGIN env var
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // Dev: allow any localhost port
      if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error('CORS: origin ' + origin + ' not allowed'));
    },
    credentials: true,
  }),
);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Traveloop API', version: '2.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/packing', packingRoutes);
app.use('/api/share', shareRoutes);

// Global error handler — returns full message in dev
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('Traveloop API -> http://localhost:' + PORT);
  console.log('Allowed origins: ' + allowedOrigins.join(', '));
});
