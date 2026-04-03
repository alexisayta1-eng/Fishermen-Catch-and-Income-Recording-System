const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Database Connection
// Update these credentials if your MySQL setup is different
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // Default XAMPP/WAMP password is empty
    database: process.env.DB_NAME || 'fcirs_db',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database!');
});

// --- API Endpoints ---

// 1. Users / Auth
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/users/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) {
            res.json({ success: true, user: results[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

app.post('/api/users/register', (req, res) => {
    const { username, password, role } = req.body;
    db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, id: results.insertId });
    });
});

app.delete('/api/users/:username', (req, res) => {
    const username = req.params.username;
    // Transactional delete (simplified)
    db.query('DELETE FROM users WHERE username = ?', [username], (err) => {
        if (err) return res.status(500).json(err);
        db.query('DELETE FROM catches WHERE fisherman = ?', [username]);
        db.query('DELETE FROM operational_expenses WHERE recorded_by = ?', [username]);
        res.json({ success: true });
    });
});

// 2. Catches
app.get('/api/catches', (req, res) => {
    const { fisherman, date } = req.query;
    let sql = 'SELECT * FROM catches WHERE 1=1';
    const params = [];

    if (fisherman) {
        sql += ' AND fisherman = ?';
        params.push(fisherman);
    }
    if (date) {
        sql += ' AND DATE(recorded_at) = ?';
        params.push(date);
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/catches', (req, res) => {
    const { fisherman, fish_type, weight, price_per_kg, total_value, status } = req.body;
    const sql = 'INSERT INTO catches (fisherman, fish_type, weight, price_per_kg, total_value, status) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [fisherman, fish_type, weight, price_per_kg, total_value, status], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, id: results.insertId });
    });
});

app.put('/api/catches/:id', (req, res) => {
    const id = req.params.id;
    const { weight, price_per_kg, total_value } = req.body;
    const sql = 'UPDATE catches SET weight = ?, price_per_kg = ?, total_value = ? WHERE id = ?';
    db.query(sql, [weight, price_per_kg, total_value, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.delete('/api/catches/:id', (req, res) => {
    db.query('DELETE FROM catches WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// 3. Operational Expenses
app.get('/api/expenses', (req, res) => {
    const { recorded_by, date } = req.query;
    let sql = 'SELECT * FROM operational_expenses WHERE 1=1';
    const params = [];

    if (recorded_by) {
        sql += ' AND recorded_by = ?';
        params.push(recorded_by);
    }
    if (date) {
        sql += ' AND DATE(recorded_at) = ?';
        params.push(date);
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/expenses', (req, res) => {
    const { description, amount, category, recorded_by, role } = req.body;
    const sql = 'INSERT INTO operational_expenses (description, amount, category, recorded_by, role) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [description, amount, category, recorded_by, role], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, id: results.insertId });
    });
});

app.delete('/api/expenses/:id', (req, res) => {
    db.query('DELETE FROM operational_expenses WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// 4. Settings
app.get('/api/settings', (req, res) => {
    db.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0] || { prices: {} });
    });
});

app.post('/api/settings', (req, res) => {
    const { prices } = req.body;
    // Check if settings exist, else insert
    db.query('SELECT id FROM settings LIMIT 1', (err, results) => {
        if (results.length > 0) {
            db.query('UPDATE settings SET prices = ? WHERE id = ?', [JSON.stringify(prices), results[0].id], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ success: true });
            });
        } else {
            db.query('INSERT INTO settings (prices) VALUES (?)', [JSON.stringify(prices)], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ success: true });
            });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
