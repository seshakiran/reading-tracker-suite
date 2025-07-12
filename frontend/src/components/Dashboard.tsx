import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, FileText, TrendingUp, Mail, Copy, Brain, RefreshCw, AlertTriangle, Settings } from 'lucide-react';
import { ReadingStats } from '../types/index.ts';
import { getStats } from '../services/api.ts';

interface NewsletterItem {
  title: string;
  url: string;
  excerpt: string;
  readingTime: number;
  learningScore: number;
  tags: string[];
  date: string;
  category: string;
  id?: string;
  llmGenerated?: boolean;
}

interface NewsletterSection {
  title: string;
  items: NewsletterItem[];
}

interface Newsletter {
  title: string;
  subtitle: string;
  intro: string;
  sections: NewsletterSection[];
  footer: {
    totalArticles: number;
    categoriesCovered: number;
    categories: string[];
    generatedAt: string;
    message: string;
  };
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newsletterItems, setNewsletterItems] = useState<NewsletterItem[]>([]);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterFormats, setNewsletterFormats] = useState<{html: string, markdown: string} | null>(null);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [showFullNewsletter, setShowFullNewsletter] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    loadNewsletterQueue();
  }, []);

  const loadNewsletterQueue = async () => {
    setNewsletterLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/newsletter/queue');
      if (response.ok) {
        const items = await response.json();
        setNewsletterItems(items.map((item: any) => ({
          title: item.title,
          url: item.url,
          excerpt: item.llm_summary || item.excerpt,
          readingTime: item.reading_time,
          learningScore: item.learning_score,
          tags: item.tags || [],
          date: new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          category: item.category,
          id: item.id.toString(),
          llmGenerated: !!item.llm_summary
        })));
      }
    } catch (error) {
      console.error('Error loading newsletter queue:', error);
    } finally {
      setNewsletterLoading(false);
    }
  };

  const generateNewsletter = async () => {
    setNewsletterLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/newsletter/generate-from-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewsletter(data.newsletter);
        if (data.formats) {
          setNewsletterFormats(data.formats);
        }
        setShowFullNewsletter(true);
      }
    } catch (error) {
      console.error('Error generating newsletter:', error);
    } finally {
      setNewsletterLoading(false);
    }
  };

  const copyToClipboard = async (content: string, type: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Simple feedback - you could enhance this with a toast system
      alert(`${type} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const generateSummary = async (itemId: string) => {
    setLlmError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/llm/summarize/${itemId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadNewsletterQueue(); // Refresh to show new summary
      } else {
        const errorData = await response.json();
        setLlmError(errorData.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setLlmError('Network error. Please check your connection and try again.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!stats) {
    return <div className="flex items-center justify-center h-64">Error loading stats</div>;
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Reading Time</p>
              <p className="text-2xl font-bold text-gray-900">{formatTime(stats.totalReadingTime)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Words</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalWords.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reading Days</p>
              <p className="text-2xl font-bold text-gray-900">{stats.readingDays}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Reading Progress</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Average session time</span>
              <span className="font-medium">{formatTime(stats.averageReadingTime)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Words per session</span>
              <span className="font-medium">
                {stats.totalSessions > 0 ? Math.round(stats.totalWords / stats.totalSessions) : 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Reading streak</span>
              <span className="font-medium">{stats.readingDays} days</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Today's reading</span>
              <span className="font-medium">0 minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>This week</span>
              <span className="font-medium">0 minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Monthly goal</span>
              <span className="font-medium">10 hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Newsletter Queue</h2>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {newsletterItems.length} items
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadNewsletterQueue}
              disabled={newsletterLoading}
              className="btn-secondary text-sm flex items-center space-x-1"
            >
              <RefreshCw className={`h-3 w-3 ${newsletterLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={generateNewsletter}
              disabled={newsletterLoading || newsletterItems.length === 0}
              className="btn-primary text-sm flex items-center space-x-1"
            >
              <Mail className="h-3 w-3" />
              <span>Generate Newsletter</span>
            </button>
          </div>
        </div>

        {/* LLM Error Display */}
        {llmError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 mb-1">AI Summarization Failed</h4>
                <p className="text-sm text-red-700 mb-3">{llmError}</p>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-red-600">Suggestions:</span>
                  <a href="#settings" className="text-xs text-red-700 hover:text-red-900 underline flex items-center space-x-1">
                    <Settings className="h-3 w-3" />
                    <span>Check LLM settings</span>
                  </a>
                  <span className="text-xs text-red-600">•</span>
                  <span className="text-xs text-red-600">Try OpenAI/Grok as fallback</span>
                </div>
              </div>
              <button
                onClick={() => setLlmError(null)}
                className="text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {newsletterItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No articles in newsletter queue</p>
            <p className="text-sm">Use the "Add to Newsletter" button while browsing articles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {newsletterItems.slice(0, 3).map((item, index) => (
              <div key={item.id || index} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.excerpt}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{item.date}</span>
                      <span>Score: {item.learningScore}/100</span>
                      {item.llmGenerated && (
                        <span className="flex items-center space-x-1 text-purple-600">
                          <Brain className="h-3 w-3" />
                          <span>AI Summary</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {!item.llmGenerated && item.id && (
                    <button
                      onClick={() => generateSummary(item.id!)}
                      className="ml-3 p-1 text-purple-600 hover:bg-purple-50 rounded"
                      title="Generate AI Summary"
                    >
                      <Brain className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {newsletterItems.length > 3 && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500">
                  ... and {newsletterItems.length - 3} more articles
                </p>
              </div>
            )}
          </div>
        )}

        {/* Newsletter Formats */}
        {newsletterFormats && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Newsletter Formats</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(newsletterFormats.html, 'Substack format')}
                className="btn-primary text-sm flex items-center space-x-1"
              >
                <Copy className="h-3 w-3" />
                <span>Copy for Substack</span>
              </button>
              <button
                onClick={() => copyToClipboard(newsletterFormats.markdown, 'Markdown')}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <Copy className="h-3 w-3" />
                <span>Copy Markdown</span>
              </button>
              {newsletter && (
                <button
                  onClick={() => setShowFullNewsletter(!showFullNewsletter)}
                  className="btn-secondary text-sm"
                >
                  {showFullNewsletter ? 'Hide' : 'Show'} Full Newsletter
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full Newsletter Preview */}
      {newsletter && showFullNewsletter && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Newsletter Preview</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(newsletterFormats?.html || '', 'Substack format')}
                className="btn-primary flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy for Substack</span>
              </button>
              <button
                onClick={() => copyToClipboard(newsletterFormats?.markdown || '', 'Markdown')}
                className="btn-secondary flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Markdown</span>
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-gray-50">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {newsletter.title}
            </h1>
            <p className="text-lg text-gray-600 mb-4 italic">
              {newsletter.subtitle}
            </p>
            <p className="text-gray-700 leading-relaxed">
              {newsletter.intro}
            </p>
          </div>

          {/* Newsletter Sections */}
          {newsletter.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mt-6">
              <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors"
                          >
                            {item.title}
                          </a>
                        </h3>
                        <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                          {item.excerpt}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{item.date}</span>
                          <span>Score: {item.learningScore}/100</span>
                          {item.llmGenerated && (
                            <span className="flex items-center space-x-1 text-purple-600">
                              <Brain className="h-3 w-3" />
                              <span>AI Summary</span>
                            </span>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex items-center space-x-1">
                              {item.tags.slice(0, 2).map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-1 bg-gray-200 rounded-full text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Newsletter Footer */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">About This Digest</h3>
            <p className="text-gray-700 mb-4">{newsletter.footer.message}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Total articles:</span> {newsletter.footer.totalArticles}
              </div>
              <div>
                <span className="font-medium">Categories:</span> {newsletter.footer.categories.join(', ')}
              </div>
              <div>
                <span className="font-medium">Generated:</span>{' '}
                {new Date(newsletter.footer.generatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;