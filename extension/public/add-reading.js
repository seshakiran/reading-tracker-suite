// Add Reading Session script for extension popup

let selectedTags = [];
let availableTags = [];

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Add Reading form loaded');
  
  await loadTags();
  setupEventListeners();
  prefillCurrentPage();
});

async function loadTags() {
  try {
    const response = await fetch('http://localhost:3001/api/tags');
    if (response.ok) {
      availableTags = await response.json();
      renderTags();
    } else {
      console.warn('Could not load tags from API');
      // Use default tags
      availableTags = [
        { id: 1, name: 'Technology', color: '#3B82F6' },
        { id: 2, name: 'Business', color: '#10B981' },
        { id: 3, name: 'Personal', color: '#F59E0B' },
        { id: 4, name: 'Research', color: '#8B5CF6' },
        { id: 5, name: 'News', color: '#EF4444' }
      ];
      renderTags();
    }
  } catch (error) {
    console.error('Error loading tags:', error);
    // Fallback to default tags
    availableTags = [
      { id: 1, name: 'Technology', color: '#3B82F6' },
      { id: 2, name: 'Business', color: '#10B981' },
      { id: 3, name: 'Personal', color: '#F59E0B' },
      { id: 4, name: 'Research', color: '#8B5CF6' },
      { id: 5, name: 'News', color: '#EF4444' }
    ];
    renderTags();
  }
}

function renderTags() {
  const container = document.getElementById('tagsContainer');
  container.innerHTML = '';
  
  availableTags.forEach(tag => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-button';
    button.textContent = tag.name;
    button.dataset.tagName = tag.name;
    
    button.addEventListener('click', () => {
      toggleTag(tag.name, button);
    });
    
    container.appendChild(button);
  });
}

function toggleTag(tagName, button) {
  const index = selectedTags.indexOf(tagName);
  
  if (index > -1) {
    // Remove tag
    selectedTags.splice(index, 1);
    button.classList.remove('selected');
  } else {
    // Add tag
    selectedTags.push(tagName);
    button.classList.add('selected');
  }
}

async function prefillCurrentPage() {
  try {
    // Get current tab information
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      document.getElementById('title').value = tab.title || '';
      document.getElementById('url').value = tab.url;
      
      // Auto-select web content type if it's a web page
      if (tab.url.startsWith('http')) {
        document.getElementById('contentType').value = 'web';
      }
      
      // Auto-categorize based on URL
      const autoTags = categorizeUrl(tab.url);
      autoTags.forEach(tagName => {
        const button = document.querySelector(`[data-tag-name="${tagName}"]`);
        if (button) {
          toggleTag(tagName, button);
        }
      });
    }
  } catch (error) {
    console.error('Error prefilling current page:', error);
  }
}

function categorizeUrl(url) {
  const tags = [];
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('github.com') || urlLower.includes('stackoverflow') || urlLower.includes('dev.to')) {
    tags.push('Technology');
  } else if (urlLower.includes('medium.com') || urlLower.includes('substack.com')) {
    tags.push('Personal');
  } else if (urlLower.includes('news') || urlLower.includes('cnn') || urlLower.includes('bbc')) {
    tags.push('News');
  } else if (urlLower.includes('research') || urlLower.includes('arxiv') || urlLower.includes('paper')) {
    tags.push('Research');
  } else if (urlLower.includes('business') || urlLower.includes('forbes') || urlLower.includes('bloomberg')) {
    tags.push('Business');
  }
  
  return tags;
}

function setupEventListeners() {
  // Form submission
  document.getElementById('readingForm').addEventListener('submit', handleSubmit);
  
  // Cancel button
  document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('title').value.trim();
  if (!title) {
    showMessage('Title is required', 'error');
    return;
  }
  
  // Show loading state
  const saveBtn = document.getElementById('saveBtn');
  const saveText = document.getElementById('saveText');
  const saveLoading = document.getElementById('saveLoading');
  
  saveBtn.disabled = true;
  saveText.style.display = 'none';
  saveLoading.style.display = 'inline-block';
  
  try {
    const sessionData = {
      title: title,
      url: document.getElementById('url').value.trim() || null,
      content_type: document.getElementById('contentType').value,
      reading_time: parseInt(document.getElementById('readingTime').value) || 0,
      word_count: parseInt(document.getElementById('wordCount').value) || 0,
      excerpt: document.getElementById('excerpt').value.trim() || null,
      notes: document.getElementById('notes').value.trim() || null,
      tags: selectedTags
    };
    
    // Send to background script to save
    const response = await chrome.runtime.sendMessage({
      action: 'saveReadingSession',
      session: sessionData
    });
    
    if (response.success) {
      showMessage('Reading session saved successfully!', 'success');
      
      // Reset form after a delay
      setTimeout(() => {
        resetForm();
        window.close();
      }, 1500);
    } else {
      throw new Error(response.error || 'Failed to save session');
    }
  } catch (error) {
    console.error('Error saving session:', error);
    showMessage('Failed to save session: ' + error.message, 'error');
  } finally {
    // Reset loading state
    saveBtn.disabled = false;
    saveText.style.display = 'inline';
    saveLoading.style.display = 'none';
  }
}

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = type;
  messageEl.style.display = 'block';
  
  // Hide after 3 seconds for errors, 1.5 seconds for success
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, type === 'error' ? 3000 : 1500);
}

function resetForm() {
  document.getElementById('readingForm').reset();
  selectedTags = [];
  
  // Unselect all tag buttons
  document.querySelectorAll('.tag-button.selected').forEach(button => {
    button.classList.remove('selected');
  });
}