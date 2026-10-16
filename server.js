const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const OPENAI_KEY = process.env.OPENAI_KEY || '';
const PORT = process.env.PORT || 3000;

// Initialize DB
const dbFile = process.env.DB_FILE || './hhub.db';
const db = new sqlite3.Database(dbFile);
const migrations = fs.readFileSync('./migrations.sql', 'utf8');
db.exec(migrations, err => { if (err) console.error('Migration error', err); });

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Serve frontend: prefer public/, fall back to repo root (keeps original index.html intact)
app.use(express.static('public'));
app.use(express.static('.'));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', [name, email, hash], function (err) {
      if (err) return res.status(400).json({ error: 'Email exists or DB error' });
      const user = { id: this.lastID, name, email };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: row.id, name: row.name, email: row.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  });
});

app.get('/api/posts', (req, res) => {
  db.all(`SELECT p.id, p.content, p.image_url, p.created_at, u.id as user_id, u.name as user_name
          FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

app.post('/api/posts', authMiddleware, (req, res) => {
  const { content, image_url } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Empty post' });
  db.run('INSERT INTO posts (user_id, content, image_url) VALUES (?,?,?)', [req.user.id, content, image_url || null], function (err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    db.get('SELECT p.id, p.content, p.image_url, p.created_at, u.id as user_id, u.name as user_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?', [this.lastID], (err, row) => {
      res.status(201).json(row);
    });
  });
});

// Simple AI proxy - forwards to OpenAI chat completion endpoint
app.post('/api/ai', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  if (!OPENAI_KEY) return res.status(500).json({ error: 'AI not configured' });
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      })
    });
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || data.error || 'No answer';
    res.json({ answer });
  } catch (e) {
    console.error('AI error', e);
    res.status(500).json({ error: 'AI error' });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
