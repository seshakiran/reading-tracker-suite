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
  const { title, url, content_type, reading_time, word_count, excerpt, notes, tags, learning_score, category } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const sql = `
    INSERT INTO reading_sessions (title, url, content_type, reading_time, word_count, excerpt, notes, learning_score, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [title, url, content_type || 'web', reading_time || 0, word_count || 0, excerpt, notes, learning_score || 0, category || 'other'], function(err) {
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
      AVG(learning_score) as avg_learning_score,
      COUNT(DISTINCT DATE(created_at)) as reading_days
    FROM reading_sessions
  `;
  
  db.get(sql, [], (err, row) => {
    if (err) {
      console.error('Error fetching stats:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    // Get category breakdown
    const categorySQL = `
      SELECT category, COUNT(*) as count, SUM(reading_time) as total_time, AVG(learning_score) as avg_score
      FROM reading_sessions 
      GROUP BY category
      ORDER BY count DESC
    `;
    
    db.all(categorySQL, [], (err, categories) => {
      if (err) {
        console.error('Error fetching category stats:', err.message);
        categories = [];
      }
      
      res.json({
        totalSessions: row.total_sessions || 0,
        totalReadingTime: row.total_reading_time || 0,
        totalWords: row.total_words || 0,
        averageReadingTime: Math.round(row.avg_reading_time || 0),
        averageLearningScore: Math.round(row.avg_learning_score || 0),
        readingDays: row.reading_days || 0,
        categories: categories || []
      });
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

// Newsletter generation endpoint
app.post('/api/newsletter/generate', async (req, res) => {
  try {
    const { dateRange = 7, includeCategories = ['all'], excludeLowScore = true, minScore = 50 } = req.body;
    
    console.log('Generating newsletter with params:', { dateRange, includeCategories, excludeLowScore, minScore });
    
    // Get reading sessions from the specified date range
    let dateFrom, dateTo;
    
    if (dateRange === 0) {
      // Today only - from start of today to end of today  
      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
      dateFrom = today + ' 00:00:00';
      dateTo = today + ' 23:59:59';
    } else {
      // Previous days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      
      dateFrom = startDate.toISOString().split('T')[0] + ' 00:00:00';
      dateTo = endDate.toISOString().split('T')[0] + ' 23:59:59';
    }
    
    let sql = `
      SELECT 
        rs.*,
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM reading_sessions rs
      LEFT JOIN session_tags st ON rs.id = st.session_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE rs.created_at >= ? AND rs.created_at <= ?
    `;
    
    const params = [dateFrom, dateTo];
    
    // Add category filter if not 'all'
    if (!includeCategories.includes('all')) {
      sql += ` AND rs.category IN (${includeCategories.map(() => '?').join(',')})`;
      params.push(...includeCategories);
    }
    
    // Add minimum score filter
    if (excludeLowScore) {
      sql += ` AND rs.learning_score >= ?`;
      params.push(minScore);
    }
    
    sql += ` GROUP BY rs.id ORDER BY rs.learning_score DESC, rs.created_at DESC`;
    
    db.all(sql, params, (err, sessions) => {
      if (err) {
        console.error('Error fetching sessions for newsletter:', err.message);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
      }
      
      // Process sessions for newsletter
      const processedSessions = sessions.map(session => ({
        ...session,
        tags: session.tags ? session.tags.split(',') : [],
        tag_colors: session.tag_colors ? session.tag_colors.split(',') : [],
        reading_time_formatted: `${session.reading_time} min`,
        created_at_formatted: new Date(session.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }));
      
      // Group by category
      const categorizedSessions = processedSessions.reduce((acc, session) => {
        const category = session.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(session);
        return acc;
      }, {});
      
      // Generate newsletter content
      const newsletter = generateNewsletterContent(processedSessions, categorizedSessions, dateRange);
      
      res.json({
        success: true,
        newsletter,
        stats: {
          totalSessions: processedSessions.length,
          dateRange,
          categories: Object.keys(categorizedSessions),
          avgLearningScore: processedSessions.length > 0 
            ? Math.round(processedSessions.reduce((sum, s) => sum + s.learning_score, 0) / processedSessions.length)
            : 0
        },
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('Newsletter generation error:', error);
    res.status(500).json({ error: 'Failed to generate newsletter' });
  }
});

// Helper function to generate newsletter content
function generateNewsletterContent(sessions, categorizedSessions, dateRange) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let newsletter = {
    title: `Reading Digest - ${dateStr}`,
    subtitle: dateRange === 0 
      ? `My curated learning from today` 
      : `My curated learning from the past ${dateRange} days`,
    intro: generateIntro(sessions, dateRange),
    sections: [],
    footer: generateFooter(sessions)
  };
  
  // Create sections by category
  const categoryTitles = {
    technology: '🔧 Technology & Development',
    science: '🔬 Science & Research', 
    business: '💼 Business & Strategy',
    education: '📚 Learning & Education',
    future: '🚀 Future & Innovation',
    other: '📝 Other Insights'
  };
  
  Object.entries(categorizedSessions).forEach(([category, categorySessions]) => {
    if (categorySessions.length === 0) return;
    
    newsletter.sections.push({
      title: categoryTitles[category] || `📄 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
      items: categorySessions.map(session => ({
        title: session.title,
        url: session.url,
        excerpt: session.excerpt || generateExcerpt(session),
        readingTime: session.reading_time,
        learningScore: session.learning_score,
        tags: session.tags,
        date: session.created_at_formatted,
        category: session.category
      }))
    });
  });
  
  return newsletter;
}

function generateIntro(sessions, dateRange) {
  const totalSessions = sessions.length;
  const totalReadingTime = sessions.reduce((sum, s) => sum + s.reading_time, 0);
  const avgScore = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + s.learning_score, 0) / sessions.length)
    : 0;
  
  const timeFrame = dateRange === 0 
    ? 'today' 
    : `over the past ${dateRange} days`;
    
  const readingDescription = dateRange === 0
    ? `Today I've been tracking my reading and discovered some fascinating insights`
    : `Over the past ${dateRange} days, I've been tracking my reading habits and discovered some fascinating insights`;
  
  return `${readingDescription}. I've read ${totalSessions} high-quality articles and resources, spending ${totalReadingTime} minutes learning about technology, business strategy, and innovation. Here are the highlights with an average learning value of ${avgScore}/100.`;
}

function generateExcerpt(session) {
  if (session.excerpt) return session.excerpt;
  
  // Generate a simple excerpt based on title and basic info
  return `Insights on ${session.category} with a learning score of ${session.learning_score}/100. Read time: ${session.reading_time} minutes.`;
}

function generateFooter(sessions) {
  const categories = [...new Set(sessions.map(s => s.category))];
  return {
    totalArticles: sessions.length,
    categoriesCovered: categories.length,
    categories: categories,
    generatedAt: new Date().toISOString(),
    message: "This digest was automatically generated from my reading tracker. Each article was intelligently filtered and scored for learning value."
  };
}

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