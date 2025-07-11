// Test the fix for learning indicator scoring
console.log('🧪 Testing learning indicator scoring fix...');

// Test content with business strategy patterns
const testTitle = "Blind to Disruption – The CEOs Who Missed the Future";
const testContent = `
Companies that miss disruption often fail because their CEOs and leadership teams are blind to the fundamental changes happening in their industries. This article examines the strategic mistakes that led to the downfall of once-dominant companies and the lessons we can learn from their failures.

The history of business strategy shows us that successful companies often become victims of their own success. When companies reach market leadership, they develop institutional blindness to emerging threats. This strategic myopia happens because leadership teams focus on existing customers and proven business models.

Strategic thinking about disruption involves understanding that competitive advantage comes from anticipating future market changes. Companies that successfully navigate disruption demonstrate several key characteristics including strategic flexibility and adaptability.

The entrepreneurship lesson here is that founders and business leaders must develop pattern recognition for disruption signals. Business model innovation requires companies to experiment with new approaches while maintaining current operations.
`;

// Test the learning patterns directly
const learningPatterns = [
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

console.log('📊 Testing learning patterns on business strategy content:');
const titleAndContent = testTitle + ' ' + testContent;

let totalMatches = 0;
learningPatterns.forEach((pattern, index) => {
    const matches = titleAndContent.match(pattern);
    if (matches) {
        console.log(`Pattern ${index + 1}: Found ${matches.length} matches -`, matches.slice(0, 5));
        totalMatches += matches.length;
    }
});

console.log(`\n✅ Total learning pattern matches: ${totalMatches}`);
console.log(`📈 Expected learning indicator score: ${Math.min(totalMatches * 8, 40)} (from keywords alone)`);

// Test if the patterns work with actual content
if (typeof UniversalContentAnalyzer !== 'undefined') {
    const analyzer = new UniversalContentAnalyzer();
    
    const learningSignals = analyzer.detectLearningSignals(testTitle, testContent);
    console.log('\n🎯 Learning Signals Analysis:');
    console.log('Learning keyword count:', learningSignals.learningKeywordCount);
    console.log('Learning score:', learningSignals.learningScore);
    console.log('Has Q&A format:', learningSignals.hasQuestionAnswerFormat);
    console.log('Has step-by-step:', learningSignals.hasStepByStep);
    console.log('Technical terms:', learningSignals.hasTechnicalTerms);
    console.log('Actionable content:', learningSignals.hasActionableContent);
} else {
    console.log('⚠️ UniversalContentAnalyzer not available in this context');
}