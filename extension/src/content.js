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
      
      // Show floating "Add to Newsletter" button for learning content
      this.showNewsletterButton();
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
    const url = window.location.href.toLowerCase();
    
    // Special handling for LinkedIn
    if (url.includes('linkedin.com')) {
      return this.isLinkedInContent();
    }
    
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
  
  isLinkedInContent() {
    const url = window.location.href.toLowerCase();
    
    // LinkedIn article URLs
    if (url.includes('/pulse/') || url.includes('/posts/')) {
      return true;
    }
    
    // LinkedIn feed posts (when focused on a specific post)
    if (url.includes('/feed/update/') || url.includes('activity-')) {
      return true;
    }
    
    // Check if there's a substantial LinkedIn post visible
    const linkedInPost = document.querySelector('[data-urn*="urn:li:activity"], .feed-shared-update-v2, .occludable-update');
    if (linkedInPost) {
      const postText = linkedInPost.innerText || linkedInPost.textContent || '';
      const wordCount = postText.split(/\s+/).filter(word => word.length > 0).length;
      return wordCount > 50; // Minimum words for a substantial LinkedIn post
    }
    
    return false;
  }
  
  extractLinkedInContent() {
    const url = window.location.href.toLowerCase();
    let mainContent = null;
    let selectedSelector = 'none';
    
    console.log('Reading Tracker: Extracting LinkedIn content...');
    
    // LinkedIn-specific content selectors
    const linkedInSelectors = [
      // LinkedIn articles (Pulse)
      '.article-content',
      '.reader-article-content',
      '[data-module-id="article-body"]',
      
      // LinkedIn posts
      '.feed-shared-update-v2__commentary',
      '.feed-shared-text',
      '.update-components-text',
      '.feed-shared-text .break-words',
      
      // Individual post view
      '.feed-shared-update-v2',
      '[data-urn*="urn:li:activity"]',
      '.occludable-update',
      
      // Shared articles in posts
      '.feed-shared-article',
      '.feed-shared-external-article__description',
      
      // General LinkedIn content
      '.core-rail',
      '.scaffold-layout__content'
    ];
    
    // Try LinkedIn-specific selectors first
    for (const selector of linkedInSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.innerText || element.textContent || '';
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        // Find the element with the most substantial content
        if (wordCount > 20 && (!mainContent || wordCount > this.wordCount)) {
          mainContent = element;
          selectedSelector = selector;
          break;
        }
      }
      if (mainContent) break;
    }
    
    // If no specific content found, try to get the main post content
    if (!mainContent) {
      // Look for any post with substantial content
      const posts = document.querySelectorAll('[data-urn], .feed-shared-update-v2, .occludable-update');
      for (const post of posts) {
        const text = post.innerText || post.textContent || '';
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount > 50) {
          mainContent = post;
          selectedSelector = 'linkedin-post-fallback';
          break;
        }
      }
    }
    
    // Final fallback to main content area
    if (!mainContent) {
      const mainArea = document.querySelector('main, #main, .scaffold-layout__content');
      if (mainArea) {
        mainContent = mainArea;
        selectedSelector = 'linkedin-main-fallback';
      }
    }
    
    if (!mainContent) {
      mainContent = document.body;
      selectedSelector = 'document.body (fallback)';
    }
    
    // Extract and clean the text
    let text = mainContent.innerText || mainContent.textContent || '';
    
    // Clean LinkedIn-specific noise
    text = this.cleanLinkedInText(text);
    
    this.wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    this.mainContent = mainContent;
    
    console.log(`Reading Tracker: LinkedIn content extraction:`, {
      selectedSelector,
      textLength: text.length,
      wordCount: this.wordCount,
      firstFewWords: text.substring(0, 100),
      url: window.location.href
    });
    
    console.log(`Reading Tracker: Detected ${this.wordCount} words`);
  }
  
  cleanLinkedInText(text) {
    // Remove LinkedIn UI noise with enhanced cleaning
    const cleanText = text
      // Remove timestamps and metadata
      .replace(/\d+[dhms]\s*(ago|hours?|minutes?|days?|weeks?|months?)/gi, '')
      .replace(/\d+[,\d]*\s*(likes?|comments?|shares?|reactions?|views?|readers?|connections?)/gi, '')
      
      // Remove LinkedIn-specific UI metrics and elements
      .replace(/Profile viewers?\s*\d+[,\d]*/gi, '')
      .replace(/Post impressions?\s*\d+[,\d]*/gi, '')
      .replace(/\d+[,\d]*\s*readers?/gi, '')
      .replace(/\d+[,\d]*\s*connections?\s*played/gi, '')
      
      // Remove action buttons text
      .replace(/\b(like|comment|share|send|follow|connect|repost|celebrate|save|unsave)\b/gi, '')
      
      // Remove LinkedIn navigation and UI elements
      .replace(/\b(home|my network|jobs|messaging|notifications|premium|try premium)\b/gi, '')
      .replace(/\b(your premium features|stand out to prospective clients|advertise on linkedin)\b/gi, '')
      .replace(/\b(saved items|groups|newsletters|events|write article|visit my website)\b/gi, '')
      .replace(/\b(about|accessibility|help center|ad choices|advertising)\b/gi, '')
      
      // Remove specific LinkedIn promotional text
      .replace(/Try Premium Page for \$0/gi, '')
      .replace(/Learn more:/gi, '')
      .replace(/Solve in 60s or less!/gi, '')
      
      // Remove profile actions
      .replace(/\b(see more|see less|show more|show less|…see more|load more)\b/gi, '')
      
      // Remove engagement prompts
      .replace(/\b(what do you think|thoughts\?|agree\?|disagree\?)\b/gi, '')
      
      // Remove LinkedIn-specific elements
      .replace(/\b(promoted|sponsored|linkedin member|connection|1st|2nd|3rd)\b/gi, '')
      
      // Remove news article patterns
      .replace(/[A-Z][a-z\s]+(steps down as CEO|facing \d+% tariff|brings \$\d+[BM] payday|bets on|demand meeting|close to \$\d+[BM] sale|gets \$\d+[BM]|hits record high|loses [A-Z]+ giant|powers [A-Z]+ to record)/gi, '')
      
      // Remove time indicators for news
      .replace(/\d+h ago\s*/gi, '')
      
      // Remove game prompts
      .replace(/Zip - a quick brain teaser/gi, '')
      
      // Remove hashtag-only lines
      .replace(/^#\w+\s*$/gm, '')
      
      // Remove excessive hashtags at the end
      .replace(/(#\w+\s*){3,}$/g, '')
      
      // Remove URL fragments that get picked up
      .replace(/https?:\/\/[^\s]+/g, '')
      
      // Clean multiple spaces, tabs, and newlines
      .replace(/[\s\t\r\n]+/g, ' ')
      
      // Remove leading/trailing whitespace and punctuation
      .replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, '')
      .trim();
    
    return cleanText;
  }
  
  extractContent() {
    const url = window.location.href.toLowerCase();
    
    // Special LinkedIn content extraction
    if (url.includes('linkedin.com')) {
      return this.extractLinkedInContent();
    }
    
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
    
    // LinkedIn-specific event listeners
    if (window.location.href.toLowerCase().includes('linkedin.com')) {
      this.setupLinkedInEventListeners();
    }
  }
  
  setupLinkedInEventListeners() {
    console.log('Reading Tracker: Setting up LinkedIn manual newsletter curation...');
    
    // Inject "Add to Newsletter" buttons into visible posts
    this.injectNewsletterButtons();
    
    // Listen for post interactions and new content loading
    document.addEventListener('click', (event) => {
      const target = event.target;
      console.log('Reading Tracker: Click detected on:', target, target.className);
      
      // Check if our custom "Add to Newsletter" button was clicked
      if (target.classList.contains('rt-add-to-newsletter-btn') || 
          target.closest('.rt-add-to-newsletter-btn')) {
        console.log('Reading Tracker: Manual newsletter addition requested');
        event.preventDefault();
        event.stopPropagation();
        
        const button = target.classList.contains('rt-add-to-newsletter-btn') ? 
                      target : target.closest('.rt-add-to-newsletter-btn');
        this.handleManualNewsletterAdd(button);
        return;
      }
    }, true);
    
    // Listen for URL changes and new content (LinkedIn is a SPA)
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('Reading Tracker: LinkedIn URL changed', { from: lastUrl, to: currentUrl });
        lastUrl = currentUrl;
        
        // Re-inject buttons when content changes
        setTimeout(() => {
          this.injectNewsletterButtons();
        }, 1000); // Wait for content to load
      }
    };
    
    // Check for URL changes and new posts every 2 seconds
    setInterval(() => {
      checkUrlChange();
      this.injectNewsletterButtons(); // Continuously inject for new posts
    }, 2000);
  }
  
  injectNewsletterButtons() {
    // Find all LinkedIn posts that don't already have our button
    const postSelectors = [
      '[data-urn*="urn:li:activity"].feed-shared-update-v2',
      '[data-urn*="urn:li:activity"].occludable-update',
      '.feed-shared-update-v2[data-urn]',
      '.occludable-update[data-urn]'
    ];
    
    let postsProcessed = 0;
    
    for (const selector of postSelectors) {
      const posts = document.querySelectorAll(selector);
      for (const post of posts) {
        // Skip if already has our button
        if (post.querySelector('.rt-add-to-newsletter-btn')) {
          continue;
        }
        
        // Find the post actions area (like, comment, share buttons)
        const actionsArea = post.querySelector('.feed-shared-social-action-bar, .social-actions-buttons, .feed-shared-social-actions');
        
        if (actionsArea) {
          this.addNewsletterButton(post, actionsArea);
          postsProcessed++;
        }
      }
    }
    
    if (postsProcessed > 0) {
      console.log(`Reading Tracker: Injected newsletter buttons into ${postsProcessed} LinkedIn posts`);
    }
  }
  
  addNewsletterButton(postContainer, actionsArea) {
    console.log('Reading Tracker: Adding newsletter button to post:', postContainer);
    
    // Create the "Add to Newsletter" button
    const button = document.createElement('button');
    button.className = 'rt-add-to-newsletter-btn';
    button.type = 'button'; // Prevent form submission
    button.innerHTML = `
      <span class="rt-newsletter-icon">📰</span>
      <span class="rt-newsletter-text">Add to Newsletter</span>
    `;
    
    // Style the button to match LinkedIn's design
    button.style.cssText = `
      display: inline-flex !important;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid #0a66c2;
      border-radius: 16px;
      color: #0a66c2;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-left: 8px;
      height: 32px;
      position: relative;
      z-index: 1000;
    `;
    
    // Store reference to the post container
    button.setAttribute('data-post-container', 'true');
    button.postContainer = postContainer;
    
    // Add direct click handler as backup
    button.addEventListener('click', (e) => {
      console.log('Reading Tracker: Direct button click handler triggered');
      e.preventDefault();
      e.stopPropagation();
      this.handleManualNewsletterAdd(button);
    });
    
    // Add hover effects
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = '#0a66c2';
        button.style.color = 'white';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.background = 'transparent';
        button.style.color = '#0a66c2';
      }
    });
    
    // Insert the button into the actions area
    try {
      actionsArea.appendChild(button);
      console.log('Reading Tracker: Newsletter button successfully added');
    } catch (error) {
      console.error('Reading Tracker: Error adding button:', error);
    }
  }
  
  async handleManualNewsletterAdd(button) {
    console.log('Reading Tracker: handleManualNewsletterAdd called with button:', button);
    
    // Handle manual addition to newsletter
    const postContainer = button.postContainer;
    
    if (!postContainer) {
      console.error('Reading Tracker: Could not find post container for newsletter addition');
      this.showNotification('Error: Could not find post content', 'error');
      return;
    }
    
    console.log('Reading Tracker: Found post container:', postContainer);
    
    // Update button immediately to show it's processing
    button.innerHTML = `
      <span class="rt-newsletter-icon">⏳</span>
      <span class="rt-newsletter-text">Adding...</span>
    `;
    button.disabled = true;
    
    try {
      // Extract post content
      const postContent = this.extractPostContent(postContainer);
      console.log('Reading Tracker: Extracted content:', postContent);
      
      if (postContent.wordCount < 10) {
        console.log('Reading Tracker: Post too short for newsletter');
        this.showNotification('Post too short for newsletter', 'error');
        
        // Reset button
        button.innerHTML = `
          <span class="rt-newsletter-icon">📰</span>
          <span class="rt-newsletter-text">Add to Newsletter</span>
        `;
        button.disabled = false;
        return;
      }
      
      // Save as newsletter item with special flag
      const success = await this.saveLinkedInNewsletterItem(postContent);
      
      if (success) {
        // Update button state to success
        button.innerHTML = `
          <span class="rt-newsletter-icon">✅</span>
          <span class="rt-newsletter-text">Added!</span>
        `;
        button.style.background = '#057642';
        button.style.color = 'white';
        button.style.borderColor = '#057642';
        
        // Show success notification
        this.showNotification('Added to newsletter queue!', 'success');
      } else {
        // Handle error
        this.showNotification('Failed to add to newsletter', 'error');
        
        // Reset button
        button.innerHTML = `
          <span class="rt-newsletter-icon">📰</span>
          <span class="rt-newsletter-text">Add to Newsletter</span>
        `;
        button.disabled = false;
        button.style.background = 'transparent';
        button.style.color = '#0a66c2';
        button.style.borderColor = '#0a66c2';
      }
    } catch (error) {
      console.error('Reading Tracker: Error in handleManualNewsletterAdd:', error);
      this.showNotification('Error adding to newsletter', 'error');
      
      // Reset button
      button.innerHTML = `
        <span class="rt-newsletter-icon">📰</span>
        <span class="rt-newsletter-text">Add to Newsletter</span>
      `;
      button.disabled = false;
      button.style.background = 'transparent';
      button.style.color = '#0a66c2';
      button.style.borderColor = '#0a66c2';
    }
  }
  
  async saveLinkedInNewsletterItem(postContent) {
    // Save LinkedIn post specifically for newsletter curation
    try {
      const session = {
        title: postContent.title,
        url: postContent.url,
        content_type: 'linkedin_newsletter', // Special type for newsletter items
        reading_time: 2, // Default reading time
        word_count: postContent.wordCount,
        excerpt: postContent.content, // Store full content
        notes: `Newsletter Curation - ${postContent.author}${postContent.links && postContent.links.length > 0 ? '\n\nLinks:\n' + postContent.links.map(link => `• ${link.text}: ${link.url}`).join('\n') : ''}`,
        learning_score: 75, // Higher score for manually curated content
        category: 'linkedin_newsletter', // Special category for newsletter queue
        timestamp: new Date().toISOString()
      };
      
      console.log('Reading Tracker: Saving LinkedIn newsletter item', session);
      
      const response = await fetch('http://localhost:3001/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(session),
      });
      
      if (response.ok) {
        console.log('Reading Tracker: LinkedIn newsletter item saved successfully');
        return true;
      } else {
        console.error('Reading Tracker: Failed to save LinkedIn newsletter item');
        return false;
      }
    } catch (error) {
      console.error('Reading Tracker: Error saving LinkedIn newsletter item:', error);
      return false;
    }
  }
  
  showNotification(message, type = 'success') {
    // Show a brief notification message
    const notification = document.createElement('div');
    notification.className = 'rt-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? '#057642' : '#dc2626'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: rtSlideIn 0.3s ease-out;
        max-width: 300px;
      ">
        ${type === 'success' ? '✅' : '❌'} ${message}
      </div>
      <style>
        @keyframes rtSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes rtSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'rtSlideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }
  
  // Old automatic tracking methods removed - now using manual curation only
  
  findLinkedInPostContainer(clickedElement) {
    // Find the actual LinkedIn post container from any clicked element within it
    console.log('Reading Tracker: Finding post container from clicked element:', clickedElement);
    
    let current = clickedElement;
    
    // First, try to find the most specific post container by going up the DOM tree
    for (let i = 0; i < 20 && current; i++) {
      const className = current.className?.toLowerCase() || '';
      
      // Look for specific post container classes (most specific first)
      if (current.hasAttribute('data-urn') && 
          (className.includes('feed-shared-update-v2') || className.includes('occludable-update'))) {
        console.log(`Reading Tracker: Found specific post container via DOM traversal (${i} levels up):`, current);
        
        // Validate this is actually a post container, not a larger feed container
        const postText = current.querySelector('.feed-shared-update-v2__commentary, .feed-shared-text, .update-components-text');
        if (postText) {
          return current;
        }
      }
      
      current = current.parentElement;
    }
    
    // If DOM traversal didn't work, try to find the closest post that contains our clicked element
    const postSelectors = [
      '[data-urn*="urn:li:activity"].feed-shared-update-v2',
      '[data-urn*="urn:li:activity"].occludable-update',
      '.feed-shared-update-v2[data-urn]',
      '.occludable-update[data-urn]'
    ];
    
    let closestPost = null;
    let closestDistance = Infinity;
    
    for (const selector of postSelectors) {
      const posts = document.querySelectorAll(selector);
      for (const post of posts) {
        // Check if the clicked element is within this post
        if (post.contains(clickedElement)) {
          // Find the closest post (smallest container)
          const rect = post.getBoundingClientRect();
          const size = rect.width * rect.height;
          
          if (size < closestDistance) {
            closestDistance = size;
            closestPost = post;
          }
        }
      }
    }
    
    if (closestPost) {
      console.log('Reading Tracker: Found closest post container:', closestPost);
      return closestPost;
    }
    
    console.log('Reading Tracker: Could not find specific post container');
    return null;
  }
  
  // Automatic tracking methods removed - using manual button-based curation
  
  extractPostContent(postContainer) {
    console.log('Reading Tracker: Extracting post content from container:', postContainer);
    
    // Extract content from a specific LinkedIn post with focused selectors
    const contentSelectors = [
      // Most specific first - actual post text only
      '.feed-shared-update-v2__commentary .break-words span[dir="ltr"]',
      '.feed-shared-update-v2__commentary .break-words',
      '.feed-shared-text .break-words span[dir="ltr"]',
      '.feed-shared-text .break-words',
      '.update-components-text .break-words span[dir="ltr"]',
      '.update-components-text .break-words',
      
      // Secondary - commentary areas
      '.feed-shared-update-v2__commentary',
      '.feed-shared-text', 
      '.update-components-text',
      
      // Article descriptions for shared content
      '.feed-shared-article__description .break-words',
      '.feed-shared-external-article__description .break-words',
      '.feed-shared-article__description',
      '.feed-shared-external-article__description'
    ];
    
    let bestContent = '';
    let bestWordCount = 0;
    let bestSelector = '';
    
    // Try each selector and log what we find
    for (const selector of contentSelectors) {
      const elements = postContainer.querySelectorAll(selector);
      
      for (const element of elements) {
        const text = element.innerText || element.textContent || '';
        const cleanText = this.cleanLinkedInText(text);
        const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
        
        console.log(`Reading Tracker: Selector "${selector}" found ${wordCount} words:`, cleanText.substring(0, 100));
        
        if (wordCount > bestWordCount) {
          bestContent = cleanText;
          bestWordCount = wordCount;
          bestSelector = selector;
        }
      }
      
      // If we found good content, break early
      if (bestWordCount > 50) break;
    }
    
    // Enhanced fallback: try to get text from specific content areas only
    if (bestWordCount < 20) {
      console.log('Reading Tracker: Using enhanced fallback for text extraction');
      
      // Only look in specific content areas, avoid the entire container
      const specificContentSelectors = [
        '.feed-shared-update-v2__commentary',
        '.feed-shared-text',
        '.update-components-text'
      ];
      
      let combinedText = '';
      for (const selector of specificContentSelectors) {
        const element = postContainer.querySelector(selector); // Use querySelector, not querySelectorAll
        if (element) {
          const text = element.innerText || element.textContent || '';
          if (text.trim()) {
            // Only add if it's not already included and is substantial
            const trimmedText = text.trim();
            if (trimmedText.length > 50 && !combinedText.includes(trimmedText)) {
              combinedText += ' ' + trimmedText;
            }
          }
        }
      }
      
      if (combinedText.trim()) {
        const cleanText = this.cleanLinkedInText(combinedText);
        const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
        
        if (wordCount > bestWordCount && wordCount > 10) {
          bestContent = cleanText;
          bestWordCount = wordCount;
          bestSelector = 'specific-content-fallback';
        }
      }
    }
    
    // Skip final fallback to avoid capturing entire feed
    if (bestWordCount < 10) {
      console.log('Reading Tracker: Could not extract sufficient content from post - skipping to avoid feed contamination');
    }
    
    // Get post author and title if available
    const authorSelectors = [
      '.feed-shared-actor__name .visually-hidden',
      '.feed-shared-actor__name',
      '.update-components-actor__name',
      '.feed-shared-actor__title',
      '[data-test-id="main-feed-activity-card__actor"]'
    ];
    
    let author = 'LinkedIn User';
    for (const selector of authorSelectors) {
      const authorElement = postContainer.querySelector(selector);
      if (authorElement && authorElement.textContent.trim()) {
        author = authorElement.textContent.trim();
        break;
      }
    }
    
    // Extract specific LinkedIn post URL instead of feed URL
    const postUrl = this.extractLinkedInPostUrl(postContainer);
    
    // Extract links from the post content
    const links = this.extractLinksFromPost(postContainer);
    
    const title = bestContent.length > 50 
      ? bestContent.substring(0, 50) + '...' 
      : bestContent || 'LinkedIn Post';
    
    const result = {
      title: `${author}: ${title}`,
      content: bestContent,
      wordCount: bestWordCount,
      url: postUrl || window.location.href,
      author,
      selector: bestSelector,
      links: links
    };
    
    console.log('Reading Tracker: Final extracted content:', result);
    return result;
  }
  
  extractLinkedInPostUrl(postContainer) {
    // Try to extract the specific LinkedIn post URL
    console.log('Reading Tracker: Extracting LinkedIn post URL...');
    
    // Look for direct links to the post
    const linkSelectors = [
      'a[href*="/posts/"]',
      'a[href*="/feed/update/"]',
      'a[href*="activity-"]',
      'a[href*="/pulse/"]',
      '[data-urn] a[href*="linkedin.com"]'
    ];
    
    for (const selector of linkSelectors) {
      const linkElement = postContainer.querySelector(selector);
      if (linkElement && linkElement.href) {
        console.log(`Reading Tracker: Found post URL via ${selector}:`, linkElement.href);
        return linkElement.href;
      }
    }
    
    // Try to extract from data attributes
    const dataUrnElement = postContainer.querySelector('[data-urn]');
    if (dataUrnElement) {
      const urn = dataUrnElement.getAttribute('data-urn');
      if (urn && urn.includes('activity:')) {
        // Extract activity ID from URN like "urn:li:activity:1234567890"
        const activityId = urn.split('activity:')[1];
        if (activityId) {
          const postUrl = `https://www.linkedin.com/posts/activity-${activityId}`;
          console.log('Reading Tracker: Constructed post URL from URN:', postUrl);
          return postUrl;
        }
      }
    }
    
    // Try to find post permalink in the menu options
    const menuButtons = postContainer.querySelectorAll('button[aria-label*="menu"], button[aria-label*="options"]');
    for (const button of menuButtons) {
      // Look for nearby elements that might contain the post URL
      const parent = button.closest('[data-urn]');
      if (parent) {
        const links = parent.querySelectorAll('a[href*="posts"], a[href*="activity"]');
        for (const link of links) {
          if (link.href && link.href.includes('linkedin.com')) {
            console.log('Reading Tracker: Found post URL via menu context:', link.href);
            return link.href;
          }
        }
      }
    }
    
    // Check current URL if it's a specific post
    const currentUrl = window.location.href;
    if (currentUrl.includes('/posts/') || currentUrl.includes('/feed/update/') || currentUrl.includes('activity-')) {
      console.log('Reading Tracker: Using current URL as post URL:', currentUrl);
      return currentUrl;
    }
    
    console.log('Reading Tracker: Could not extract specific post URL, using current page URL');
    return null; // Will fall back to window.location.href
  }
  
  extractLinksFromPost(postContainer) {
    // Extract only links from within the actual post content
    console.log('Reading Tracker: Extracting links from post content only...');
    
    const links = [];
    
    // Focus on the actual post content areas only
    const contentAreas = [
      '.feed-shared-update-v2__commentary',
      '.feed-shared-text',
      '.update-components-text', 
      '.feed-shared-article__description',
      '.feed-shared-external-article__description'
    ];
    
    for (const contentAreaSelector of contentAreas) {
      const contentArea = postContainer.querySelector(contentAreaSelector);
      if (!contentArea) continue;
      
      const linkElements = contentArea.querySelectorAll('a[href]');
      for (const linkElement of linkElements) {
        const href = linkElement.href;
        const text = linkElement.textContent || linkElement.innerText || '';
        
        // Skip LinkedIn internal links, navigation, and UI elements
        if (href && 
            !href.includes('linkedin.com/in/') && 
            !href.includes('linkedin.com/company/') &&
            !href.includes('linkedin.com/feed/') &&
            !href.includes('linkedin.com/search/') &&
            !href.includes('linkedin.com/me/') &&
            !href.includes('linkedin.com/premium/') &&
            !href.includes('linkedin.com/analytics/') &&
            !href.includes('linkedin.com/campaignmanager/') &&
            !href.includes('linkedin.com/my-items/') &&
            !href.includes('linkedin.com/groups') &&
            !href.includes('linkedin.com/mynetwork/') &&
            !href.includes('linkedin.com/events') &&
            !href.includes('linkedin.com/article/new/') &&
            !href.includes('linkedin.com/help/') &&
            !href.includes('linkedin.com/news/') &&
            !href.includes('linkedin.com/games/') &&
            !href.includes('about.linkedin.com') &&
            !href.includes('linkedin.com/accessibility') &&
            !href.includes('linkedin.com/ad/') &&
            text.trim() &&
            text.trim().length > 5 && // Longer text requirement
            !text.toLowerCase().includes('profile viewers') &&
            !text.toLowerCase().includes('post impressions') &&
            !text.toLowerCase().includes('premium') &&
            !text.toLowerCase().includes('advertise') &&
            !text.toLowerCase().includes('readers')) {
          
          // Clean the text
          const cleanText = text.trim().replace(/\s+/g, ' ');
          
          // Additional validation - must be meaningful link text
          if (cleanText.length > 10 && !links.find(link => link.url === href)) {
            links.push({
              url: href,
              text: cleanText,
              type: href.includes('linkedin.com') ? 'linkedin' : 'external'
            });
          }
        }
      }
    }
    
    console.log(`Reading Tracker: Found ${links.length} meaningful links in post content:`, links);
    return links;
  }
  
  // Old automatic tracking methods removed - replaced with manual newsletter curation
  
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
  
  // Universal "Add to Newsletter" floating button for learning content
  showNewsletterButton() {
    // Skip if button already exists
    if (document.getElementById('rt-newsletter-float')) {
      return;
    }
    
    console.log('Reading Tracker: Showing newsletter button for learning content');
    
    // Create floating button container
    const floatingButton = document.createElement('div');
    floatingButton.id = 'rt-newsletter-float';
    floatingButton.innerHTML = `
      <div class="rt-newsletter-float-container">
        <div class="rt-newsletter-float-button" id="rt-newsletter-btn">
          <div class="rt-newsletter-icon">📰</div>
          <div class="rt-newsletter-text">Add to Newsletter</div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.id = 'rt-newsletter-styles';
    style.textContent = `
      #rt-newsletter-float {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: none;
      }
      
      .rt-newsletter-float-container {
        pointer-events: auto;
      }
      
      .rt-newsletter-float-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #2563eb;
        color: white;
        border-radius: 25px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        border: none;
        font-size: 14px;
        font-weight: 500;
        user-select: none;
        animation: rtSlideIn 0.3s ease-out;
        min-width: 160px;
        justify-content: center;
      }
      
      .rt-newsletter-float-button:hover {
        background: #1d4ed8;
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(37, 99, 235, 0.4);
      }
      
      .rt-newsletter-float-button.rt-processing {
        background: #f59e0b;
        cursor: not-allowed;
        transform: none;
      }
      
      .rt-newsletter-float-button.rt-success {
        background: #10b981;
        cursor: default;
        transform: none;
      }
      
      .rt-newsletter-icon {
        font-size: 16px;
        line-height: 1;
      }
      
      .rt-newsletter-text {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
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
    document.body.appendChild(floatingButton);
    
    // Add event listeners
    const btn = document.getElementById('rt-newsletter-btn');
    
    btn.addEventListener('click', () => {
      console.log('Reading Tracker: Newsletter button clicked - adding directly to newsletter');
      this.addToNewsletter();
    });
    
    // Auto-hide after 30 seconds if no interaction
    setTimeout(() => {
      if (document.getElementById('rt-newsletter-float')) {
        this.hideNewsletterButton();
      }
    }, 30000);
  }
  
  hideNewsletterButton() {
    const button = document.getElementById('rt-newsletter-float');
    const styles = document.getElementById('rt-newsletter-styles');
    
    if (button) {
      button.style.animation = 'rtSlideOut 0.3s ease-in';
      setTimeout(() => {
        if (button.parentElement) {
          button.remove();
        }
      }, 300);
    }
    
    if (styles) {
      styles.remove();
    }
  }
  
  async addToNewsletter() {
    console.log('Reading Tracker: Adding article to newsletter queue');
    
    const btn = document.getElementById('rt-newsletter-btn');
    
    // Show processing state
    btn.classList.add('rt-processing');
    btn.innerHTML = `
      <div class="rt-newsletter-icon">⏳</div>
      <div class="rt-newsletter-text">Adding...</div>
    `;
    
    try {
      // Extract article content
      const articleContent = this.extractArticleContent();
      
      // Add to newsletter queue
      const response = await fetch('http://localhost:3001/api/newsletter/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: articleContent.title,
          url: articleContent.url,
          content_type: 'web',
          reading_time: Math.max(1, Math.round(articleContent.wordCount / 200)), // Estimate reading time
          word_count: articleContent.wordCount,
          excerpt: articleContent.excerpt,
          learning_score: this.analysisResult.learningScore,
          notes: `Added via newsletter button - ${this.analysisResult.category} content`
        }),
      });
      
      if (response.ok) {
        // Show success state
        btn.classList.remove('rt-processing');
        btn.classList.add('rt-success');
        btn.innerHTML = `
          <div class="rt-newsletter-icon">✅</div>
          <div class="rt-newsletter-text">Added!</div>
        `;
        
        // Hide after 3 seconds
        setTimeout(() => {
          this.hideNewsletterButton();
        }, 3000);
        
        console.log('Reading Tracker: Article successfully added to newsletter queue');
      } else {
        throw new Error('Failed to add to newsletter queue');
      }
    } catch (error) {
      console.error('Reading Tracker: Error adding to newsletter:', error);
      
      // Show error state
      btn.classList.remove('rt-processing');
      btn.innerHTML = `
        <div class="rt-newsletter-icon">❌</div>
        <div class="rt-newsletter-text">Error</div>
      `;
      
      // Hide after 3 seconds
      setTimeout(() => {
        this.hideNewsletterButton();
      }, 3000);
    }
  }
  
  extractArticleContent() {
    // Extract clean article content for newsletter
    const title = document.title || 'Untitled Article';
    const url = window.location.href;
    
    // Try to extract a good excerpt
    let excerpt = '';
    
    // Try meta description first
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && metaDescription.content.trim()) {
      excerpt = metaDescription.content.trim();
    }
    
    // Fallback to first paragraph
    if (!excerpt) {
      const firstParagraph = document.querySelector('article p, .article-content p, .post-content p, .content p, main p, p');
      if (firstParagraph && firstParagraph.textContent.trim().length > 50) {
        excerpt = firstParagraph.textContent.trim();
      }
    }
    
    // Fallback to beginning of main content
    if (!excerpt && this.mainContent) {
      const text = this.mainContent.textContent || this.mainContent.innerText || '';
      if (text.length > 100) {
        excerpt = text.substring(0, 200).trim() + '...';
      }
    }
    
    // Clean up excerpt
    if (excerpt && excerpt.length > 300) {
      excerpt = excerpt.substring(0, 300).trim() + '...';
    }
    
    return {
      title,
      url,
      excerpt: excerpt || `Learning content from ${window.location.hostname}`,
      wordCount: this.wordCount || 0
    };
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