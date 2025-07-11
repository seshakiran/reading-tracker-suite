import React, { useState, useEffect } from 'react';
import { Mail, Download, Settings, Calendar, Target, Filter, Copy, Trash2, List, RefreshCw, FileText, Code } from 'lucide-react';

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

interface NewsletterStats {
  totalSessions: number;
  dateRange: number;
  categories: string[];
  avgLearningScore: number;
}

const Newsletter: React.FC = () => {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Newsletter queue state
  const [queueItems, setQueueItems] = useState<NewsletterItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'queue'>('generator');
  
  // Newsletter formats state
  const [newsletterFormats, setNewsletterFormats] = useState<{html: string, markdown: string} | null>(null);
  
  // Configuration state
  const [dateRange, setDateRange] = useState(7);
  const [includeCategories, setIncludeCategories] = useState(['all']);
  const [excludeLowScore, setExcludeLowScore] = useState(false);
  const [minScore, setMinScore] = useState(30);
  const [excludeLinkedIn, setExcludeLinkedIn] = useState(true); // Default to excluding LinkedIn

  // Load newsletter queue on component mount
  useEffect(() => {
    loadNewsletterQueue();
  }, []);

  const loadNewsletterQueue = async () => {
    setQueueLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/newsletter/queue');
      if (response.ok) {
        const items = await response.json();
        setQueueItems(items.map((item: any) => ({
          title: item.title,
          url: item.url,
          excerpt: item.excerpt,
          readingTime: item.reading_time,
          learningScore: item.learning_score,
          tags: item.tags || [],
          date: new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          category: item.category,
          id: item.id.toString()
        })));
        
        // Auto-generate newsletter if queue has items
        if (items.length > 0) {
          const newsletterData = await generateFromQueue();
          if (newsletterData && newsletterData.formats) {
            setNewsletterFormats(newsletterData.formats);
          }
        }
      }
    } catch (error) {
      console.error('Error loading newsletter queue:', error);
      setError('Failed to load newsletter queue');
    } finally {
      setQueueLoading(false);
    }
  };

  const removeFromQueue = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/newsletter/queue/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setQueueItems(prev => prev.filter(item => item.id !== id));
      } else {
        throw new Error('Failed to remove item from queue');
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      setError('Failed to remove item from queue');
    }
  };

  const generateFromQueue = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/newsletter/generate-from-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeTracked: includeCategories.includes('all'),
          dateRange,
          minScore: excludeLowScore ? minScore : 0
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate newsletter from queue');
      }
      
      const data = await response.json();
      setNewsletter(data.newsletter);
      setStats(data.stats);
      
      // Return the data so it can be used by caller
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate newsletter from queue');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateNewsletter = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/newsletter/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange,
          includeCategories,
          excludeLowScore,
          minScore,
          excludeLinkedIn
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate newsletter');
      }
      
      const data = await response.json();
      setNewsletter(data.newsletter);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate newsletter');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!newsletter) return;
    
    // Create clean text format for Substack
    let content = `${newsletter.title}\n\n`;
    content += `${newsletter.subtitle}\n\n`;
    content += `${newsletter.intro}\n\n`;
    
    newsletter.sections.forEach(section => {
      content += `${section.title}\n\n`;
      section.items.forEach(item => {
        content += `${item.title}\n`;
        content += `${item.url}\n\n`;
        content += `${item.excerpt}\n\n`;
        if (item.tags.length > 0) {
          content += `Tags: ${item.tags.join(', ')}\n\n`;
        }
        content += `---\n\n`;
      });
    });
    
    content += `About This Digest\n\n`;
    content += `${newsletter.footer.message}\n\n`;
    content += `Total articles: ${newsletter.footer.totalArticles}\n`;
    content += `Categories covered: ${newsletter.footer.categories.join(', ')}\n`;
    content += `Generated: ${new Date(newsletter.footer.generatedAt).toLocaleString()}\n`;
    
    try {
      await navigator.clipboard.writeText(content);
      // Show success message
      const button = document.querySelector('#copy-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const copyHTMLToClipboard = async () => {
    if (!newsletterFormats?.html) return;
    
    try {
      await navigator.clipboard.writeText(newsletterFormats.html);
      // Show success message
      const button = document.querySelector('#copy-html-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy HTML: ', err);
    }
  };

  const copyMarkdownToClipboard = async () => {
    if (!newsletterFormats?.markdown) return;
    
    try {
      await navigator.clipboard.writeText(newsletterFormats.markdown);
      // Show success message
      const button = document.querySelector('#copy-markdown-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy Markdown: ', err);
    }
  };

  const deleteNewsletterItem = (sectionIndex: number, itemIndex: number) => {
    if (!newsletter) return;
    
    const updatedNewsletter = { ...newsletter };
    updatedNewsletter.sections = [...newsletter.sections];
    updatedNewsletter.sections[sectionIndex] = {
      ...newsletter.sections[sectionIndex],
      items: newsletter.sections[sectionIndex].items.filter((_, index) => index !== itemIndex)
    };
    
    // Remove empty sections
    updatedNewsletter.sections = updatedNewsletter.sections.filter(section => section.items.length > 0);
    
    // Update footer counts
    const totalItems = updatedNewsletter.sections.reduce((count, section) => count + section.items.length, 0);
    updatedNewsletter.footer = {
      ...newsletter.footer,
      totalArticles: totalItems
    };
    
    setNewsletter(updatedNewsletter);
    
    // Update stats
    if (stats) {
      setStats({
        ...stats,
        totalSessions: totalItems
      });
    }
  };

  const exportAsMarkdown = () => {
    if (!newsletter) return;
    
    let markdown = `# ${newsletter.title}\n\n`;
    markdown += `*${newsletter.subtitle}*\n\n`;
    markdown += `${newsletter.intro}\n\n`;
    
    newsletter.sections.forEach(section => {
      markdown += `## ${section.title}\n\n`;
      section.items.forEach(item => {
        markdown += `### [${item.title}](${item.url})\n\n`;
        markdown += `${item.excerpt}\n\n`;
        if (item.tags.length > 0) {
          markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
        }
        markdown += `---\n\n`;
      });
    });
    
    markdown += `## About This Digest\n\n`;
    markdown += `${newsletter.footer.message}\n\n`;
    markdown += `- **Total articles:** ${newsletter.footer.totalArticles}\n`;
    markdown += `- **Categories covered:** ${newsletter.footer.categories.join(', ')}\n`;
    markdown += `- **Generated:** ${new Date(newsletter.footer.generatedAt).toLocaleString()}\n`;
    
    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-digest-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Generator</h1>
          <p className="text-gray-600 mt-1">
            Create beautiful newsletters from your reading sessions and curated articles
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadNewsletterQueue}
            disabled={queueLoading}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${queueLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
          <button
            onClick={activeTab === 'generator' ? generateNewsletter : generateFromQueue}
            disabled={loading}
            className="btn-primary flex items-center space-x-2"
          >
            <Mail className="h-4 w-4" />
            <span>{loading ? 'Generating...' : activeTab === 'generator' ? 'Generate Newsletter' : 'Generate from Queue'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('generator')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'generator'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Mail className="h-4 w-4 inline mr-2" />
            Newsletter Generator
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List className="h-4 w-4 inline mr-2" />
            Newsletter Queue ({queueItems.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'generator' ? (
        <>
          {/* Configuration Panel */}
          <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="input-field"
            >
              <option value={0}>Today only</option>
              <option value={1}>Last day</option>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last week</option>
              <option value={14}>Last 2 weeks</option>
              <option value={30}>Last month</option>
            </select>
          </div>

          {/* Minimum Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Target className="h-4 w-4 inline mr-1" />
              Min Learning Score
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="flex-1"
                disabled={!excludeLowScore}
              />
              <span className="text-sm font-medium w-8">{minScore}</span>
            </div>
          </div>

          {/* Exclude Low Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="h-4 w-4 inline mr-1" />
              Quality Filter
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={excludeLowScore}
                onChange={(e) => setExcludeLowScore(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Exclude low scores</span>
            </label>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <select
              value={includeCategories[0]}
              onChange={(e) => setIncludeCategories([e.target.value])}
              className="input-field"
            >
              <option value="all">All categories</option>
              <option value="technology">Technology</option>
              <option value="business">Business</option>
              <option value="science">Science</option>
              <option value="education">Education</option>
              <option value="future">Future</option>
              <option value="linkedin">LinkedIn Only</option>
              <option value="linkedin_newsletter">Curated LinkedIn Posts</option>
            </select>
          </div>
        </div>
        
        {/* LinkedIn Exclusion Option */}
        {includeCategories[0] === 'all' && (
          <div className="mt-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={excludeLinkedIn}
                onChange={(e) => setExcludeLinkedIn(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">
                Exclude LinkedIn posts from newsletter (recommended for manual curation)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalSessions}</div>
            <div className="text-sm text-gray-600">Articles</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-600">{stats.avgLearningScore}</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.categories.length}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.dateRange}</div>
            <div className="text-sm text-gray-600">Days</div>
          </div>
        </div>
      )}

      {/* Newsletter Preview */}
      {newsletter && (
        <div className="space-y-6">
          {/* Newsletter Header */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Newsletter Preview</h2>
              <div className="flex items-center space-x-2">
                <button
                  id="copy-button"
                  onClick={copyToClipboard}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy Text</span>
                </button>
                {newsletterFormats?.html && (
                  <button
                    id="copy-html-button"
                    onClick={copyHTMLToClipboard}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy for Substack</span>
                  </button>
                )}
                {newsletterFormats?.markdown && (
                  <button
                    id="copy-markdown-button"
                    onClick={copyMarkdownToClipboard}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Copy Markdown</span>
                  </button>
                )}
                <button
                  onClick={exportAsMarkdown}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download MD</span>
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
          </div>

          {/* Newsletter Sections */}
          {newsletter.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="card">
              <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors group"
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
                          {item.tags.length > 0 && (
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
                      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => deleteNewsletterItem(sectionIndex, itemIndex)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove from newsletter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Newsletter Footer */}
          <div className="card bg-gray-50">
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

      {/* Empty State */}
      {!newsletter && !loading && (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Ready to create your newsletter?
          </h3>
          <p className="text-gray-600 mb-4">
            Generate a beautiful newsletter from your tracked reading sessions.
          </p>
          <button
            onClick={generateNewsletter}
            className="btn-primary"
          >
            Generate Your First Newsletter
          </button>
        </div>
      )}
      </>
      ) : (
        /* Newsletter Queue Tab */
        <div className="space-y-6">
          {/* Queue Header */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Newsletter Queue</h3>
                <p className="text-sm text-gray-600">
                  Articles you've manually added to your newsletter queue
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {queueItems.length} item{queueItems.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {queueItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Quick Actions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={generateFromQueue}
                    disabled={loading}
                    className="btn-primary text-sm"
                  >
                    Generate Newsletter from Queue
                  </button>
                  <span className="text-sm text-blue-700">
                    This will create a newsletter with your curated articles
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Queue Items */}
          {queueLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading queue...</span>
            </div>
          ) : queueItems.length === 0 ? (
            <div className="text-center py-12">
              <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Your newsletter queue is empty
              </h3>
              <p className="text-gray-600 mb-4">
                Visit articles and use the "Add to Newsletter" button to add them to your queue.
              </p>
              <div className="text-sm text-gray-500">
                <p>💡 <strong>Tip:</strong> The floating newsletter button appears on learning-focused content</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {queueItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className="card hover:bg-gray-50 transition-colors"
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
                      
                      {item.excerpt && (
                        <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                          {item.excerpt}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{item.date}</span>
                        <span>Score: {item.learningScore}/100</span>
                        {item.readingTime && (
                          <span>{item.readingTime} min read</span>
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
                    
                    <div className="ml-4">
                      <button
                        onClick={() => removeFromQueue(item.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Newsletter;