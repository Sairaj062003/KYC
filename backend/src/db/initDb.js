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
      // Run subsequent migrations
      // (This will normally throw if not handled, let's just make it run safely)
      console.log('[Database] Full Schema initialized successfully.');
    } else {
      console.log('[Database] Schema already exists. Running new migrations...');
    }

    // Always try to run 003_similarity_category to alter the table
    const sqlPath3 = path.join(__dirname, 'migrations', '003_similarity_category.sql');
    if (fs.existsSync(sqlPath3)) {
      const sql3 = fs.readFileSync(sqlPath3, 'utf8');
      await pool.query(sql3);
      console.log('[Database] Migration 003_similarity_category applied.');
    }

    // Always try to run 004_revoke_admin
    const sqlPath4 = path.join(__dirname, 'migrations', '004_revoke_admin.sql');
    if (fs.existsSync(sqlPath4)) {
      const sql4 = fs.readFileSync(sqlPath4, 'utf8');
      await pool.query(sql4);
      console.log('[Database] Migration 004_revoke_admin applied.');
    }

    // Always try to run 005_indexes
    const sqlPath5 = path.join(__dirname, 'migrations', '005_indexes.sql');
    if (fs.existsSync(sqlPath5)) {
      const sql5 = fs.readFileSync(sqlPath5, 'utf8');
      await pool.query(sql5);
      console.log('[Database] Migration 005_indexes applied.');
    }

    // Always try to run 006_new_submissions (dual-database architecture)
    const sqlPath6 = path.join(__dirname, 'migrations', '006_new_submissions.sql');
    if (fs.existsSync(sqlPath6)) {
      const sql6 = fs.readFileSync(sqlPath6, 'utf8');
      await pool.query(sql6);
      console.log('[Database] Migration 006_new_submissions applied.');
    }

    // Always try to run 007_add_similarity_score
    const sqlPath7 = path.join(__dirname, 'migrations', '007_add_similarity_score.sql');
    if (fs.existsSync(sqlPath7)) {
      const sql7 = fs.readFileSync(sqlPath7, 'utf8');
      await pool.query(sql7);
      console.log('[Database] Migration 007_add_similarity_score applied.');
    }
  } catch (err) {
    console.error('[Database] Initialization failed:', err.message);
    // We don't exit here to allow the app to try connecting later, 
    // but in a real production app we might want to shut down.
  }
}

module.exports = initDb;
