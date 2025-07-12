import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Brain, Server, Key, Save, Trash2, Plus, RefreshCw } from 'lucide-react';

interface LLMConfig {
  id: number;
  provider: string;
  model_name: string;
  api_key: string | null;
  api_url: string | null;
  is_active: boolean;
  priority: number;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

const Settings: React.FC = () => {
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [newConfig, setNewConfig] = useState({
    provider: 'ollama',
    model_name: '',
    api_key: '',
    api_url: '',
    is_active: false,
    priority: 1
  });

  useEffect(() => {
    loadLLMConfigs();
    checkOllamaAvailability();
  }, []);

  const loadLLMConfigs = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/llm/config');
      if (response.ok) {
        const configs = await response.json();
        setLlmConfigs(configs);
      }
    } catch (error) {
      console.error('Error loading LLM configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkOllamaAvailability = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/llm/ollama/models');
      const data = await response.json();
      setOllamaAvailable(data.available);
      if (data.available && data.models) {
        setOllamaModels(data.models);
      }
    } catch (error) {
      console.error('Error checking Ollama:', error);
      setOllamaAvailable(false);
    }
  };

  const saveConfig = async () => {
    if (!newConfig.provider || !newConfig.model_name) {
      alert('Provider and model name are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });

      if (response.ok) {
        await loadLLMConfigs();
        setNewConfig({
          provider: 'ollama',
          model_name: '',
          api_key: '',
          api_url: '',
          is_active: false,
          priority: 1
        });
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (id: number) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/llm/config/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadLLMConfigs();
      } else {
        throw new Error('Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Failed to delete configuration');
    }
  };

  const toggleActive = async (config: LLMConfig) => {
    try {
      const response = await fetch('http://localhost:3001/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          is_active: !config.is_active
        })
      });

      if (response.ok) {
        await loadLLMConfigs();
      }
    } catch (error) {
      console.error('Error toggling config:', error);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'ollama':
        return <Server className="h-4 w-4" />;
      case 'openai':
        return <Brain className="h-4 w-4" />;
      case 'gemini':
        return <Brain className="h-4 w-4" />;
      case 'grok':
        return <Brain className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <SettingsIcon className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* LLM Configuration Section */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">LLM Configuration</h2>
        </div>

        {/* Ollama Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span className="font-medium">Ollama Status</span>
            </div>
            <button
              onClick={checkOllamaAvailability}
              className="btn-secondary text-sm flex items-center space-x-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${ollamaAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {ollamaAvailable ? 'Connected' : 'Not available'} 
              {ollamaAvailable && ` (${ollamaModels.length} models)`}
            </span>
          </div>
        </div>

        {/* Current Configurations */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current Configurations</h3>
          {llmConfigs.length === 0 ? (
            <p className="text-sm text-gray-500">No LLM configurations found</p>
          ) : (
            <div className="space-y-2">
              {llmConfigs.map((config) => (
                <div
                  key={config.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    config.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {getProviderIcon(config.provider)}
                    <div>
                      <div className="font-medium">{config.provider}:{config.model_name}</div>
                      {config.api_url && (
                        <div className="text-xs text-gray-500">{config.api_url}</div>
                      )}
                      <div className="text-xs text-gray-500">Priority: {config.priority}</div>
                    </div>
                    {config.is_active && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleActive(config)}
                      className={`text-sm px-3 py-1 rounded ${
                        config.is_active 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {config.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteConfig(config.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Configuration */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add New Configuration</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={newConfig.provider}
                onChange={(e) => setNewConfig({ ...newConfig, provider: e.target.value, model_name: '' })}
                className="input-field"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="grok">Grok (X.AI)</option>
              </select>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              {newConfig.provider === 'ollama' && ollamaAvailable ? (
                <select
                  value={newConfig.model_name}
                  onChange={(e) => setNewConfig({ ...newConfig, model_name: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select a model</option>
                  {ollamaModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newConfig.model_name}
                  onChange={(e) => setNewConfig({ ...newConfig, model_name: e.target.value })}
                  placeholder={
                    newConfig.provider === 'openai' ? 'gpt-4-turbo' :
                    newConfig.provider === 'gemini' ? 'gemini-pro' :
                    newConfig.provider === 'grok' ? 'grok-beta' : 'Model name'
                  }
                  className="input-field"
                />
              )}
            </div>

            {/* API Key (for cloud providers) */}
            {newConfig.provider !== 'ollama' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Key className="h-3 w-3 inline mr-1" />
                  API Key
                </label>
                <input
                  type="password"
                  value={newConfig.api_key}
                  onChange={(e) => setNewConfig({ ...newConfig, api_key: e.target.value })}
                  placeholder="Enter your API key"
                  className="input-field"
                />
              </div>
            )}

            {/* API URL (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API URL (optional)
              </label>
              <input
                type="url"
                value={newConfig.api_url}
                onChange={(e) => setNewConfig({ ...newConfig, api_url: e.target.value })}
                placeholder={
                  newConfig.provider === 'ollama' ? 'http://localhost:11434' : 'Custom API endpoint'
                }
                className="input-field"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority (1 = highest)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={newConfig.priority}
                onChange={(e) => setNewConfig({ ...newConfig, priority: parseInt(e.target.value) || 1 })}
                placeholder="1"
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newConfig.is_active}
                onChange={(e) => setNewConfig({ ...newConfig, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Set as active configuration</span>
            </label>
            
            <button
              onClick={saveConfig}
              disabled={saving || !newConfig.provider || !newConfig.model_name}
              className="btn-primary flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">General Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-700">Auto-generate summaries</label>
              <p className="text-sm text-gray-500">Automatically generate LLM summaries for new articles</p>
            </div>
            <input type="checkbox" className="rounded" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-700">Enhanced newsletter format</label>
              <p className="text-sm text-gray-500">Use LLM-generated summaries in newsletters</p>
            </div>
            <input type="checkbox" className="rounded" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;