// Debug script to test content analysis
console.log('🧪 Debug: Testing content analysis on current page');

// Test the content analyzer
if (typeof UniversalContentAnalyzer !== 'undefined') {
  console.log('✅ UniversalContentAnalyzer is available');
  
  const analyzer = new UniversalContentAnalyzer();
  const title = document.title;
  const url = window.location.href;
  
  // Get page content
  const contentSelectors = [
    'article', '[role="article"]', '.article-content', '.post-content', 
    '.entry-content', '.content', 'main', '.main-content'
  ];
  
  let mainContent = null;
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainContent = element;
      console.log(`✅ Found content with selector: ${selector}`);
      break;
    }
  }
  
  if (!mainContent) {
    mainContent = document.body;
    console.log('⚠️ Using document.body as fallback');
  }
  
  const content = mainContent.innerText || mainContent.textContent || '';
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  
  console.log('📄 Page Analysis:', {
    title: title,
    url: url,
    wordCount: wordCount,
    contentLength: content.length
  });
  
  // Run the analysis
  analyzer.analyzeContent(url, title, content).then(result => {
    console.log('🎯 Analysis Result:', result);
    
    if (result.shouldTrack) {
      console.log('✅ This page SHOULD be tracked');
      console.log('📊 Learning Score:', result.learningScore);
      console.log('🏷️ Category:', result.category);
    } else {
      console.log('❌ This page should NOT be tracked');
      console.log('📊 Learning Score:', result.learningScore);
      console.log('💡 Reason:', result.reason);
    }
    
    console.log('🔍 Detailed Signals:', result.signals);
  }).catch(error => {
    console.error('❌ Analysis Error:', error);
  });
  
} else {
  console.error('❌ UniversalContentAnalyzer not found! Check if content-analyzer.js is loaded.');
}