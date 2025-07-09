import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, ExternalLink, Calendar, Tag } from 'lucide-react';
import { ReadingSession } from '../types/index.ts';
import { getSessions } from '../services/api.ts';

const SessionsList: React.FC = () => {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load reading sessions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'web': return '🌐';
      case 'pdf': return '📄';
      case 'epub': return '📚';
      case 'manual': return '✏️';
      default: return '📖';
    }
  };

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'web': return 'bg-blue-100 text-blue-800';
      case 'pdf': return 'bg-red-100 text-red-800';
      case 'epub': return 'bg-purple-100 text-purple-800';
      case 'manual': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading reading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={loadSessions}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No reading sessions yet</h3>
        <p className="text-gray-600 mb-6">
          Start reading articles or add manual entries to see your reading history here.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Reading Sessions</h2>
        <div className="text-sm text-gray-600">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => (
          <div key={session.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Title and URL */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{getContentTypeIcon(session.content_type)}</span>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {session.title}
                  </h3>
                  {session.url && (
                    <a
                      href={session.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

                {/* URL */}
                {session.url && (
                  <p className="text-sm text-gray-600 mb-3 truncate">
                    {session.url}
                  </p>
                )}

                {/* Excerpt */}
                {session.excerpt && (
                  <p className="text-gray-700 mb-3 line-clamp-2">
                    {session.excerpt}
                  </p>
                )}

                {/* Notes */}
                {session.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Notes:</strong> {session.notes}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {session.tags && session.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {session.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(session.reading_time)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{session.word_count.toLocaleString()} words</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Content Type Badge */}
              <div className="flex-shrink-0 ml-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getContentTypeColor(session.content_type)}`}>
                  {session.content_type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="text-center pt-6">
        <button 
          onClick={loadSessions}
          className="btn btn-secondary"
        >
          Refresh Sessions
        </button>
      </div>
    </div>
  );
};

export default SessionsList;