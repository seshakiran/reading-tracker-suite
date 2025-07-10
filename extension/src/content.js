// Content script for reading tracking
class ReadingTracker {
  constructor() {
    this.startTime = Date.now();
    this.isReading = false;
    this.readingTime = 0;
    this.lastActivity = Date.now();
    this.currentUrl = window.location.href;
    this.pageTitle = document.title;
    this.wordCount = 0;
    this.scrollPercentage = 0;
    this.contentAnalyzer = new UniversalContentAnalyzer();
    this.analysisResult = null;
    
    this.init();
  }
  
  async init() {
    // Smart content analysis
    console.log('Reading Tracker: Analyzing content for tracking eligibility...');
    
    // Try to extract content, with retries for dynamic content
    await this.extractContentWithRetries();
    
    // Analyze content with smart filtering
    this.analysisResult = await this.contentAnalyzer.analyzeContent(
      this.currentUrl,
      this.pageTitle,
      this.getPageContent()
    );
    
    if (this.analysisResult.shouldTrack) {
      console.log('Reading Tracker: Content approved for tracking', {
        learningScore: this.analysisResult.learningScore,
        category: this.analysisResult.category,
        reason: this.analysisResult.reason
      });
      this.setupEventListeners();
      this.startTracking();
    } else {
      console.log('Reading Tracker: Content not suitable for tracking', {
        learningScore: this.analysisResult.learningScore,
        reason: this.analysisResult.reason
      });
      
      // Show manual override notification
      this.showManualTrackingNotification();
    }
  }
  
  async extractContentWithRetries() {
    const maxRetries = 3;
    const delayMs = 1000; // 1 second between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      this.extractContent();
      
      // If we found content, we're done
      if (this.wordCount > 0) {
        console.log(`Reading Tracker: Content found on attempt ${attempt + 1}`);
        return;
      }
      
      // If this isn't the last attempt, wait and try again
      if (attempt < maxRetries - 1) {
        console.log(`Reading Tracker: No content found on attempt ${attempt + 1}, retrying in ${delayMs}ms...`);
        await this.sleep(delayMs);
      }
    }
    
    console.log('Reading Tracker: No content found after all retries');
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  isArticlePage() {
    // Heuristic to determine if this is readable content (articles, product pages, docs)
    const indicators = [
      // Traditional content
      'article', 'blog', 'post', 'news', 'story', 'read',
      'medium.com', 'substack.com', 'dev.to', 'hackernews',
      'reddit.com/r/', 'wikipedia.org',
      
      // Product/tool indicators
      'tool', 'platform', 'service', 'app', 'software', 'api',
      'features', 'overview', 'about', 'product', 'solution',
      'getting started', 'quickstart', 'guide', 'tutorial',
      
      // AI/ML specific
      'ai', 'ml', 'machine learning', 'artificial intelligence',
      'model', 'llm', 'gpt', 'neural', 'algorithm', 'dataset'
    ];
    
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.innerText.toLowerCase();
    
    // Check URL patterns and content
    if (indicators.some(indicator => 
      url.includes(indicator) || 
      title.includes(indicator) || 
      bodyText.includes(indicator)
    )) {
      return true;
    }
    
    // Check for article-like or product-like structure
    const contentElements = document.querySelectorAll(
      'article, [role="article"], .article, .post, .content, .product, .overview, .features, .hero'
    );
    if (contentElements.length > 0) {
      return true;
    }
    
    // Check for substantial text content (reduced threshold for product pages)
    const textContent = document.body.innerText;
    const wordCount = textContent.split(/\s+/).length;
    
    return wordCount > 150; // Reduced threshold for product pages
  }
  
