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
      .replace(/\d+[,\d]*\s*(likes?|comments?|shares?|reactions?|views?)/gi, '')
      // Remove action buttons text
      .replace(/\b(like|comment|share|send|follow|connect|repost|celebrate)\b/gi, '')
      // Remove LinkedIn navigation and UI elements
      .replace(/\b(home|my network|jobs|messaging|notifications|premium|try premium)\b/gi, '')
      // Remove profile actions
      .replace(/\b(see more|see less|show more|show less|…see more|load more)\b/gi, '')
      // Remove engagement prompts
      .replace(/\b(what do you think|thoughts\?|agree\?|disagree\?)\b/gi, '')
      // Remove LinkedIn-specific elements
      .replace(/\b(promoted|sponsored|linkedin member|connection|1st|2nd|3rd)\b/gi, '')
      // Remove hashtag-only lines
      .replace(/^#\w+\s*$/gm, '')
      // Remove excessive hashtags at the end
      .replace(/(#\w+\s*){3,}$/g, '')
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
    console.log('Reading Tracker: Setting up LinkedIn-specific listeners...');
    
    // Listen for save button clicks
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if save button was clicked
      if (this.isSaveButton(target)) {
        console.log('Reading Tracker: LinkedIn save detected');
        this.handleLinkedInSave(target);
      }
      
      // Check if post was clicked for detailed view
      if (this.isPostClick(target)) {
        console.log('Reading Tracker: LinkedIn post click detected');
        this.handleLinkedInPostClick(target);
      }
    }, true);
    
    // Listen for URL changes (LinkedIn is a SPA)
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('Reading Tracker: LinkedIn URL changed', { from: lastUrl, to: currentUrl });
        lastUrl = currentUrl;
        
        // Re-analyze content when URL changes
        setTimeout(() => {
          this.handleLinkedInNavigation();
        }, 1000); // Wait for content to load
      }
    };
    
    // Check for URL changes every 500ms (LinkedIn navigation)
    setInterval(checkUrlChange, 500);
  }
  
  isSaveButton(element) {
    // Check if the clicked element or its parents contain save indicators
    let current = element;
    for (let i = 0; i < 5 && current; i++) {
      const text = current.textContent?.toLowerCase() || '';
      const ariaLabel = current.getAttribute('aria-label')?.toLowerCase() || '';
      const className = current.className?.toLowerCase() || '';
      
      if (text.includes('save') || 
          ariaLabel.includes('save') || 
          className.includes('save') ||
          current.querySelector('[aria-label*="save" i]')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  isPostClick(element) {
    // Check if clicking on a post to view details, but exclude certain UI elements
    let current = element;
    
    // Don't trigger on these specific UI elements
    const excludeSelectors = [
      'button', 'a[href]', '.see-more', '.see-less', 
      '[aria-label*="menu"]', '[aria-label*="options"]',
      '.feed-shared-actor', '.feed-shared-control-menu'
    ];
    
    // Check if we clicked on an excluded element
    for (const selector of excludeSelectors) {
      if (current.matches && current.matches(selector)) {
        return false;
      }
    }
    
    // Look for post containers within reasonable distance
    for (let i = 0; i < 8 && current; i++) {
      const className = current.className?.toLowerCase() || '';
      
      if (className.includes('feed-shared-update') || 
          className.includes('occludable-update') ||
          current.hasAttribute('data-urn') ||
          current.querySelector('[data-urn]')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  handleLinkedInSave(saveButton) {
    // Find the associated post content
    let postContainer = saveButton;
    for (let i = 0; i < 10 && postContainer; i++) {
      if (postContainer.querySelector('[data-urn]') || 
          postContainer.className?.includes('feed-shared-update')) {
        break;
      }
      postContainer = postContainer.parentElement;
    }
    
    if (postContainer) {
      // Extract post content
      const postContent = this.extractPostContent(postContainer);
      if (postContent.wordCount > 20) {
        console.log('Reading Tracker: Saving LinkedIn post for tracking', postContent);
        this.saveLinkedInInteraction(postContent, 'saved');
      }
    }
  }
  
  findLinkedInPostContainer(clickedElement) {
    // Find the actual LinkedIn post container from any clicked element within it
    console.log('Reading Tracker: Finding post container from clicked element:', clickedElement);
    
    let current = clickedElement;
    
    // First, try to find the post container by going up the DOM tree
    for (let i = 0; i < 15 && current; i++) {
      const className = current.className?.toLowerCase() || '';
      
      // Look for main post container classes
      if (className.includes('feed-shared-update-v2') || 
          className.includes('occludable-update') ||
          current.hasAttribute('data-urn')) {
        console.log(`Reading Tracker: Found post container via DOM traversal (${i} levels up):`, current);
        return current;
      }
      
      current = current.parentElement;
    }
    
    // If DOM traversal didn't work, try to find visible posts on the page
    const postSelectors = [
      '[data-urn*="urn:li:activity"]',
      '.feed-shared-update-v2',
      '.occludable-update'
    ];
    
    for (const selector of postSelectors) {
      const posts = document.querySelectorAll(selector);
      for (const post of posts) {
        // Check if the clicked element is within this post
        if (post.contains(clickedElement)) {
          console.log(`Reading Tracker: Found post container via selector "${selector}":`, post);
          return post;
        }
      }
    }
    
    // Final fallback: look for any element with substantial text content around the click
    const nearbyElements = document.querySelectorAll('.feed-shared-update-v2, [data-urn], .occludable-update');
    for (const element of nearbyElements) {
      const rect = element.getBoundingClientRect();
      const clickRect = clickedElement.getBoundingClientRect();
      
      // Check if the clicked element is visually within this post
      if (rect.top <= clickRect.top && rect.bottom >= clickRect.bottom &&
          rect.left <= clickRect.left && rect.right >= clickRect.right) {
        console.log('Reading Tracker: Found post container via visual bounds:', element);
        return element;
      }
    }
    
    console.log('Reading Tracker: Could not find post container');
    return null;
  }
  
  handleLinkedInPostClick(clickedElement) {
    // Find the actual post container from the clicked element
    const postContainer = this.findLinkedInPostContainer(clickedElement);
    
    if (!postContainer) {
      console.log('Reading Tracker: Could not find post container from clicked element');
      return;
    }
    
    // Extract content from the post container
    const postContent = this.extractPostContent(postContainer);
    console.log('Reading Tracker: Extracted post content for click:', {
      wordCount: postContent.wordCount,
      title: postContent.title,
      contentPreview: postContent.content.substring(0, 100)
    });
    
    if (postContent.wordCount > 20) {
      console.log('Reading Tracker: LinkedIn post clicked for tracking - saving interaction');
      // Save the clicked post and start reading session
      this.saveLinkedInInteraction(postContent, 'clicked');
      this.startReading();
    } else {
      console.log('Reading Tracker: LinkedIn post too short to track (minimum 20 words)');
    }
  }
  
  handleLinkedInNavigation() {
    // Re-run content analysis when navigating within LinkedIn
    if (this.isLinkedInContent()) {
      console.log('Reading Tracker: Re-analyzing LinkedIn content after navigation');
      setTimeout(() => {
        this.extractContentWithRetries();
      }, 500);
    }
  }
  
  extractPostContent(postContainer) {
    console.log('Reading Tracker: Extracting post content from container:', postContainer);
    
    // Extract content from a specific LinkedIn post with enhanced selectors
    const contentSelectors = [
      // Main post text content
      '.feed-shared-update-v2__commentary .break-words span[dir="ltr"]',
      '.feed-shared-update-v2__commentary .break-words',
      '.feed-shared-update-v2__commentary',
      '.feed-shared-text .break-words span[dir="ltr"]',
      '.feed-shared-text .break-words',
      '.feed-shared-text',
      '.update-components-text .break-words span[dir="ltr"]',
      '.update-components-text .break-words',
      '.update-components-text',
      
      // Article descriptions and shared content
      '.feed-shared-article__description .break-words',
      '.feed-shared-article__description',
      '.feed-shared-external-article__description',
      '.update-components-text__text-view',
      '.feed-shared-update-v2__description-wrapper',
      '.feed-shared-linkedin-video__description',
      
      // Fallback selectors
      '[data-test-id="main-feed-activity-card__commentary"]',
      '.feed-shared-update-v2 .break-words',
      '.occludable-update .break-words'
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
    
    // Enhanced fallback: try to combine all text content selectors
    if (bestWordCount < 20) {
      console.log('Reading Tracker: Using enhanced fallback for text extraction');
      
      const allTextSelectors = [
        '.feed-shared-update-v2__commentary',
        '.feed-shared-text',
        '.update-components-text',
        '.feed-shared-article__description',
        '.feed-shared-external-article__description'
      ];
      
      let combinedText = '';
      for (const selector of allTextSelectors) {
        const elements = postContainer.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.innerText || element.textContent || '';
          if (text.trim() && !combinedText.includes(text.trim())) {
            combinedText += ' ' + text.trim();
          }
        }
      }
      
      if (combinedText.trim()) {
        const cleanText = this.cleanLinkedInText(combinedText);
        const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
        
        if (wordCount > bestWordCount) {
          bestContent = cleanText;
          bestWordCount = wordCount;
          bestSelector = 'combined-text-fallback';
        }
      }
    }
    
    // Final fallback to full post content
    if (bestWordCount < 10) {
      console.log('Reading Tracker: Using final fallback - full post content');
      const fullText = postContainer.innerText || postContainer.textContent || '';
      const cleanText = this.cleanLinkedInText(fullText);
      const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
      
      if (wordCount > 5) {
        bestContent = cleanText;
        bestWordCount = wordCount;
        bestSelector = 'full-post-final-fallback';
      }
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
    
    const title = bestContent.length > 50 
      ? bestContent.substring(0, 50) + '...' 
      : bestContent || 'LinkedIn Post';
    
    const result = {
      title: `${author}: ${title}`,
      content: bestContent,
      wordCount: bestWordCount,
      url: postUrl || window.location.href,
      author,
      selector: bestSelector
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
  
  async saveLinkedInInteraction(postContent, interactionType) {
    // Save LinkedIn interaction (save, click) as a reading session
    try {
      const session = {
        title: postContent.title,
        url: postContent.url,
        content_type: 'linkedin',
        reading_time: interactionType === 'saved' ? 2 : 1, // Assume 2 min for saved, 1 min for clicked
        word_count: postContent.wordCount,
        excerpt: postContent.content.substring(0, 200),
        notes: `LinkedIn ${interactionType} - ${postContent.author}`,
        learning_score: 50, // Default score for LinkedIn interactions
        category: 'business', // Default category for LinkedIn content
        timestamp: new Date().toISOString()
      };
      
      console.log('Reading Tracker: Saving LinkedIn interaction session', session);
      
      const response = await fetch('http://localhost:3001/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(session),
      });
      
      if (response.ok) {
        console.log('Reading Tracker: LinkedIn interaction saved successfully');
        // Show success notification
        this.showLinkedInSaveSuccess(interactionType);
      } else {
        console.error('Reading Tracker: Failed to save LinkedIn interaction');
      }
    } catch (error) {
      console.error('Reading Tracker: Error saving LinkedIn interaction:', error);
    }
  }
  
  showLinkedInSaveSuccess(interactionType) {
    // Show a brief success message for LinkedIn saves
    const message = document.createElement('div');
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: #0073b1;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: fadeInOut 3s ease-in-out;
      ">
        📚 Post ${interactionType} to Reading Tracker
      </div>
      <style>
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateX(100%); }
          15%, 85% { opacity: 1; transform: translateX(0); }
        }
      </style>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
      if (message.parentElement) {
        message.remove();
      }
    }, 3000);
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