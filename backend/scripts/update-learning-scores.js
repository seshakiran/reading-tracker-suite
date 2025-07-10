const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || '/app/data/reading_tracker.db';

console.log('Updating learning scores for existing sessions...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database for learning score update.');
});

// Update sessions with 0 learning scores to reasonable defaults based on content
const updateSql = `
  UPDATE reading_sessions 
  SET 
    learning_score = CASE 
      WHEN word_count >= 1500 THEN 75
      WHEN word_count >= 1000 THEN 65
      WHEN word_count >= 500 THEN 55
      WHEN word_count >= 300 THEN 45
      ELSE 35
    END,
    category = CASE
      WHEN LOWER(title) LIKE '%ai%' OR LOWER(title) LIKE '%artificial intelligence%' OR LOWER(title) LIKE '%machine learning%' THEN 'technology'
      WHEN LOWER(title) LIKE '%business%' OR LOWER(title) LIKE '%strategy%' OR LOWER(title) LIKE '%ceo%' OR LOWER(title) LIKE '%leadership%' THEN 'business'
      WHEN LOWER(title) LIKE '%science%' OR LOWER(title) LIKE '%research%' THEN 'science'
      WHEN LOWER(title) LIKE '%education%' OR LOWER(title) LIKE '%learning%' THEN 'education'
      WHEN LOWER(title) LIKE '%future%' OR LOWER(title) LIKE '%innovation%' OR LOWER(title) LIKE '%disruption%' THEN 'future'
      ELSE 'technology'
    END
  WHERE learning_score = 0 OR learning_score IS NULL;
`;

db.run(updateSql, (err) => {
  if (err) {
    console.error('Error updating learning scores:', err.message);
    process.exit(1);
  }
  
  console.log('Learning scores updated successfully!');
  
  // Show updated sessions
  db.all('SELECT id, title, word_count, learning_score, category FROM reading_sessions ORDER BY id', [], (err, rows) => {
    if (err) {
      console.error('Error fetching updated sessions:', err.message);
      process.exit(1);
    }
    
    console.log('\nUpdated sessions:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Score: ${row.learning_score}, Category: ${row.category}, Words: ${row.word_count}, Title: ${row.title.substring(0, 50)}...`);
    });
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\nDatabase connection closed. Learning scores updated!');
      }
    });
  });
});