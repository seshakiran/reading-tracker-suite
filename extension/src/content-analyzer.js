// Universal Smart Content Filtering System
class UniversalContentAnalyzer {
  constructor() {
    this.userPreferences = {
      minimumLearningScore: 50, // 0-100 (temporarily lowered for debugging)
      allowedLanguages: ['en'],
      preferredTopics: ['technology', 'science', 'education', 'business'],
      blockedKeywords: ['politics', 'celebrity', 'sports', 'gossip'],
      minimumReadingTime: 3, // minutes
      minimumWordCount: 300,
      allowSocialMedia: true,
      allowVideoContent: true
    };
    
    this.relevantTopics = {
      technology: [
        'programming', 'software', 'development', 'coding', 'web development',
        'AI', 'machine learning', 'data science', 'blockchain', 'cybersecurity',
        'cloud computing', 'devops', 'mobile development', 'game development',
        'frontend', 'backend', 'fullstack', 'javascript', 'python', 'react',
        'nodejs', 'database', 'api', 'framework', 'library', 'algorithm',
        'architecture', 'microservices', 'docker', 'kubernetes', 'aws'
      ],
      
      science: [
        'research', 'experiment', 'discovery', 'physics', 'chemistry', 'biology',
        'mathematics', 'engineering', 'quantum', 'nanotechnology', 'biotechnology',
        'neuroscience', 'genetics', 'astronomy', 'climate', 'energy', 'materials',
        'scientific method', 'peer review', 'hypothesis', 'theory', 'analysis'
      ],
      
      education: [
        'learning', 'teaching', 'education', 'course', 'curriculum', 'pedagogy',
        'skill development', 'certification', 'training', 'mentorship',
        'tutorial', 'guide', 'howto', 'explained', 'introduction', 'beginner',
        'advanced', 'masterclass', 'workshop', 'seminar', 'lecture'
      ],
      
      business: [
        'entrepreneurship', 'startup', 'business strategy', 'management',
        'leadership', 'productivity', 'innovation', 'growth', 'scaling',
        'marketing', 'sales', 'finance', 'operations', 'strategy', 'planning',
        'execution', 'metrics', 'optimization', 'automation', 'efficiency'
      ],
      
      future: [
        'future', 'trends', 'emerging technology', 'innovation', 'disruption',
        'automation', 'robotics', 'space technology', 'renewable energy',
        'sustainability', 'breakthrough', 'advancement', 'revolution',
        'transformation', 'next generation', 'cutting edge', 'pioneering'
      ]
    };
    
    this.learningPatterns = [
      // Educational intent
      /\b(how to|tutorial|guide|learn|explained|introduction to|beginner|advanced)\b/gi,
      
      // Technical depth
      /\b(implementation|algorithm|architecture|design pattern|best practice)\b/gi,
      
      // Knowledge sharing
      /\b(insights|lessons learned|case study|analysis|deep dive|comprehensive)\b/gi,
      
      // Future-focused
      /\b(future of|emerging|trends|innovation|breakthrough|research)\b/gi,
      
      // Skill development
      /\b(skills|certification|career|development|training|mastery)\b/gi,
      
      // Problem solving
      /\b(solution|solve|problem|challenge|approach|method|technique)\b/gi,
      
      // Technical communication
      /\b(documentation|specification|requirements|design|review)\b/gi,
      
      // Business strategy and entrepreneurship
      /\b(strategy|strategic|business model|disruption|transformation|pivot|adaptation)\b/gi,
      /\b(entrepreneurship|startup|founder|CEO|leadership|management|execution)\b/gi,
      /\b(competitive advantage|market opportunity|customer needs|value proposition)\b/gi,
      /\b(lessons from|case study|success story|failure|what went wrong|why companies)\b/gi,
      
      // Learning from history/examples
      /\b(history shows|historical|example|demonstrates|illustrates|proves)\b/gi,
      /\b(companies that|businesses that|organizations that|CEOs who|leaders who)\b/gi,
      
      // Strategic thinking
      /\b(think about|consider|understand|realize|recognize|important to)\b/gi,
      /\b(key insight|critical factor|main reason|primary cause|root cause)\b/gi
    ];
    
    this.negativePatterns = [
      // News consumption patterns
      /\b(breaking news|just in|live updates|happening now|urgent|alert)\b/gi,
      
      // Entertainment/gossip
      /\b(celebrity|gossip|scandal|controversy|drama|rumor|shocking)\b/gi,
      
      // Clickbait patterns
      /\b(you won't believe|shocking|amazing|incredible|must see|unbelievable)\b/gi,
      /\d+ (things|ways|reasons|secrets|tricks) (that|you|to)/gi,
      
      // Political/divisive content
      /\b(election|politics|political|government|policy|debate|partisan)\b/gi,
      
      // Sports/entertainment scores
      /\b(score|match|game|tournament|championship|winner|defeat|victory)\b/gi,
      
      // Social media drama
      /\b(twitter drama|social media drama|viral|trending|meme|outrage)\b/gi,
      
      // Low-value content
      /\b(listicle|top \d+|ranking|countdown|compilation)\b/gi
    ];
  }
  
  // Main analysis function
  async analyzeContent(url, title, content, metadata = {}) {
    console.log('Analyzing content:', title);
    
    // Quick negative signal check first
    const negativeSignals = this.detectNegativeSignals(title, content, url);
    console.log('🔍 Negative signals check:', negativeSignals);
    
    if (negativeSignals.shouldBlock) {
      console.log('❌ Content blocked due to negative signals:', negativeSignals.reason);
      return {
        shouldTrack: false,
        learningScore: 0,
        reason: negativeSignals.reason,
        signals: negativeSignals
      };
    }
    
    const signals = {
      contentQuality: this.analyzeContentQuality(content),
      learningIndicators: this.detectLearningSignals(title, content),
      languageRelevance: this.analyzeLanguage(content),
      topicalRelevance: this.analyzeTopics(title, content),
      sourceCredibility: this.analyzeSourceCredibility(url, metadata),
      platformSpecific: this.analyzePlatformSpecific(url, title, content)
    };
    
    const learningScore = this.calculateLearningScore(signals);
    const shouldTrack = learningScore >= this.userPreferences.minimumLearningScore;
    
    console.log('Content analysis complete:', {
      title: title.substring(0, 50) + '...',
      learningScore,
      shouldTrack,
      threshold: this.userPreferences.minimumLearningScore,
      signals
    });
    
    // Detailed debugging for failed content
    if (!shouldTrack) {
      console.log('🔍 Why content was rejected:', {
        learningScore,
        minimumRequired: this.userPreferences.minimumLearningScore,
        contentQuality: signals.contentQuality?.qualityScore,
        learningIndicators: signals.learningIndicators?.learningScore,
        languageScore: signals.languageRelevance?.languageScore,
        topicalRelevance: signals.topicalRelevance?.topicalRelevance,
        credibility: signals.sourceCredibility?.credibilityScore
      });
    }
    
    return {
      shouldTrack,
      learningScore,
      signals,
      category: this.categorizeContent(signals.topicalRelevance),
      reason: shouldTrack ? 'High learning value' : 'Low learning value'
    };
  }
  
  // Analyze content quality signals
  analyzeContentQuality(content) {
    const wordCount = this.countWords(content);
    const readingTime = Math.ceil(wordCount / 250); // 250 words per minute
    
    const hasCodeExamples = /<code[^>]*>|```|\bclass\s+\w+|\bfunction\s+\w+|\bdef\s+\w+|\bconst\s+\w+/gi.test(content);
    const hasStructure = /<h[1-6]>|<li>|<ol>|<ul>|\n#{1,6}\s|\n\*\s|\n\d+\./gi.test(content);
    const hasReferences = /\b(source|reference|citation|study|paper|documentation|docs)\b/gi.test(content);
    const hasLinks = /<a\s+href|https?:\/\/[^\s<>]+/gi.test(content);
    
    return {
      wordCount,
      readingTime,
      hasCodeExamples: hasCodeExamples,
      hasStructure: hasStructure,
      hasReferences: hasReferences,
      hasLinks: hasLinks,
      qualityScore: this.calculateQualityScore(wordCount, readingTime, hasCodeExamples, hasStructure, hasReferences)
    };
  }
  
  calculateQualityScore(wordCount, readingTime, hasCodeExamples, hasStructure, hasReferences) {
    let score = 0;
    
    // Word count scoring
    if (wordCount >= 1000) score += 30;
    else if (wordCount >= 500) score += 20;
    else if (wordCount >= 300) score += 10;
    
    // Reading time scoring
    if (readingTime >= 10) score += 20;
    else if (readingTime >= 5) score += 15;
    else if (readingTime >= 3) score += 10;
    
    // Structure and examples
    if (hasCodeExamples) score += 15;
    if (hasStructure) score += 10;
    if (hasReferences) score += 15;
    
    return Math.min(score, 100);
  }
  
  // Detect learning signals in content
  detectLearningSignals(title, content) {
    const titleAndContent = title + ' ' + content;
    
    let learningKeywordCount = 0;
    this.learningPatterns.forEach(pattern => {
      const matches = titleAndContent.match(pattern);
      if (matches) learningKeywordCount += matches.length;
    });
    
    const hasQuestionAnswerFormat = /\b(what|why|how|when|where)\b.*\?/gi.test(titleAndContent);
    const hasStepByStep = /\b(step|steps|stage|phase|process|procedure)\b/gi.test(titleAndContent);
    const hasTechnicalTerms = this.countTechnicalTerms(titleAndContent);
    const hasActionableContent = /\b(implement|build|create|develop|design|optimize|improve)\b/gi.test(titleAndContent);
    
    return {
      learningKeywordCount,
      hasQuestionAnswerFormat,
      hasStepByStep,
      hasTechnicalTerms,
      hasActionableContent,
      learningScore: this.calculateLearningIndicatorScore({
        keywords: learningKeywordCount,
        qa: hasQuestionAnswerFormat,
        stepByStep: hasStepByStep,
        technical: hasTechnicalTerms,
        actionable: hasActionableContent
      })
    };
  }
  
  // Calculate learning indicator score specifically
  calculateLearningIndicatorScore(indicators) {
    let score = 0;
    
    // Keywords matching learning patterns (most important)
    score += Math.min(indicators.keywords * 8, 40);
    
    // Question/answer format
    if (indicators.qa) score += 15;
    
    // Step-by-step content
    if (indicators.stepByStep) score += 10;
    
    // Technical terms
    score += Math.min(indicators.technical * 3, 20);
    
    // Actionable content
    if (indicators.actionable) score += 15;
    
    return Math.min(score, 100);
  }
  
  countTechnicalTerms(content) {
    const technicalTerms = [
      'API', 'SDK', 'CLI', 'IDE', 'HTTP', 'JSON', 'XML', 'SQL', 'NoSQL',
      'REST', 'GraphQL', 'OAuth', 'JWT', 'CORS', 'CDN', 'DNS', 'SSL',
      'regex', 'async', 'await', 'promise', 'callback', 'closure', 'scope',
      'prototype', 'inheritance', 'polymorphism', 'encapsulation', 'abstraction'
    ];
    
    let count = 0;
    technicalTerms.forEach(term => {
      const regex = new RegExp('\\b' + term + '\\b', 'gi');
      const matches = content.match(regex);
      if (matches) count += matches.length;
    });
    
    return count;
  }
  
  // Analyze language relevance
  analyzeLanguage(content) {
    const teluguPattern = /[\u0C00-\u0C7F]/g;
    const teluguMatches = content.match(teluguPattern);
    const teluguPercentage = teluguMatches ? (teluguMatches.length / content.length) * 100 : 0;
    
    const englishPattern = /[a-zA-Z]/g;
    const englishMatches = content.match(englishPattern);
    const englishPercentage = englishMatches ? (englishMatches.length / content.length) * 100 : 0;
    
    const isEnglishContent = englishPercentage > 70 && teluguPercentage < 5;
    
    return {
      isEnglishContent,
      englishPercentage,
      teluguPercentage,
      languageScore: isEnglishContent ? 100 : 0
    };
  }
  
  // Analyze topic relevance
  analyzeTopics(title, content) {
    const titleAndContent = (title + ' ' + content).toLowerCase();
    const topicScores = {};
    
    Object.keys(this.relevantTopics).forEach(topic => {
      let score = 0;
      this.relevantTopics[topic].forEach(keyword => {
        const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
        const matches = titleAndContent.match(regex);
        if (matches) {
          score += matches.length * (title.toLowerCase().includes(keyword) ? 2 : 1);
        }
      });
      topicScores[topic] = score;
    });
    
    const maxScore = Math.max(...Object.values(topicScores));
    const primaryTopic = Object.keys(topicScores).find(topic => topicScores[topic] === maxScore);
    
    return {
      topicScores,
      primaryTopic,
      topicalRelevance: maxScore > 0 ? Math.min((maxScore / 5) * 100, 100) : 0
    };
  }
  
  // Analyze source credibility
  analyzeSourceCredibility(url, metadata) {
    const domain = this.extractDomain(url);
    
    // High-credibility domains
    const highCredibilityDomains = [
      'github.com', 'stackoverflow.com', 'medium.com', 'dev.to',
      'arxiv.org', 'ieee.org', 'acm.org', 'nature.com', 'science.org',
      'mit.edu', 'stanford.edu', 'harvard.edu', 'berkeley.edu',
      'google.com', 'microsoft.com', 'facebook.com', 'amazon.com',
      'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com'
    ];
    
    // Educational/Tech domains
    const educationalDomains = [
      '.edu', '.org', 'coursera.org', 'edx.org', 'udemy.com',
      'khanacademy.org', 'codecademy.com', 'freecodecamp.org'
    ];
    
    const isHighCredibility = highCredibilityDomains.some(d => domain.includes(d));
    const isEducational = educationalDomains.some(d => domain.includes(d));
    
    return {
      domain,
      isHighCredibility,
      isEducational,
      credibilityScore: isHighCredibility ? 100 : (isEducational ? 80 : 50)
    };
  }
  
  // Platform-specific analysis
  analyzePlatformSpecific(url, title, content) {
    const domain = this.extractDomain(url);
    
    if (domain.includes('youtube.com')) {
      return this.analyzeYouTubeContent(url, title, content);
    } else if (domain.includes('reddit.com')) {
      return this.analyzeRedditContent(url, title, content);
    } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return this.analyzeTwitterContent(url, title, content);
    }
    
    return { platformScore: 50 };
  }
  
  analyzeYouTubeContent(url, title, content) {
    const educationalChannels = [
      '3blue1brown', 'computerphile', 'mit', 'stanford', 'harvard',
      'khan academy', 'crash course', 'ted-ed', 'veritasium', 'vsauce'
    ];
    
    const isEducationalChannel = educationalChannels.some(channel => 
      content.toLowerCase().includes(channel) || url.toLowerCase().includes(channel)
    );
    
    const hasTranscriptIndicators = /transcript|captions|subtitles/gi.test(content);
    const isShortForm = title.toLowerCase().includes('short') || url.includes('shorts');
    
    return {
      isEducationalChannel,
      hasTranscriptIndicators,
      isShortForm,
      platformScore: isEducationalChannel ? 90 : (isShortForm ? 20 : 60)
    };
  }
  
  analyzeRedditContent(url, title, content) {
    const learningSubreddits = [
      'programming', 'learnprogramming', 'webdev', 'machinelearning',
      'datascience', 'technology', 'science', 'askscience', 'explainlikeimfive',
      'todayilearned', 'educationalgifs', 'compsci', 'math', 'physics'
    ];
    
    const isLearningSubreddit = learningSubreddits.some(sub => 
      url.toLowerCase().includes(`/r/${sub}`)
    );
    
    const hasQualityDiscussion = content.length > 500 && 
      /\b(explanation|analysis|detailed|comprehensive)\b/gi.test(content);
    
    return {
      isLearningSubreddit,
      hasQualityDiscussion,
      platformScore: isLearningSubreddit ? 80 : (hasQualityDiscussion ? 60 : 30)
    };
  }
  
  analyzeTwitterContent(url, title, content) {
    const hasThread = /\b(thread|🧵|1\/\d+)\b/gi.test(content);
    const hasLinks = /https?:\/\/[^\s<>]+/gi.test(content);
    const isShortTweet = content.length < 280;
    
    return {
      hasThread,
      hasLinks,
      isShortTweet,
      platformScore: hasThread ? 70 : (hasLinks ? 50 : 20)
    };
  }
  
  // Detect negative signals that should block content
  detectNegativeSignals(title, content, url) {
    const titleAndContent = title + ' ' + content;
    
    // Check for blocked keywords
    const hasBlockedKeywords = this.userPreferences.blockedKeywords.some(keyword => 
      titleAndContent.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Check for negative patterns
    let negativeScore = 0;
    this.negativePatterns.forEach(pattern => {
      const matches = titleAndContent.match(pattern);
      if (matches) negativeScore += matches.length;
    });
    
    // Check content length
    const wordCount = this.countWords(content);
    const isTooShort = wordCount < this.userPreferences.minimumWordCount;
    
    // Check language
    const languageAnalysis = this.analyzeLanguage(content);
    const isWrongLanguage = !languageAnalysis.isEnglishContent;
    
    const shouldBlock = hasBlockedKeywords || negativeScore > 3 || isTooShort || isWrongLanguage;
    
    let reason = '';
    if (hasBlockedKeywords) reason = 'Contains blocked keywords';
    else if (negativeScore > 3) reason = 'Too many negative signals';
    else if (isTooShort) reason = 'Content too short';
    else if (isWrongLanguage) reason = 'Non-English content';
    
    return {
      shouldBlock,
      reason,
      hasBlockedKeywords,
      negativeScore,
      isTooShort,
      isWrongLanguage
    };
  }
  
  // Calculate final learning score
  calculateLearningScore(signals) {
    const weights = {
      contentQuality: 0.3,
      learningIndicators: 0.4,
      languageRelevance: 0.1,
      topicalRelevance: 0.15,
      sourceCredibility: 0.05
    };
    
    let score = 0;
    score += (signals.contentQuality?.qualityScore || 0) * weights.contentQuality;
    score += (signals.learningIndicators?.learningScore || 0) * weights.learningIndicators;
    score += (signals.languageRelevance?.languageScore || 0) * weights.languageRelevance;
    score += (signals.topicalRelevance?.topicalRelevance || 0) * weights.topicalRelevance;
    score += (signals.sourceCredibility?.credibilityScore || 0) * weights.sourceCredibility;
    
    return Math.round(score);
  }
  
  // Categorize content based on analysis
  categorizeContent(topicalRelevance) {
    if (!topicalRelevance || !topicalRelevance.topicScores) return 'other';
    
    const maxScore = Math.max(...Object.values(topicalRelevance.topicScores));
    if (maxScore === 0) return 'other';
    
    return Object.keys(topicalRelevance.topicScores).find(
      topic => topicalRelevance.topicScores[topic] === maxScore
    ) || 'other';
  }
  
  // Helper functions
  extractDomain(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      return url.toLowerCase();
    }
  }
  
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalContentAnalyzer;
}