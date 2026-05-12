const fs = require('fs');
const path = require('path');

const JSONL_PATH = path.join(__dirname, 'test-route.jsonl');
const API_URL = 'http://localhost:3000/api/trips/sync';
const DB_PATH = path.join(__dirname, 'trips.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

(async () => {
  // 1. Generate dummy .jsonl with 3 GPS coordinates
  const coords = [
    { lat: 21.0285, lng: 105.8542, altitude: 10, timestamp: '2026-05-11T08:00:00.000Z' },
    { lat: 21.0290, lng: 105.8550, altitude: 12, timestamp: '2026-05-11T08:05:00.000Z' },
    { lat: 21.0295, lng: 105.8558, altitude: 14, timestamp: '2026-05-11T08:10:00.000Z' },
  ];
  fs.writeFileSync(JSONL_PATH, coords.map(c => JSON.stringify(c)).join('\n'));
  console.log('✓ test-route.jsonl created (3 lines)');

  // 2. Build multipart/form-data
  const tripId = `test-trip-${Date.now()}`;
  const body = new FormData();
  body.append('tripId', tripId);
  body.append('title', 'Test Route – Hanoi Old Quarter');
  body.append('distanceKm', '1.23');
  body.append('startTime', '2026-05-11T08:00:00.000Z');
  body.append('endTime', '2026-05-11T08:10:00.000Z');
  const fileBlob = new Blob([fs.readFileSync(JSONL_PATH)], { type: 'application/octet-stream' });
  body.append('routeFile', fileBlob, 'test-route.jsonl');

  // 3. Send POST
  console.log(`→ POST ${API_URL}  (tripId: ${tripId})`);
  let res, json;
  try {
    res = await fetch(API_URL, { method: 'POST', body });
    json = await res.json();
  } catch (err) {
    console.error('FAIL: Request error –', err.message);
    process.exit(1);
  }
  console.log(`← ${res.status}`, JSON.stringify(json));

  if (res.status !== 201) {
    console.error('FAIL: Expected 201 Created');
    process.exit(1);
  }

  // 4. Verify uploads/
  const uploadedFile = path.join(UPLOADS_DIR, `${tripId}-route.jsonl`);
  if (fs.existsSync(uploadedFile)) {
    const lines = fs.readFileSync(uploadedFile, 'utf8').trim().split('\n');
    console.log(`✓ File saved: uploads/${tripId}-route.jsonl  (${lines.length} lines)`);
  } else {
    console.error('FAIL: Uploaded file not found:', uploadedFile);
    process.exit(1);
  }

  // 5. Verify SQLite DB
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare('SELECT * FROM trips WHERE trip_id = ?').get(tripId);
  db.close();
  if (row) {
    console.log('✓ DB row confirmed:', row);
  } else {
    console.error('FAIL: No DB row found for tripId', tripId);
    process.exit(1);
  }

  // Cleanup
  fs.unlinkSync(JSONL_PATH);
  console.log('\n✓ All checks passed. Cleaned up test-route.jsonl.');
})();
