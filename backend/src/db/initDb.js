const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

/**
 * Automatically initializes the database schema if the users table is missing.
 * Reads the schema from the existing migrations file.
 */
async function initDb() {
  try {
    // Check if the 'users' table already exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `;
    const { rows } = await pool.query(checkTableQuery);
    const tableExists = rows[0].exists;

    if (!tableExists) {
      console.log('[Database] Schema not found. Initializing...');

      // Read the SQL migration file
      const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Execute the SQL script
      await pool.query(sql);
      console.log('[Database] Schema initialized successfully.');
    } else {
      console.log('[Database] Schema already exists. Skipping initialization.');
    }
  } catch (err) {
    console.error('[Database] Initialization failed:', err.message);
    // We don't exit here to allow the app to try connecting later, 
    // but in a real production app we might want to shut down.
  }
}

module.exports = initDb;
