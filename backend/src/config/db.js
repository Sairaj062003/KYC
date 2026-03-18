const { Pool } = require('pg');

/**
 * PostgreSQL connection pool configuration.
 * All credentials sourced from environment variables.
 */
const pool = new Pool({
  host:     process.env.POSTGRES_HOST,
  port:     parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,                        // Maximum pool size
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail if connection takes > 2s
});

// Log unexpected pool-level errors and exit to allow restart
pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
  process.exit(-1);
});

module.exports = pool;
