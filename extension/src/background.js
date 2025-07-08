// Background service worker for Reading Tracker extension

const API_URL = 'http://localhost:3001';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveReadingSession') {
    saveReadingSession(message.session)
      .then(result => {
        console.log('Reading session saved:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Failed to save reading session:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  if (message.action === 'getStats') {
    getReadingStats()
      .then(stats => {
        sendResponse({ success: true, stats });
      })
      .catch(error => {
        console.error('Failed to get stats:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// Save reading session to API
async function saveReadingSession(session) {
  try {
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: session.title,
        url: session.url,
        content_type: session.content_type,
        reading_time: session.reading_time,
        word_count: session.word_count,
        excerpt: session.excerpt,
        notes: `Scroll progress: ${session.scroll_percentage}%`,
        tags: await categorizeContent(session)
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update badge with total sessions
    updateBadge();
    
    return result;
  } catch (error) {
    console.error('Error saving reading session:', error);
    
    // Store locally if API is unavailable
    await storeSessionLocally(session);
    throw error;
  }
}

// Get reading statistics
async function getReadingStats() {
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return await getLocalStats();
  }
}

// Store session locally if API is unavailable
async function storeSessionLocally(session) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingSessions'], (result) => {
      const sessions = result.pendingSessions || [];
      sessions.push(session);
      
      chrome.storage.local.set({ pendingSessions: sessions }, () => {
        console.log('Session stored locally for later sync');
        resolve();
      });
    });
  });
}

// Get local stats when API is unavailable
async function getLocalStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingSessions'], (result) => {
      const sessions = result.pendingSessions || [];
      const totalSessions = sessions.length;
      const totalReadingTime = sessions.reduce((sum, s) => sum + (s.reading_time || 0), 0);
      const totalWords = sessions.reduce((sum, s) => sum + (s.word_count || 0), 0);
      
      resolve({
        totalSessions,
        totalReadingTime,
        totalWords,
        averageReadingTime: totalSessions > 0 ? Math.round(totalReadingTime / totalSessions) : 0,
        readingDays: 1
      });
    });
  });
}

// Update extension badge
async function updateBadge() {
  try {
    const stats = await getReadingStats();
    const text = stats.totalSessions > 0 ? stats.totalSessions.toString() : '';
    
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Simple content categorization
async function categorizeContent(session) {
  const url = session.url.toLowerCase();
  const title = session.title.toLowerCase();
  const tags = [];
  
  // URL-based categorization
  if (url.includes('github.com') || url.includes('stackoverflow') || url.includes('dev.to')) {
    tags.push('Technology');
  } else if (url.includes('medium.com') || url.includes('substack.com')) {
    tags.push('Blog');
  } else if (url.includes('news') || url.includes('cnn') || url.includes('bbc')) {
    tags.push('News');
  } else if (url.includes('wikipedia')) {
    tags.push('Reference');
  } else if (url.includes('research') || url.includes('arxiv') || url.includes('paper')) {
    tags.push('Research');
  }
  
  // Title-based categorization
  if (title.includes('tutorial') || title.includes('guide') || title.includes('how to')) {
    tags.push('Tutorial');
  } else if (title.includes('review') || title.includes('analysis')) {
    tags.push('Review');
  }
  
  // Default tag if none found
  if (tags.length === 0) {
    tags.push('Web Reading');
  }
  
  return tags;
}

// Sync pending sessions when API becomes available
async function syncPendingSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingSessions'], async (result) => {
      const sessions = result.pendingSessions || [];
      
      if (sessions.length === 0) {
        resolve();
        return;
      }
      
      let syncedCount = 0;
      const failedSessions = [];
      
      for (const session of sessions) {
        try {
          await saveReadingSession(session);
          syncedCount++;
        } catch (error) {
          failedSessions.push(session);
        }
      }
      
      // Keep only failed sessions
      chrome.storage.local.set({ pendingSessions: failedSessions }, () => {
        console.log(`Synced ${syncedCount} sessions, ${failedSessions.length} failed`);
        resolve();
      });
    });
  });
}

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Reading Tracker extension installed');
  updateBadge();
});

// Periodic sync of pending sessions
setInterval(syncPendingSessions, 5 * 60 * 1000); // Every 5 minutes