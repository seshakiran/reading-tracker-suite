// Popup script for Reading Tracker extension

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Reading Tracker popup loaded');
  
  try {
    await loadStats();
    await checkCurrentPage();
    await checkApiConnection();
    setupEventListeners();
    hideLoading();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError();
  }
});

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    
    if (response.success) {
      const stats = response.stats;
      
      document.getElementById('totalSessions').textContent = stats.totalSessions;
      document.getElementById('totalTime').textContent = formatTime(stats.totalReadingTime);
      document.getElementById('totalWords').textContent = formatNumber(stats.totalWords);
      document.getElementById('avgTime').textContent = formatTime(stats.averageReadingTime);
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    // Show placeholder stats
    document.getElementById('totalSessions').textContent = '?';
    document.getElementById('totalTime').textContent = '?';
    document.getElementById('totalWords').textContent = '?';
    document.getElementById('avgTime').textContent = '?';
  }
}

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      document.getElementById('currentPage').textContent = 'Chrome page (not tracked)';
      document.getElementById('currentPage').className = 'status-value status-inactive';
    } else if (isTrackablePage(url)) {
      document.getElementById('currentPage').textContent = 'Trackable page';
      document.getElementById('currentPage').className = 'status-value status-active';
    } else {
      document.getElementById('currentPage').textContent = 'Not an article';
      document.getElementById('currentPage').className = 'status-value status-inactive';
    }
  } catch (error) {
    console.error('Error checking current page:', error);
    document.getElementById('currentPage').textContent = 'Unknown';
  }
}

async function checkApiConnection() {
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      document.getElementById('apiStatus').textContent = 'Connected';
      document.getElementById('apiStatus').className = 'status-value status-active';
    } else {
      throw new Error('API not responding');
    }
  } catch (error) {
    console.error('API connection error:', error);
    document.getElementById('apiStatus').textContent = 'Disconnected';
    document.getElementById('apiStatus').className = 'status-value status-inactive';
  }
}

function setupEventListeners() {
  // Manual entry button
  document.getElementById('manualEntry').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });
  
  // Sync now button
  document.getElementById('syncNow').addEventListener('click', async () => {
    const button = document.getElementById('syncNow');
    const originalText = button.textContent;
    
    button.textContent = '🔄 Syncing...';
    button.disabled = true;
    
    try {
      // Trigger sync in background script
      await chrome.runtime.sendMessage({ action: 'syncNow' });
      
      // Reload stats
      await loadStats();
      
      button.textContent = '✅ Synced!';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Sync error:', error);
      button.textContent = '❌ Sync failed';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  });
}

function isTrackablePage(url) {
  const trackablePatterns = [
    'medium.com',
    'substack.com',
    'dev.to',
    'hackernews',
    'reddit.com/r/',
    'wikipedia.org',
    'github.com',
    'stackoverflow.com'
  ];
  
  return trackablePatterns.some(pattern => url.includes(pattern)) ||
         url.includes('article') ||
         url.includes('blog') ||
         url.includes('post') ||
         url.includes('news');
}

function formatTime(minutes) {
  if (!minutes || minutes === 0) return '0m';
  
  if (minutes < 60) {
    return `${minutes}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
}

function formatNumber(num) {
  if (!num || num === 0) return '0';
  
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`;
  } else {
    return `${(num / 1000000).toFixed(1)}M`;
  }
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}

function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('content').style.display = 'block';
}