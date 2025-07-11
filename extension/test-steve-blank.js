// Test script specifically for Steve Blank article
const testTitle = "Blind to Disruption – The CEOs Who Missed the Future";
const testUrl = "https://steveblank.com/2025/07/08/blind-to-disruption-the-ceos-who-missed-the-future/";

// Mock content from Steve Blank article
const testContent = `
Companies that miss disruption often fail because their CEOs and leadership teams are blind to the fundamental changes happening in their industries. This article examines the strategic mistakes that led to the downfall of once-dominant companies and the lessons we can learn from their failures.

The history of business strategy shows us that successful companies often become victims of their own success. When companies reach market leadership, they develop institutional blindness to emerging threats. This strategic myopia happens because:

1. Leadership teams focus on existing customers and proven business models
2. Companies optimize for current market conditions rather than future disruption
3. Organizational structures resist change and innovation
4. CEOs who built the company around one model struggle to adapt

Case studies reveal how companies like Kodak, Blockbuster, and Nokia had access to disruptive technologies but failed to act on them. The key insight is that disruption requires more than just technology - it demands a fundamental transformation of business strategy and organizational culture.

Strategic thinking about disruption involves understanding that competitive advantage comes from anticipating future market changes, not just optimizing current operations. Companies that successfully navigate disruption demonstrate several key characteristics:

- They invest in emerging technologies before they become mainstream
- Leadership teams maintain strategic flexibility and adaptability
- They create separate innovation units to explore new business models
- CEOs embrace strategic transformation even when current business is successful

The entrepreneurship lesson here is that founders and business leaders must develop pattern recognition for disruption signals. This involves continuous learning about emerging trends, customer behavior changes, and technological developments that could reshape entire industries.

Business model innovation requires companies to experiment with new approaches while maintaining current operations. This dual focus on exploitation and exploration is critical for long-term success in dynamic markets.

The strategic implications for modern companies include developing early warning systems for disruption, creating organizational structures that support innovation, and building leadership capabilities for managing strategic transformation.
`;

// Load the content analyzer
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/content-analyzer.js');
document.head.appendChild(script);

script.onload = function() {
    console.log('🧪 Testing Steve Blank article analysis...');
    
    const analyzer = new UniversalContentAnalyzer();
    
    analyzer.analyzeContent(testUrl, testTitle, testContent).then(result => {
        console.log('📊 Steve Blank Analysis Result:');
        console.log('Learning Score:', result.learningScore);
        console.log('Should Track:', result.shouldTrack);
        console.log('Category:', result.category);
        console.log('Reason:', result.reason);
        
        console.log('\n🔍 Detailed Signals:');
        console.log('Content Quality:', result.signals.contentQuality);
        console.log('Learning Indicators:', result.signals.learningIndicators);
        console.log('Topical Relevance:', result.signals.topicalRelevance);
        console.log('Language Relevance:', result.signals.languageRelevance);
        console.log('Source Credibility:', result.signals.sourceCredibility);
        
        // Test specific learning patterns
        console.log('\n🎯 Testing Learning Patterns:');
        const titleAndContent = testTitle + ' ' + testContent;
        
        analyzer.learningPatterns.forEach((pattern, index) => {
            const matches = titleAndContent.match(pattern);
            if (matches) {
                console.log(`Pattern ${index + 1}: Found ${matches.length} matches -`, matches.slice(0, 3));
            }
        });
        
    }).catch(error => {
        console.error('❌ Analysis Error:', error);
    });
};