const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || '/app/data/reading_tracker.db';

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all reading sessions
app.get('/api/sessions', (req, res) => {
  const sql = `
    SELECT 
      rs.*,
      GROUP_CONCAT(t.name) as tags,
      GROUP_CONCAT(t.color) as tag_colors
    FROM reading_sessions rs
    LEFT JOIN session_tags st ON rs.id = st.session_id
    LEFT JOIN tags t ON st.tag_id = t.id
    GROUP BY rs.id
    ORDER BY rs.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching sessions:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    // Format the response
    const sessions = rows.map(row => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
      tag_colors: row.tag_colors ? row.tag_colors.split(',') : []
    }));
    
    res.json(sessions);
  });
});

// Create new reading session
app.post('/api/sessions', (req, res) => {
  const { title, url, content_type, reading_time, word_count, excerpt, notes, tags } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const sql = `
    INSERT INTO reading_sessions (title, url, content_type, reading_time, word_count, excerpt, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [title, url, content_type || 'web', reading_time || 0, word_count || 0, excerpt, notes], function(err) {
    if (err) {
      console.error('Error creating session:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const sessionId = this.lastID;
    
    // Add tags if provided
    if (tags && tags.length > 0) {
      const tagPromises = tags.map(tagName => {
        return new Promise((resolve, reject) => {
          // First, ensure tag exists
          db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName], function(err) {
            if (err) return reject(err);
            
            // Then link to session
            db.run(
              'INSERT INTO session_tags (session_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
              [sessionId, tagName],
              (err) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });
        });
      });
      
      Promise.all(tagPromises)
        .then(() => {
          res.json({ id: sessionId, message: 'Session created successfully' });
        })
        .catch(err => {
          console.error('Error adding tags:', err.message);
          res.json({ id: sessionId, message: 'Session created but tags failed' });
        });
    } else {
      res.json({ id: sessionId, message: 'Session created successfully' });
    }
  });
});

// Get reading statistics
app.get('/api/stats', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_sessions,
      SUM(reading_time) as total_reading_time,
      SUM(word_count) as total_words,
      AVG(reading_time) as avg_reading_time,
      COUNT(DISTINCT DATE(created_at)) as reading_days
    FROM reading_sessions
  `;
  
  db.get(sql, [], (err, row) => {
    if (err) {
      console.error('Error fetching stats:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json({
      totalSessions: row.total_sessions || 0,
      totalReadingTime: row.total_reading_time || 0,
      totalWords: row.total_words || 0,
      averageReadingTime: Math.round(row.avg_reading_time || 0),
      readingDays: row.reading_days || 0
    });
  });
});

// Get all tags
app.get('/api/tags', (req, res) => {
  const sql = 'SELECT * FROM tags ORDER BY name';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching tags:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(rows);
  });
});

// Reset database (development only)
app.delete('/api/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Reset not allowed in production' });
  }
  
  const resetSql = `
    DELETE FROM session_tags;
    DELETE FROM reading_sessions;
    UPDATE sqlite_sequence SET seq = 0 WHERE name = 'reading_sessions';
  `;
  
  db.exec(resetSql, (err) => {
    if (err) {
      console.error('Error resetting database:', err.message);
      return res.status(500).json({ error: 'Failed to reset database' });
    }
    
    console.log('Database reset successfully');
    res.json({ message: 'Database reset successfully', timestamp: new Date().toISOString() });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});