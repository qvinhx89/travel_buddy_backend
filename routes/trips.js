const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const tripId = req.body.tripId || 'unknown';
    cb(null, `${tripId}-route.jsonl`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.jsonl') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .jsonl files are accepted'));
    }
  },
});

const insertTrip = db.prepare(`
  INSERT OR REPLACE INTO trips
    (trip_id, title, distance_km, start_time, end_time, route_file_path)
  VALUES
    (@tripId, @title, @distanceKm, @startTime, @endTime, @routeFilePath)
`);

router.post('/sync', upload.single('routeFile'), (req, res) => {
  const { tripId, title, distanceKm, startTime, endTime } = req.body;

  if (!tripId || !title || !distanceKm || !startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'Missing required metadata fields' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Missing routeFile' });
  }

  insertTrip.run({
    tripId,
    title,
    distanceKm: parseFloat(distanceKm),
    startTime,
    endTime,
    routeFilePath: req.file.path,
  });

  return res.status(201).json({ success: true, tripId });
});

module.exports = router;
