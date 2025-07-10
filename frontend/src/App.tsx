import React, { useState } from 'react';
import Dashboard from './components/Dashboard.tsx';
import AddReadingForm from './components/AddReadingForm.tsx';
import SessionsList from './components/SessionsList.tsx';
import Newsletter from './components/Newsletter.tsx';
import { BookOpen, Plus, Settings, BarChart3, Mail, Menu, X } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'sessions' | 'add' | 'newsletter' | 'settings'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: BarChart3, key: 'dashboard' as const },
    { name: 'Sessions', icon: BookOpen, key: 'sessions' as const },
    { name: 'Add Reading', icon: Plus, key: 'add' as const },
    { name: 'Newsletter', icon: Mail, key: 'newsletter' as const },
    { name: 'Settings', icon: Settings, key: 'settings' as const },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'sessions':
        return <SessionsList />;
      case 'add':
        return (
          <AddReadingForm 
            onSuccess={() => {
              setCurrentView('dashboard');
            }}
            onCancel={() => {
              setCurrentView('dashboard');
            }}
          />
        );
      case 'newsletter':
        return <Newsletter />;
      case 'settings':
        return <div className="text-center py-12">Settings coming soon...</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 mr-2"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <BookOpen className="h-8 w-8 text-blue-600" />
              <h1 className="ml-3 text-xl lg:text-2xl font-bold text-gray-900">Reading Tracker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 hidden sm:block">Welcome back!</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8 relative">
          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static fixed inset-y-0 left-0 z-50
            w-64 flex-shrink-0 bg-white lg:bg-transparent 
            transition-transform duration-300 ease-in-out
            lg:transition-none
          `}>
            <nav className="space-y-2 p-4 lg:p-0 pt-20 lg:pt-0">
              {navigation.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setCurrentView(item.key);
                    setSidebarOpen(false); // Close mobile sidebar when item is selected
                  }}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                    currentView === item.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;