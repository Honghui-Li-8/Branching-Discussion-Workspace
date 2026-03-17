import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'server' });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Node backend' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
