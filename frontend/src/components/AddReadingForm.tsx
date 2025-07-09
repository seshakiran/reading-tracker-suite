import React, { useState, useEffect } from 'react';
import { Plus, Save, X, Tag } from 'lucide-react';
import { createSession, getTags } from '../services/api.ts';
import { Tag as TagType, NewSession } from '../types/index.ts';

interface AddReadingFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AddReadingForm: React.FC<AddReadingFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<NewSession>({
    title: '',
    url: '',
    content_type: 'manual',
    reading_time: 0,
    word_count: 0,
    excerpt: '',
    notes: '',
    tags: []
  });
  
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await getTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleInputChange = (field: keyof NewSession, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagToggle = (tagName: string) => {
    const currentTags = formData.tags || [];
    const isSelected = currentTags.includes(tagName);
    
    const newTags = isSelected
      ? currentTags.filter(tag => tag !== tagName)
      : [...currentTags, tagName];
    
    handleInputChange('tags', newTags);
  };

  const handleAddNewTag = () => {
    if (newTag.trim() && formData.tags && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }

      await createSession(formData);
      
      // Reset form
      setFormData({
        title: '',
        url: '',
        content_type: 'manual',
        reading_time: 0,
        word_count: 0,
        excerpt: '',
        notes: '',
        tags: []
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setError(error instanceof Error ? error.message : 'Failed to save reading session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Plus className="h-6 w-6 mr-2 text-blue-600" />
            Add Reading Session
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              className="input w-full"
              placeholder="What did you read?"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
            />
          </div>

          {/* URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              URL (optional)
            </label>
            <input
              type="url"
              id="url"
              className="input w-full"
              placeholder="https://example.com/article"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
            />
          </div>

          {/* Content Type */}
          <div>
            <label htmlFor="content_type" className="block text-sm font-medium text-gray-700 mb-2">
              Content Type
            </label>
            <select
              id="content_type"
              className="input w-full"
              value={formData.content_type}
              onChange={(e) => handleInputChange('content_type', e.target.value)}
            >
              <option value="manual">Manual Entry</option>
              <option value="web">Web Article</option>
              <option value="pdf">PDF Document</option>
              <option value="epub">eBook</option>
            </select>
          </div>

          {/* Reading Time and Word Count */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reading_time" className="block text-sm font-medium text-gray-700 mb-2">
                Reading Time (minutes)
              </label>
              <input
                type="number"
                id="reading_time"
                className="input w-full"
                placeholder="0"
                min="0"
                value={formData.reading_time}
                onChange={(e) => handleInputChange('reading_time', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label htmlFor="word_count" className="block text-sm font-medium text-gray-700 mb-2">
                Word Count (estimated)
              </label>
              <input
                type="number"
                id="word_count"
                className="input w-full"
                placeholder="0"
                min="0"
                value={formData.word_count}
                onChange={(e) => handleInputChange('word_count', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt or Summary
            </label>
            <textarea
              id="excerpt"
              rows={3}
              className="input w-full"
              placeholder="Brief excerpt or summary of what you read..."
              value={formData.excerpt}
              onChange={(e) => handleInputChange('excerpt', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Personal Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="input w-full"
              placeholder="Your thoughts, takeaways, or notes..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Tag className="h-4 w-4 mr-1" />
              Tags
            </label>
            
            {/* Available Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.name)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    formData.tags?.includes(tag.name)
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{
                    backgroundColor: formData.tags?.includes(tag.name) ? tag.color + '20' : undefined,
                    borderColor: formData.tags?.includes(tag.name) ? tag.color : undefined
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {/* Add New Tag */}
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add new tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddNewTag}
                className="btn btn-secondary px-4"
                disabled={!newTag.trim()}
              >
                Add
              </button>
            </div>

            {/* Selected Tags */}
            {formData.tags && formData.tags.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Selected tags:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tagName) => (
                    <span
                      key={tagName}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md flex items-center"
                    >
                      {tagName}
                      <button
                        type="button"
                        onClick={() => handleTagToggle(tagName)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="btn btn-primary flex-1 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Reading Session
                </>
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary px-6"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddReadingForm;