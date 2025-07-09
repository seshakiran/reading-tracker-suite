import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, FileText, TrendingUp } from 'lucide-react';
import { ReadingStats } from '../types/index.ts';
import { getStats } from '../services/api.ts';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
    </div>
  );
};

export default Dashboard;