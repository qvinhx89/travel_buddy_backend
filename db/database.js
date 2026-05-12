const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'trips.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS trips (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id         TEXT    UNIQUE NOT NULL,
    title           TEXT    NOT NULL,
    distance_km     REAL    NOT NULL,
    start_time      TEXT    NOT NULL,
    end_time        TEXT    NOT NULL,
    route_file_path TEXT    NOT NULL,
    synced_at       TEXT    DEFAULT (datetime('now'))
  )
`);

module.exports = db;
