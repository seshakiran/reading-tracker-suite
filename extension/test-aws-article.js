// Test AWS ML article analysis
console.log('🧪 Testing AWS ML article analysis...');

const testTitle = "Improve conversational AI response times for enterprise applications with the Amazon Bedrock streaming API and AWS AppSync";
const testUrl = "https://aws.amazon.com/blogs/machine-learning/improve-conversational-ai-response-times-for-enterprise-applications-with-the-amazon-bedrock-streaming-api-and-aws-appsync/";

// Mock content from AWS blog
const testContent = `
This post demonstrates how to improve conversational AI response times for enterprise applications using the Amazon Bedrock streaming API and AWS AppSync. We'll explore the implementation details and best practices for building scalable conversational AI systems.

Amazon Bedrock is a fully managed service that offers a choice of high-performing foundation models from leading AI companies. The streaming API allows developers to receive responses in real-time, significantly improving user experience in conversational applications.

AWS AppSync is a managed GraphQL service that simplifies building scalable APIs. When combined with Amazon Bedrock's streaming capabilities, you can create responsive conversational AI applications that deliver low-latency responses to users.

In this tutorial, we'll cover:
1. Setting up Amazon Bedrock streaming API
2. Configuring AWS AppSync for real-time subscriptions
3. Implementing the frontend to handle streaming responses
4. Best practices for error handling and performance optimization

The architecture involves using GraphQL subscriptions to establish real-time connections between the client and server. When a user sends a message, the application invokes the Amazon Bedrock API with streaming enabled, and the response is streamed back to the client through AppSync subscriptions.

Technical implementation details:
- Configure IAM roles and permissions for Amazon Bedrock access
- Set up AppSync GraphQL schema with streaming support
- Implement Lambda functions to handle Bedrock API calls
- Create React components for real-time message display
- Optimize performance with efficient state management

This approach significantly reduces perceived latency in conversational AI applications, making them more responsive and engaging for enterprise users. The streaming API ensures users see responses as they're generated, rather than waiting for the complete response.

Code examples and configuration details are provided throughout the tutorial to help developers implement this solution in their own applications.
`;

// Test the content analyzer if available
if (typeof UniversalContentAnalyzer !== 'undefined') {
    console.log('✅ UniversalContentAnalyzer is available');
    
    const analyzer = new UniversalContentAnalyzer();
    
    analyzer.analyzeContent(testUrl, testTitle, testContent).then(result => {
        console.log('🎯 AWS Article Analysis Result:');
        console.log('Learning Score:', result.learningScore);
        console.log('Should Track:', result.shouldTrack);
        console.log('Category:', result.category);
        console.log('Reason:', result.reason);
        
        console.log('\n🔍 Detailed Analysis:');
        console.log('Content Quality Score:', result.signals.contentQuality?.qualityScore);
        console.log('Learning Indicators Score:', result.signals.learningIndicators?.learningScore);
        console.log('Language Score:', result.signals.languageRelevance?.languageScore);
        console.log('Topical Relevance Score:', result.signals.topicalRelevance?.topicalRelevance);
        console.log('Source Credibility Score:', result.signals.sourceCredibility?.credibilityScore);
        
        console.log('\n🎯 Topic Analysis:');
        console.log('Topic Scores:', result.signals.topicalRelevance?.topicScores);
        console.log('Primary Topic:', result.signals.topicalRelevance?.primaryTopic);
        
        console.log('\n📝 Learning Indicators:');
        console.log('Learning Keyword Count:', result.signals.learningIndicators?.learningKeywordCount);
        console.log('Has Technical Terms:', result.signals.learningIndicators?.hasTechnicalTerms);
        console.log('Has Actionable Content:', result.signals.learningIndicators?.hasActionableContent);
        
        if (!result.shouldTrack) {
            console.log('\n❌ Why this article was rejected:');
            console.log('- Learning score too low:', result.learningScore, 'vs minimum required:', 50);
            console.log('- Check if technical terms are being detected properly');
            console.log('- Verify learning patterns match the content');
        }
        
    }).catch(error => {
        console.error('❌ Analysis Error:', error);
    });
} else {
    console.log('❌ UniversalContentAnalyzer not available');
    
    // Test learning patterns manually
    const learningPatterns = [
        /\b(how to|tutorial|guide|learn|explained|introduction to|beginner|advanced)\b/gi,
        /\b(implementation|algorithm|architecture|design pattern|best practice)\b/gi,
        /\b(insights|lessons learned|case study|analysis|deep dive|comprehensive)\b/gi,
        /\b(solution|solve|problem|challenge|approach|method|technique)\b/gi,
        /\b(documentation|specification|requirements|design|review)\b/gi
    ];
    
    console.log('🔍 Manual Learning Pattern Test:');
    const titleAndContent = testTitle + ' ' + testContent;
    
    learningPatterns.forEach((pattern, index) => {
        const matches = titleAndContent.match(pattern);
        if (matches) {
            console.log(`Pattern ${index + 1}: Found ${matches.length} matches:`, matches.slice(0, 3));
        }
    });
}