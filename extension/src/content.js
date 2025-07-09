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
    this.extractContent();
    
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
    }
  }
  
  isArticlePage() {
    // Heuristic to determine if this is an article/reading page
    const indicators = [
      'article', 'blog', 'post', 'news', 'story', 'read',
      'medium.com', 'substack.com', 'dev.to', 'hackernews',
      'reddit.com/r/', 'wikipedia.org'
    ];
    
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    
    // Check URL patterns
    if (indicators.some(indicator => url.includes(indicator))) {
      return true;
    }
    
    // Check for article-like structure
    const articles = document.querySelectorAll('article, [role="article"], .article, .post, .content');
    if (articles.length > 0) {
      return true;
    }
    
    // Check for substantial text content
    const textContent = document.body.innerText;
    const wordCount = textContent.split(/\s+/).length;
    
    return wordCount > 300; // Assume articles have at least 300 words
  }
  
  extractContent() {
    // Extract main content and word count
    const contentSelectors = [
      'article',
      '[role="article"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
      '.main-content'
    ];
    
    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element;
        break;
      }
    }
    
    if (!mainContent) {
      mainContent = document.body;
    }
    
    const text = mainContent.innerText || mainContent.textContent || '';
    this.wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    this.mainContent = mainContent;
    
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
}

// Initialize the tracker when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ReadingTracker();
  });
} else {
  new ReadingTracker();
}