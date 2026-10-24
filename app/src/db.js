'use strict';
const { Pool } = require('pg');
const fs = require('node:fs');
function secret(key) { return fs.readFileSync(process.env[key], 'utf8').trim(); }
const pool = new Pool({ host: process.env.DB_HOST || 'postgres', port: 5432,
  database: process.env.DB_NAME || 'fleet', user: process.env.DB_USER || 'fleet_app',
  password: secret('DB_PASSWORD_FILE'), max: 10, connectionTimeoutMillis: 5000,
  statement_timeout: 10000, idle_in_transaction_session_timeout: 15000 });
pool.on('error',err=>require('./logger')('db_pool_error',{level:'error',code:err.code||'connection'}));
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
  catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
}
module.exports = { pool, tx, secret };