  extractContent() {
    // Extract main content and word count
    const contentSelectors = [
      // Traditional article selectors
      'article',
      '[role="article"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
      '.main-content',
      
      // Product page selectors
      '.product-description',
      '.product-details',
      '.product-info',
      '.hero-content',
      '.description',
      '.overview',
      '.features',
      '.about',
      
      // Landing page selectors
      '.hero-section',
      '.intro-section',
      '.main-section',
      '.page-content',
      '.container',
      '.wrapper',
      
      // Documentation selectors
      '.documentation',
      '.docs-content',
      '.readme',
      '.guide',
      '.tutorial'
    ];
    
    let mainContent = null;
    let selectedSelector = 'none';
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element;
        selectedSelector = selector;
        break;
      }
    }
    
    if (!mainContent) {
      mainContent = document.body;
      selectedSelector = 'document.body (fallback)';
    }
    
    const text = mainContent.innerText || mainContent.textContent || '';
    this.wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    this.mainContent = mainContent;
    
    console.log(`Reading Tracker: Content extraction debug:`, {
      selectedSelector,
      textLength: text.length,
      wordCount: this.wordCount,
      firstFewWords: text.substring(0, 100),
      availableSelectors: contentSelectors.filter(s => document.querySelector(s)).length
    });
    
    console.log(`Reading Tracker: Detected ${this.wordCount} words`);
  }
  
  getPageContent() {
    // Get full page content for analysis
    if (this.mainContent) {
      return this.mainContent.innerText || this.mainContent.textContent || '';
    }
    return document.body.innerText || document.body.textContent || '';
  }
  
  setupEventListeners() {
    // Track user activity
    const events = ['scroll', 'mousemove', 'keydown', 'click'];
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
        if (!this.isReading) {
          this.startReading();
        }
      }, { passive: true });
    });
    
    // Track scroll progress
    document.addEventListener('scroll', () => {
      this.updateScrollProgress();
    }, { passive: true });
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseReading();
      } else {
        this.resumeReading();
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.saveReadingSession();
    });
  }
  
  startTracking() {
    // Check for inactivity every 5 seconds
    setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;
      
      // Consider user inactive after 30 seconds
      if (timeSinceActivity > 30000 && this.isReading) {
        this.pauseReading();
      }
    }, 5000);
  }
  
  startReading() {
    if (!this.isReading) {
      this.isReading = true;
      this.lastReadingStart = Date.now();
      console.log('Reading Tracker: Started reading');
    }
  }
  
  pauseReading() {
    if (this.isReading) {
      this.isReading = false;
      this.readingTime += Date.now() - this.lastReadingStart;
      console.log(`Reading Tracker: Paused reading. Total time: ${Math.round(this.readingTime / 1000)}s`);
    }
  }
  
  resumeReading() {
    if (!this.isReading && !document.hidden) {
      this.startReading();
    }
  }
  
  updateScrollProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollPercentage = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  }
  
  async saveReadingSession() {
    if (this.isReading) {
      this.pauseReading();
    }
    
    // Only save if user spent at least 10 seconds reading
    const totalSeconds = Math.round(this.readingTime / 1000);
    if (totalSeconds < 10) {
      console.log('Reading Tracker: Session too short, not saving');
      return;
    }
    
    // Include smart filtering results
    const session = {
      title: this.pageTitle,
      url: this.currentUrl,
      content_type: 'web',
      reading_time: Math.round(totalSeconds / 60), // Convert to minutes
      word_count: this.wordCount,
      excerpt: this.extractExcerpt(),
      scroll_percentage: Math.round(this.scrollPercentage),
      timestamp: new Date().toISOString(),
      learning_score: this.analysisResult?.learningScore || 0,
      category: this.analysisResult?.category || 'other',
      signals: this.analysisResult?.signals || {}
    };
    
    console.log('Reading Tracker: Saving high-quality session', {
      title: session.title,
      learningScore: session.learning_score,
      category: session.category,
      readingTime: session.reading_time
    });
    
    try {
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'saveReadingSession',
        session: session
      });
    } catch (error) {
      console.error('Reading Tracker: Error saving session', error);
    }
  }
  
  extractExcerpt(maxLength = 200) {
    // Try to find the first paragraph or substantial text
    const contentSelectors = [
      'article p:first-of-type',
      '.article-content p:first-of-type',
      '.post-content p:first-of-type',
      'p'
    ];
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.trim().length > 50) {
        let text = element.innerText.trim();
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '...';
        }
        return text;
      }
    }
    
    return '';
  }
  
  // Manual tracking notification system
  showManualTrackingNotification() {
    // Don't show on certain domains where it might be intrusive
    const skipDomains = ['google.com', 'facebook.com', 'twitter.com', 'youtube.com/watch'];
    const currentDomain = window.location.hostname.toLowerCase();
    
    if (skipDomains.some(domain => currentDomain.includes(domain))) {
      return;
    }
    
    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'reading-tracker-notification';
    notification.innerHTML = `
      <div class="rt-notification-card">
        <div class="rt-notification-header">
          <div class="rt-notification-icon">📚</div>
          <div class="rt-notification-title">Reading Tracker</div>
          <button class="rt-notification-close">×</button>
        </div>
        <div class="rt-notification-content">
          <p class="rt-notification-message">This page wasn't automatically tracked. Add it to your reading list?</p>
          <div class="rt-notification-details">
            <small>Score: ${this.analysisResult.learningScore}/100 • ${this.analysisResult.reason}</small>
          </div>
        </div>
        <div class="rt-notification-actions">
          <button class="rt-btn rt-btn-secondary" id="rt-skip-btn">
            Skip
          </button>
          <button class="rt-btn rt-btn-primary" id="rt-track-btn">
            Track Anyway
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #reading-tracker-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: rtSlideIn 0.3s ease-out;
      }
      
      .rt-notification-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05);
        border: 1px solid #e5e7eb;
        width: 320px;
        overflow: hidden;
        position: relative;
      }
      
      .rt-notification-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
        background: #f8fafc;
      }
      
      .rt-notification-icon {
        font-size: 18px;
        margin-right: 8px;
      }
      
      .rt-notification-title {
        font-weight: 600;
        color: #1f2937;
        font-size: 14px;
        flex: 1;
      }
      
      .rt-notification-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      
      .rt-notification-close:hover {
        background: #e5e7eb;
      }
      
      .rt-notification-content {
        padding: 16px;
      }
      
      .rt-notification-message {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #374151;
        line-height: 1.4;
      }
      
      .rt-notification-details {
        margin: 0;
        color: #6b7280;
        font-size: 12px;
      }
      
      .rt-notification-actions {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        background: #f8fafc;
        border-top: 1px solid #f3f4f6;
      }
      
      .rt-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .rt-btn-secondary {
        background: #f3f4f6;
        color: #6b7280;
        flex: 1;
      }
      
      .rt-btn-secondary:hover {
        background: #e5e7eb;
      }
      
      .rt-btn-primary {
        background: #3b82f6;
        color: white;
        flex: 1;
      }
      
      .rt-btn-primary:hover {
        background: #2563eb;
      }
      
      @keyframes rtSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes rtSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    
    // Add to page
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Add event listeners
    const skipBtn = notification.querySelector('#rt-skip-btn');
    const trackBtn = notification.querySelector('#rt-track-btn');
    const closeBtn = notification.querySelector('.rt-notification-close');
    
    skipBtn.addEventListener('click', () => {
      console.log('Reading Tracker: User chose to skip tracking');
      notification.remove();
    });
    
    trackBtn.addEventListener('click', () => {
      console.log('Reading Tracker: User chose to force track content');
      this.forceTrackContent();
    });
    
    closeBtn.addEventListener('click', () => {
      console.log('Reading Tracker: User closed notification');
      notification.remove();
    });
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'rtSlideOut 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, 10000);
    
    // Store reference for global access
    window.readingTracker = this;
  }
  
  // Force track content when user chooses to override
  forceTrackContent() {
    console.log('Reading Tracker: User chose to force track content');
    
    // Remove notification
    const notification = document.getElementById('reading-tracker-notification');
    if (notification) {
      notification.remove();
    }
    
    // Show success feedback
    this.showSuccessFeedback();
    
    // Start tracking
    this.setupEventListeners();
    this.startTracking();
  }
  
  // Show success feedback similar to MyMind
  showSuccessFeedback() {
    const feedback = document.createElement('div');
    feedback.innerHTML = `
      <div class="rt-notification-card">
        <div class="rt-notification-header">
          <div class="rt-notification-icon">✅</div>
          <div class="rt-notification-title">Added to Reading List</div>
        </div>
        <div class="rt-notification-content">
          <p class="rt-notification-message">This page is now being tracked for your newsletter!</p>
        </div>
      </div>
    `;
    
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rtSlideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(feedback);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      feedback.style.animation = 'rtSlideOut 0.3s ease-in';
      setTimeout(() => {
        if (feedback.parentElement) {
          feedback.remove();
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the tracker when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ReadingTracker();
  });
} else {
  new ReadingTracker();
}