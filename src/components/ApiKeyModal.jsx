import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { saveAPIKey, getAPIKey } from '../utils/chatUtils';

const ApiKeyModal = ({ isVisible, onClose, onApiKeySet }) => {
  const { lang, langs } = useContext(DataContext);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const existingKey = getAPIKey();
      setApiKey(existingKey || '');
    }
  }, [isVisible]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('Please enter a valid API key');
      return;
    }

    setIsSaving(true);
    try {
      saveAPIKey(apiKey.trim());
      onApiKeySet && onApiKeySet();
      onClose();
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Error saving API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setApiKey('');
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{langs[lang].apiKeyTitle}</h3>
          <button onClick={handleCancel} className="modal-close">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="api-key-input">{langs[lang].apiKey}:</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={langs[lang].apiKeyPlaceholder}
              className="form-control"
            />
          </div>
          
          <div className="api-key-info">
            <p><strong>{langs[lang].apiKeyDesc}</strong></p>
            <ul>
              <li>{langs[lang].apiKeyNote1}</li>
              <li>{langs[lang].apiKeyNote2}<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">{langs[lang].apiKeyGet}</a></li>
              <li>{langs[lang].apiKeyNote3}</li>
            </ul>
          </div>
        </div>
        
        <div className="modal-footer">
          <button
            onClick={handleSave}
            disabled={isSaving || !apiKey.trim()}
            className="btn btn-primary"
          >
            {isSaving ? 'Saving...' : langs[lang].apiKeySave}
          </button>
          <button onClick={handleCancel} className="btn btn-secondary">
            {langs[lang].apiKeyCancel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal; 