const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || '/app/data/reading_tracker.db';

console.log('Migrating database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database for migration.');
});

// Add new columns if they don't exist
const migrations = [
  {
    name: 'Add learning_score column',
    sql: `ALTER TABLE reading_sessions ADD COLUMN learning_score INTEGER DEFAULT 0;`
  },
  {
    name: 'Add category column',
    sql: `ALTER TABLE reading_sessions ADD COLUMN category TEXT DEFAULT 'other';`
  }
];

function runMigrations() {
  migrations.forEach((migration, index) => {
    db.run(migration.sql, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`Migration ${index + 1} (${migration.name}): Already exists, skipping`);
        } else {
          console.error(`Migration ${index + 1} (${migration.name}): Error -`, err.message);
        }
      } else {
        console.log(`Migration ${index + 1} (${migration.name}): Success`);
      }
    });
  });
}

// Run migrations
runMigrations();

// Close after a delay to ensure all migrations complete
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database migration completed!');
    }
  });
}, 1000);