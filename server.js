const express = require('express');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();

// Body Parser
app.use(express.json());

// Serve static frontend files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API ROUTES
// ==========================================

// --- EMPLOYEES ---
app.get('/api/employees', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employees');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  const { name, email, role } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO employees (name, email, role) VALUES (?, ?, ?)',
      [name, email, role || 'Developer']
    );
    res.status(201).json({ id: result.insertId, name, email, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ATTENDANCE ---
app.post('/api/attendance/check-in', async (req, res) => {
  const { employee_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0];

  try {
    const isLate = now > '09:30:00';
    const status = isLate ? 'Late' : 'Present';

    const [result] = await db.query(
      'INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, ?)',
      [employee_id, today, now, status]
    );
    res.status(201).json({ message: 'Punch In Recorded', id: result.insertId, status, check_in: now });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'You have already punched in today!' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/check-out', async (req, res) => {
  const { employee_id } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0];

  try {
    const [result] = await db.query(
      'UPDATE attendance SET check_out = ? WHERE employee_id = ? AND date = ?',
      [now, employee_id, today]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No punch-in record found for today.' });
    }
    res.json({ message: 'Punch Out Recorded', check_out: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/:employee_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC',
      [req.params.employee_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASKS ---
app.get('/api/tasks', async (req, res) => {
  const { employee_id } = req.query;
  try {
    let query = `
      SELECT t.*, e.name AS employee_name 
      FROM tasks t 
      JOIN employees e ON t.employee_id = e.id
    `;
    let params = [];
    if (employee_id) {
      query += ' WHERE t.employee_id = ?';
      params.push(employee_id);
    }
    query += ' ORDER BY t.id DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { employee_id, title, description, deadline } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO tasks (employee_id, title, description, deadline, status) VALUES (?, ?, ?, ?, "Pending")',
      [employee_id, title, description, deadline]
    );
    res.status(201).json({ id: result.insertId, title, employee_id, status: 'Pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Express 5 compatible wildcard syntax
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 System running at http://localhost:${PORT}`);
});