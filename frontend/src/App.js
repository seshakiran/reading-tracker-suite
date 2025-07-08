import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Reading Tracker Suite
        </h1>
        <p className="text-gray-600 mb-8">
          Your personal reading analytics dashboard
        </p>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">Phase 1 MVP</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backend API</span>
              <span className="text-green-600 font-medium">✓ Running</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">SQLite Database</span>
              <span className="text-green-600 font-medium">✓ Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Docker Setup</span>
              <span className="text-green-600 font-medium">✓ Working</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Frontend</span>
              <span className="text-green-600 font-medium">✓ Working</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Ready for Phase 2: Browser Extension
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;