import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set in .env — copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Allow SSL for cloud DBs (Neon, Supabase, Railway) — no SSL for localhost
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

// Verify DB connection on startup so errors are visible immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Could not connect to PostgreSQL:', err.message);
    console.error('    Check that DATABASE_URL in server/.env is correct and the DB is running.');
  } else {
    console.log('✅  PostgreSQL connected');
    release();
  }
});
