const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || '/app/data/reading_tracker.db';

// Basic encryption for API keys (not production-grade, but better than plain text)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'reading-tracker-default-key-change-in-production';

function encryptApiKey(text) {
  if (!text) return null;
  const cipher = crypto.createCipher('aes192', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptApiKey(encrypted) {
  if (!encrypted) return null;
  try {
    const decipher = crypto.createDecipher('aes192', ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting API key:', error);
    return null;
  }
}

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
  
  // Update database schema for LLM features
  initializeLLMSchema();
});

// Initialize LLM-related database schema
function initializeLLMSchema() {
  // Add LLM summary columns to reading_sessions table
  db.run(`ALTER TABLE reading_sessions ADD COLUMN llm_summary TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding llm_summary column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE reading_sessions ADD COLUMN llm_model TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding llm_model column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE reading_sessions ADD COLUMN llm_generated_at TIMESTAMP DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding llm_generated_at column:', err.message);
    }
  });
  
  // Create LLM configuration table
  db.run(`CREATE TABLE IF NOT EXISTS llm_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- 'ollama', 'openai', 'gemini', 'grok'
    model_name TEXT NOT NULL,
    api_key TEXT,
    api_url TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 1, -- 1 = highest priority, 2 = second, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating llm_config table:', err.message);
    } else {
      console.log('LLM configuration table ready');
    }
  });
  
  // Add priority column to existing table
  db.run(`ALTER TABLE llm_config ADD COLUMN priority INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding priority column:', err.message);
    } else {
      console.log('Priority column added/verified in llm_config table');
    }
  });
  
  console.log('Database schema updated for LLM features');
}

// LLM Service Layer
class LLMService {
  static async getActiveConfigs() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM llm_config WHERE is_active = 1 ORDER BY priority ASC', [], (err, rows) => {
        if (err) reject(err);
        else {
          const configs = rows.map(row => {
            if (row.api_key) {
              row.api_key = decryptApiKey(row.api_key);
            }
            return row;
          });
          resolve(configs);
        }
      });
    });
  }
  
  static async getActiveConfig() {
    const configs = await this.getActiveConfigs();
    return configs.length > 0 ? configs[0] : null;
  }
  
  static async extractArticleContent(url) {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
    
    for (const userAgent of userAgents) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 10000
        });
        
        if (!response.ok) {
          console.log(`HTTP ${response.status} with User-Agent: ${userAgent.substring(0, 30)}...`);
          continue;
        }
        
        const html = await response.text();
        
        // Enhanced content extraction
        let content = html;
        
        // Remove scripts, styles, and navigation elements
        content = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<div[^>]*class="[^"]*(?:ad|advertisement|sidebar|menu|navigation)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        
        // Try to extract main content areas
        const contentPatterns = [
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
          /<div[^>]*class="[^"]*(?:content|post|article|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<main[^>]*>([\s\S]*?)<\/main>/gi,
          /<div[^>]*id="[^"]*(?:content|post|article|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
        ];
        
        let extractedContent = '';
        for (const pattern of contentPatterns) {
          const matches = content.match(pattern);
          if (matches && matches[0]) {
            extractedContent = matches[0];
            break;
          }
        }
        
        // If no specific content area found, use body
        if (!extractedContent) {
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          extractedContent = bodyMatch ? bodyMatch[1] : content;
        }
        
        // Remove all HTML tags and clean up
        extractedContent = extractedContent
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        
        // Filter out navigation and menu text
        const lines = extractedContent.split('\n').filter(line => {
          const trimmed = line.trim().toLowerCase();
          return trimmed.length > 10 && 
                 !trimmed.includes('cookie') &&
                 !trimmed.includes('subscribe') &&
                 !trimmed.includes('sign up') &&
                 !trimmed.includes('menu') &&
                 !trimmed.includes('search');
        });
        
        content = lines.join(' ').trim();
        
        // Must have substantial content
        if (content.length < 200) {
          console.log(`Content too short (${content.length} chars) with User-Agent: ${userAgent.substring(0, 30)}...`);
          continue;
        }
        
        // Limit content length for LLM processing
        if (content.length > 8000) {
          content = content.substring(0, 8000) + '...';
        }
        
        console.log(`Successfully extracted ${content.length} characters from ${url}`);
        return content;
        
      } catch (error) {
        console.log(`Failed with User-Agent ${userAgent.substring(0, 30)}...: ${error.message}`);
        continue;
      }
    }
    
    console.error('All content extraction attempts failed for:', url);
    return null;
  }
  
  static async generateSummary(title, url, content) {
    const configs = await this.getActiveConfigs();
    if (configs.length === 0) {
      throw new Error('No active LLM configurations found');
    }
    
    const prompt = `Please provide a concise, engaging summary of this article in 2-3 sentences. Focus on the key insights and takeaways that would be valuable for a professional newsletter.

Title: ${title}
URL: ${url}
Content: ${content}

Summary:`;

    const errors = [];
    
    // Try each LLM in priority order (waterfall)
    for (const config of configs) {
      try {
        console.log(`Trying ${config.provider}:${config.model_name} (priority ${config.priority})`);
        
        let summary;
        
        switch (config.provider) {
          case 'ollama':
            summary = await this.generateWithOllama(config, prompt);
            break;
          case 'openai':
            summary = await this.generateWithOpenAI(config, prompt);
            break;
          case 'gemini':
            summary = await this.generateWithGemini(config, prompt);
            break;
          case 'grok':
            summary = await this.generateWithGrok(config, prompt);
            break;
          default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
        }
        
        console.log(`✅ Success with ${config.provider}:${config.model_name}`);
        return {
          summary,
          model: config.model_name,
          provider: config.provider,
          priority: config.priority
        };
        
      } catch (error) {
        const errorMsg = `${config.provider}:${config.model_name} failed: ${error.message}`;
        console.log(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }
    }
    
    // All models failed
    throw new Error(`All LLM models failed. Errors: ${errors.join('; ')}`);
  }
  
  static async generateWithOllama(config, prompt) {
    // Try multiple Ollama endpoints
    const baseUrls = [
      config.api_url,
      'http://host.docker.internal:11434',
      'http://localhost:11434',
      'http://127.0.0.1:11434'
    ].filter(Boolean);
    
    let lastError;
    
    for (const baseUrl of baseUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model_name,
            prompt: prompt,
            stream: false
          })
        });
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response;
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    throw lastError || new Error('Could not connect to Ollama');
  }
  
  static async generateWithOpenAI(config, prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model_name,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  static async generateWithGemini(config, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model_name}:generateContent?key=${config.api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  static async generateWithGrok(config, prompt) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model_name,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

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
    const { dateRange = 7, includeCategories = ['all'], excludeLowScore = true, minScore = 50, excludeLinkedIn = false } = req.body;
    
    console.log('Generating newsletter with params:', { dateRange, includeCategories, excludeLowScore, minScore, excludeLinkedIn });
    
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
    
    // Exclude LinkedIn posts by default (unless specifically requested)
    if (!includeCategories.includes('linkedin') && !includeCategories.includes('linkedin_newsletter')) {
      sql += ` AND rs.category NOT IN ('linkedin', 'linkedin_newsletter')`;
      sql += ` AND rs.url NOT LIKE '%linkedin.com%'`;
    }
    
    // Add LinkedIn exclusion filter (legacy support)
    if (excludeLinkedIn && includeCategories.includes('all')) {
      sql += ` AND rs.category NOT IN ('linkedin', 'linkedin_newsletter')`;
      sql += ` AND rs.url NOT LIKE '%linkedin.com%'`;
    }
    
    sql += ` GROUP BY rs.id ORDER BY rs.learning_score DESC, rs.created_at DESC`;
    
    db.all(sql, params, (err, sessions) => {
      if (err) {
        console.error('Error fetching sessions for newsletter:', err.message);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
      }
      
      // Remove duplicates based on URL and title
      const uniqueSessions = [];
      const seenUrls = new Set();
      const seenTitles = new Set();
      
      sessions.forEach(session => {
        const normalizedUrl = session.url?.toLowerCase().split('?')[0]; // Remove query params for comparison
        const normalizedTitle = session.title?.toLowerCase().trim();
        
        if (!seenUrls.has(normalizedUrl) && !seenTitles.has(normalizedTitle)) {
          seenUrls.add(normalizedUrl);
          seenTitles.add(normalizedTitle);
          uniqueSessions.push(session);
        }
      });
      
      // Process sessions for newsletter
      const processedSessions = uniqueSessions.map(session => ({
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
    curated: '⭐ Curated Articles',
    technology: '🔧 Technology & Development',
    science: '🔬 Science & Research', 
    business: '💼 Business & Strategy',
    education: '📚 Learning & Education',
    future: '🚀 Future & Innovation',
    linkedin: '💼 LinkedIn Professional Insights',
    linkedin_newsletter: '📰 Curated LinkedIn Posts',
    other: '📝 Other Insights'
  };
  
  Object.entries(categorizedSessions).forEach(([category, categorySessions]) => {
    if (categorySessions.length === 0) return;
    
    newsletter.sections.push({
      title: categoryTitles[category] || `📄 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
      items: categorySessions.map(session => ({
        title: session.title,
        url: session.url,
        excerpt: session.llm_summary || session.excerpt || generateExcerpt(session),
        readingTime: session.reading_time,
        learningScore: session.learning_score,
        tags: session.tags,
        date: session.created_at_formatted,
        category: session.category,
        llmGenerated: !!session.llm_summary,
        llmModel: session.llm_model
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

// Newsletter queue management endpoints

// Get newsletter queue items
app.get('/api/newsletter/queue', (req, res) => {
  const sql = `
    SELECT 
      rs.*,
      GROUP_CONCAT(t.name) as tags,
      GROUP_CONCAT(t.color) as tag_colors
    FROM reading_sessions rs
    LEFT JOIN session_tags st ON rs.id = st.session_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE rs.category = 'newsletter_queue'
    GROUP BY rs.id
    ORDER BY rs.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching newsletter queue:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    // Format the response
    const items = rows.map(row => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
      tag_colors: row.tag_colors ? row.tag_colors.split(',') : []
    }));
    
    res.json(items);
  });
});

// Add article to newsletter queue
app.post('/api/newsletter/queue', (req, res) => {
  const { title, url, content_type, reading_time, word_count, excerpt, notes, learning_score } = req.body;
  
  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required' });
  }
  
  const sql = `
    INSERT INTO reading_sessions (title, url, content_type, reading_time, word_count, excerpt, notes, learning_score, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'newsletter_queue')
  `;
  
  db.run(sql, [title, url, content_type || 'web', reading_time || 0, word_count || 0, excerpt, notes, learning_score || 75], async function(err) {
    if (err) {
      console.error('Error adding to newsletter queue:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const sessionId = this.lastID;
    
    try {
      // Auto-generate newsletter with updated queue
      const newsletterData = await generateNewsletterFromQueue();
      
      res.json({ 
        success: true, 
        id: sessionId, 
        message: 'Article added to newsletter queue',
        newsletter: newsletterData.newsletter,
        stats: newsletterData.stats,
        formats: {
          html: generateNewsletterHTML(newsletterData.newsletter),
          markdown: generateNewsletterMarkdown(newsletterData.newsletter)
        }
      });
    } catch (error) {
      console.error('Error auto-generating newsletter:', error);
      // Still return success for adding to queue, even if newsletter generation fails
      res.json({ 
        success: true, 
        id: sessionId, 
        message: 'Article added to newsletter queue (newsletter generation failed)',
        error: 'Newsletter auto-generation failed'
      });
    }
  });
});

// Remove article from newsletter queue
app.delete('/api/newsletter/queue/:id', (req, res) => {
  const { id } = req.params;
  
  const sql = `DELETE FROM reading_sessions WHERE id = ? AND category = 'newsletter_queue'`;
  
  db.run(sql, [id], function(err) {
    if (err) {
      console.error('Error removing from newsletter queue:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Article not found in newsletter queue' });
    }
    
    res.json({ 
      success: true, 
      message: 'Article removed from newsletter queue' 
    });
  });
});

// Move queue items to newsletter (include newsletter_queue in newsletter generation)
app.post('/api/newsletter/generate-from-queue', async (req, res) => {
  try {
    const { includeTracked = false, dateRange = 7, minScore = 50 } = req.body;
    
    let sql = `
      SELECT 
        rs.*,
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM reading_sessions rs
      LEFT JOIN session_tags st ON rs.id = st.session_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE rs.category = 'newsletter_queue'
    `;
    
    const params = [];
    
    // Optionally include tracked articles from recent days
    if (includeTracked) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      
      const dateFrom = startDate.toISOString().split('T')[0] + ' 00:00:00';
      const dateTo = endDate.toISOString().split('T')[0] + ' 23:59:59';
      
      sql = `
        SELECT 
          rs.*,
          GROUP_CONCAT(t.name) as tags,
          GROUP_CONCAT(t.color) as tag_colors
        FROM reading_sessions rs
        LEFT JOIN session_tags st ON rs.id = st.session_id
        LEFT JOIN tags t ON st.tag_id = t.id
        WHERE (rs.category = 'newsletter_queue' 
               OR (rs.category NOT IN ('linkedin', 'linkedin_newsletter') 
                   AND rs.url NOT LIKE '%linkedin.com%'
                   AND rs.created_at >= ? AND rs.created_at <= ? 
                   AND rs.learning_score >= ?))
      `;
      params.push(dateFrom, dateTo, minScore);
    }
    
    sql += ` GROUP BY rs.id ORDER BY rs.category = 'newsletter_queue' DESC, rs.learning_score DESC, rs.created_at DESC`;
    
    db.all(sql, params, (err, sessions) => {
      if (err) {
        console.error('Error fetching sessions for newsletter:', err.message);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
      }
      
      // Remove duplicates based on URL and title
      const uniqueSessions = [];
      const seenUrls = new Set();
      const seenTitles = new Set();
      
      sessions.forEach(session => {
        const normalizedUrl = session.url?.toLowerCase().split('?')[0]; // Remove query params for comparison
        const normalizedTitle = session.title?.toLowerCase().trim();
        
        if (!seenUrls.has(normalizedUrl) && !seenTitles.has(normalizedTitle)) {
          seenUrls.add(normalizedUrl);
          seenTitles.add(normalizedTitle);
          uniqueSessions.push(session);
        }
      });
      
      // Process sessions for newsletter
      const processedSessions = uniqueSessions.map(session => ({
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
      
      // Group by category, with newsletter_queue items marked as "curated"
      const categorizedSessions = processedSessions.reduce((acc, session) => {
        const category = session.category === 'newsletter_queue' ? 'curated' : session.category;
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
          queueItems: processedSessions.filter(s => s.category === 'newsletter_queue').length,
          dateRange,
          categories: Object.keys(categorizedSessions),
          avgLearningScore: processedSessions.length > 0 
            ? Math.round(processedSessions.reduce((sum, s) => sum + s.learning_score, 0) / processedSessions.length)
            : 0
        },
        formats: {
          html: generateNewsletterHTML(newsletter),
          markdown: generateNewsletterMarkdown(newsletter)
        },
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('Newsletter generation error:', error);
    res.status(500).json({ error: 'Failed to generate newsletter' });
  }
});

// Helper function to generate newsletter from queue
async function generateNewsletterFromQueue() {
  return new Promise(async (resolve, reject) => {
    const sql = `
      SELECT 
        rs.*,
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM reading_sessions rs
      LEFT JOIN session_tags st ON rs.id = st.session_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE rs.category = 'newsletter_queue'
        AND rs.url NOT LIKE '%linkedin.com%'
        AND rs.url NOT LIKE '%linkedin.com/feed%'
        AND rs.url NOT LIKE '%linkedin.com/posts%'
      GROUP BY rs.id
      ORDER BY rs.created_at DESC
    `;
    
    db.all(sql, [], async (err, sessions) => {
      if (err) {
        return reject(err);
      }
      
      // Auto-generate summaries for articles without them
      const articlesNeedingSummaries = sessions.filter(session => 
        !session.llm_summary && session.url
      );
      
      if (articlesNeedingSummaries.length > 0) {
        console.log(`Auto-generating summaries for ${articlesNeedingSummaries.length} articles...`);
        
        for (const session of articlesNeedingSummaries) {
          try {
            // Extract content and generate summary
            const content = await LLMService.extractArticleContent(session.url);
            if (content) {
              const result = await LLMService.generateSummary(session.title, session.url, content);
              if (result) {
                // Update the session with the new summary
                const updateSql = `
                  UPDATE reading_sessions 
                  SET llm_summary = ?, llm_model = ?, llm_generated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `;
                
                await new Promise((resolve, reject) => {
                  db.run(updateSql, [result.summary, `${result.provider}:${result.model}`, session.id], (err) => {
                    if (err) reject(err);
                    else {
                      session.llm_summary = result.summary;
                      session.llm_model = `${result.provider}:${result.model}`;
                      resolve();
                    }
                  });
                });
                
                console.log(`Generated summary for: ${session.title}`);
              }
            }
          } catch (error) {
            console.error(`Failed to generate summary for ${session.title}:`, error.message);
          }
        }
      }
      
      // Remove duplicates based on URL and title
      const uniqueSessions = [];
      const seenUrls = new Set();
      const seenTitles = new Set();
      
      sessions.forEach(session => {
        const normalizedUrl = session.url?.toLowerCase().split('?')[0]; // Remove query params for comparison
        const normalizedTitle = session.title?.toLowerCase().trim();
        
        if (!seenUrls.has(normalizedUrl) && !seenTitles.has(normalizedTitle)) {
          seenUrls.add(normalizedUrl);
          seenTitles.add(normalizedTitle);
          uniqueSessions.push(session);
        }
      });
      
      // Process sessions for newsletter
      const processedSessions = uniqueSessions.map(session => ({
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
      
      // Group by category, with newsletter_queue items marked as "curated"
      const categorizedSessions = processedSessions.reduce((acc, session) => {
        const category = 'curated'; // All queue items are curated
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(session);
        return acc;
      }, {});
      
      // Generate newsletter content
      const newsletter = generateNewsletterContent(processedSessions, categorizedSessions, 0);
      
      resolve({
        newsletter,
        stats: {
          totalSessions: processedSessions.length,
          queueItems: processedSessions.length,
          dateRange: 0,
          categories: Object.keys(categorizedSessions),
          avgLearningScore: processedSessions.length > 0 
            ? Math.round(processedSessions.reduce((sum, s) => sum + s.learning_score, 0) / processedSessions.length)
            : 0
        },
        formats: {
          html: generateNewsletterHTML(newsletter),
          markdown: generateNewsletterMarkdown(newsletter)
        }
      });
    });
  });
}

// Generate HTML format for Substack
function generateNewsletterHTML(newsletter) {
  // Generate rich text format that works better with Substack's editor
  let content = `${newsletter.title}\n\n`;
  content += `${newsletter.subtitle}\n\n`;
  content += `${newsletter.intro}\n\n`;
  
  newsletter.sections.forEach(section => {
    content += `${section.title}\n\n`;
    section.items.forEach(item => {
      // Format optimized for Substack rich text editor
      content += `${item.title}\n`;
      content += `Link: ${item.url}\n\n`;
      content += `${item.excerpt}\n\n`;
      
      if (item.tags.length > 0) {
        content += `Tags: ${item.tags.join(', ')}\n`;
      }
      
      content += `${item.date} • Score: ${item.learningScore}/100\n\n`;
      content += `—————————————————————————————————————\n\n`;
    });
  });
  
  content += `About This Digest\n\n`;
  content += `${newsletter.footer.message}\n\n`;
  content += `📊 Stats:\n`;
  content += `• Total articles: ${newsletter.footer.totalArticles}\n`;
  content += `• Categories: ${newsletter.footer.categories.join(', ')}\n`;
  content += `• Generated: ${new Date(newsletter.footer.generatedAt).toLocaleString()}\n`;
  
  return content;
}

// Generate clean HTML format for other platforms  
function generateNewsletterHTMLFormatted(newsletter) {
  let html = `<h1>${newsletter.title}</h1>\n\n`;
  html += `<p><em>${newsletter.subtitle}</em></p>\n\n`;
  html += `<p>${newsletter.intro}</p>\n\n`;
  
  newsletter.sections.forEach(section => {
    html += `<h2>${section.title}</h2>\n\n`;
    section.items.forEach(item => {
      html += `<h3><a href="${item.url}">${item.title}</a></h3>\n\n`;
      html += `<p>${item.excerpt}</p>\n\n`;
      
      if (item.tags.length > 0) {
        html += `<p><em>Tags: ${item.tags.join(', ')}</em></p>\n\n`;
      }
      
      html += `<p><small>${item.date} • Learning Score: ${item.learningScore}/100</small></p>\n\n`;
      html += `<hr>\n\n`;
    });
  });
  
  html += `<h3>About This Digest</h3>\n\n`;
  html += `<p>${newsletter.footer.message}</p>\n\n`;
  html += `<p><strong>Stats:</strong></p>\n`;
  html += `<ul>\n`;
  html += `  <li>Total articles: ${newsletter.footer.totalArticles}</li>\n`;
  html += `  <li>Categories: ${newsletter.footer.categories.join(', ')}</li>\n`;
  html += `  <li>Generated: ${new Date(newsletter.footer.generatedAt).toLocaleString()}</li>\n`;
  html += `</ul>\n`;
  
  return html;
}

// Generate Markdown format
function generateNewsletterMarkdown(newsletter) {
  let markdown = `# ${newsletter.title}\n\n`;
  markdown += `*${newsletter.subtitle}*\n\n`;
  markdown += `${newsletter.intro}\n\n`;
  
  newsletter.sections.forEach(section => {
    markdown += `## ${section.title}\n\n`;
    section.items.forEach(item => {
      markdown += `### [${item.title}](${item.url})\n\n`;
      markdown += `${item.excerpt}\n\n`;
      
      if (item.tags.length > 0) {
        markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
      }
      
      markdown += `*${item.date} • Score: ${item.learningScore}/100*\n\n`;
      markdown += `---\n\n`;
    });
  });
  
  markdown += `## About This Digest\n\n`;
  markdown += `${newsletter.footer.message}\n\n`;
  markdown += `- **Total articles:** ${newsletter.footer.totalArticles}\n`;
  markdown += `- **Categories:** ${newsletter.footer.categories.join(', ')}\n`;
  markdown += `- **Generated:** ${new Date(newsletter.footer.generatedAt).toLocaleString()}\n`;
  
  return markdown;
}

// LLM Configuration endpoints

// Get LLM configurations
app.get('/api/llm/config', (req, res) => {
  const sql = 'SELECT * FROM llm_config ORDER BY priority ASC, provider, model_name';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching LLM configs:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    // Don't send API keys to frontend
    const configs = rows.map(config => ({
      ...config,
      api_key: config.api_key ? '***' : null
    }));
    
    res.json(configs);
  });
});

// Add/Update LLM configuration
app.post('/api/llm/config', (req, res) => {
  const { provider, model_name, api_key, api_url, is_active, priority } = req.body;
  
  if (!provider || !model_name) {
    return res.status(400).json({ error: 'Provider and model_name are required' });
  }
  
  // Encrypt API key before storing
  const encryptedApiKey = api_key ? encryptApiKey(api_key) : null;
  
  const sql = `
    INSERT OR REPLACE INTO llm_config (provider, model_name, api_key, api_url, is_active, priority, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  
  db.run(sql, [provider, model_name, encryptedApiKey, api_url, is_active || false, priority || 1], function(err) {
    if (err) {
      console.error('Error saving LLM config:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json({ 
      id: this.lastID, 
      message: 'LLM configuration saved successfully' 
    });
  });
});

// Delete LLM configuration
app.delete('/api/llm/config/:id', (req, res) => {
  const { id } = req.params;
  
  const sql = 'DELETE FROM llm_config WHERE id = ?';
  
  db.run(sql, [id], function(err) {
    if (err) {
      console.error('Error deleting LLM config:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'LLM configuration not found' });
    }
    
    res.json({ message: 'LLM configuration deleted successfully' });
  });
});

// Check Ollama availability and get models
app.get('/api/llm/ollama/models', async (req, res) => {
  try {
    // Try multiple Ollama endpoints - Docker tries host.docker.internal first
    const ollamaUrls = [
      'http://host.docker.internal:11434/api/tags',
      'http://localhost:11434/api/tags',
      'http://127.0.0.1:11434/api/tags'
    ];
    
    let response;
    let lastError;
    
    for (const url of ollamaUrls) {
      try {
        response = await fetch(url, { timeout: 2000 });
        if (response.ok) break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    if (!response || !response.ok) {
      throw lastError || new Error('Ollama not available on any endpoint');
    }
    
    if (!response.ok) {
      throw new Error('Ollama not available');
    }
    
    const data = await response.json();
    const models = data.models.map(model => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at
    }));
    
    res.json({ 
      available: true, 
      models 
    });
  } catch (error) {
    res.json({ 
      available: false, 
      error: error.message 
    });
  }
});

// Generate LLM summary for article
app.post('/api/llm/summarize/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get the reading session
    const session = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM reading_sessions WHERE id = ?', [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Reading session not found' });
    }
    
    if (!session.url) {
      return res.status(400).json({ error: 'No URL available for summarization' });
    }
    
    // Extract article content
    const content = await LLMService.extractArticleContent(session.url);
    if (!content) {
      return res.status(400).json({ error: 'Could not extract article content' });
    }
    
    // Generate summary
    const result = await LLMService.generateSummary(session.title, session.url, content);
    if (!result) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
    
    // Update the reading session with LLM summary
    const updateSql = `
      UPDATE reading_sessions 
      SET llm_summary = ?, llm_model = ?, llm_generated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await new Promise((resolve, reject) => {
      db.run(updateSql, [result.summary, `${result.provider}:${result.model}`, sessionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({
      success: true,
      summary: result.summary,
      model: result.model,
      provider: result.provider
    });
    
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk summarize articles
app.post('/api/llm/summarize-batch', async (req, res) => {
  try {
    const { sessionIds } = req.body;
    
    if (!sessionIds || !Array.isArray(sessionIds)) {
      return res.status(400).json({ error: 'sessionIds array is required' });
    }
    
    const results = [];
    
    for (const sessionId of sessionIds) {
      try {
        // Get the reading session
        const session = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM reading_sessions WHERE id = ?', [sessionId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!session || !session.url || session.llm_summary) {
          results.push({ sessionId, status: 'skipped', reason: 'No URL or already summarized' });
          continue;
        }
        
        // Extract and summarize
        const content = await LLMService.extractArticleContent(session.url);
        if (!content) {
          results.push({ sessionId, status: 'failed', reason: 'Could not extract content' });
          continue;
        }
        
        const summary = await LLMService.generateSummary(session.title, session.url, content);
        if (!summary) {
          results.push({ sessionId, status: 'failed', reason: 'Could not generate summary' });
          continue;
        }
        
        // Update database
        const updateSql = `
          UPDATE reading_sessions 
          SET llm_summary = ?, llm_model = ?, llm_generated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        await new Promise((resolve, reject) => {
          db.run(updateSql, [summary.summary, `${summary.provider}:${summary.model}`, sessionId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.push({ 
          sessionId, 
          status: 'success', 
          summary: summary.summary,
          model: summary.model 
        });
        
      } catch (error) {
        results.push({ sessionId, status: 'error', error: error.message });
      }
    }
    
    res.json({ success: true, results });
    
  } catch (error) {
    console.error('Error in batch summarization:', error);
    res.status(500).json({ error: error.message });
  }
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