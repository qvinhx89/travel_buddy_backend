const express = require('express');
const cors = require('cors');
require('./db/database'); // initializes DB and schema on startup

const tripRoutes = require('./routes/trips');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/trips', tripRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel Buddy backend running on http://0.0.0.0:${PORT}`);
});
