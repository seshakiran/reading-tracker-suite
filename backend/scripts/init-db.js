const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || '/app/data/reading_tracker.db';

console.log('Initializing database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Create tables
const createTables = () => {
  const tables = [
    // Reading sessions table
    `CREATE TABLE IF NOT EXISTS reading_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      content_type TEXT DEFAULT 'web',
      reading_time INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      excerpt TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Tags table
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6B7280',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Session tags relationship
    `CREATE TABLE IF NOT EXISTS session_tags (
      session_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )`,
    
    // Settings table for configuration
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err.message);
      } else {
        console.log(`Table ${index + 1} created successfully.`);
      }
    });
  });
};

// Insert default data
const insertDefaultData = () => {
  const defaultTags = [
    { name: 'Technology', color: '#3B82F6' },
    { name: 'Business', color: '#10B981' },
    { name: 'Personal', color: '#F59E0B' },
    { name: 'Research', color: '#8B5CF6' },
    { name: 'News', color: '#EF4444' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)');
  
  defaultTags.forEach(tag => {
    stmt.run([tag.name, tag.color], (err) => {
      if (err) {
        console.error('Error inserting default tag:', err.message);
      }
    });
  });
  
  stmt.finalize();
  console.log('Default tags inserted.');
};

// Initialize database
createTables();
setTimeout(() => {
  insertDefaultData();
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database initialized successfully!');
    }
  });
}, 1000);