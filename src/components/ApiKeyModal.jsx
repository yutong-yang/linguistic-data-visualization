import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { saveAPIKey, getAPIKey, getSelectedAPIProvider, setSelectedAPIProvider } from '../utils/chatUtils';

const ApiKeyModal = ({ isVisible, onClose, onApiKeySet }) => {
  const { lang, langs } = useContext(DataContext);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('gemini');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const provider = getSelectedAPIProvider();
      setApiProvider(provider);
      const existingKey = getAPIKey(provider);
      setApiKey(existingKey || '');
    }
  }, [isVisible]);

  const handleProviderChange = (provider) => {
    setApiProvider(provider);
    const existingKey = getAPIKey(provider);
    setApiKey(existingKey || '');
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      const errorMsg = lang === 'zh' ? '请输入有效的API密钥' : 'Please enter a valid API key';
      alert(errorMsg);
      return;
    }

    setIsSaving(true);
    try {
      saveAPIKey(apiKey.trim(), apiProvider);
      setSelectedAPIProvider(apiProvider);
      onApiKeySet && onApiKeySet();
      onClose();
    } catch (error) {
      console.error('Error saving API key:', error);
      const errorMsg = lang === 'zh' ? '保存API密钥时出错，请重试' : 'Error saving API key. Please try again.';
      alert(errorMsg);
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
            <label htmlFor="api-provider-select">
              {lang === 'zh' ? 'API提供商' : 'API Provider'}:
            </label>
            <select
              id="api-provider-select"
              value={apiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="form-control"
              style={{ marginBottom: '12px' }}
            >
              <option value="gemini">Google Gemini</option>
              <option value="qianwen">通义千问 (Qianwen)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="api-key-input">{langs[lang].apiKey}:</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiProvider === 'qianwen' 
                ? (lang === 'zh' ? '请输入通义千问API密钥' : 'Enter Qianwen API Key')
                : langs[lang].apiKeyPlaceholder
              }
              className="form-control"
            />
          </div>
          
          <div className="api-key-info">
            <p><strong>{langs[lang].apiKeyDesc}</strong></p>
            <ul>
              {apiProvider === 'gemini' ? (
                <>
                  <li>{langs[lang].apiKeyNote1}</li>
                  <li>{langs[lang].apiKeyNote2}<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">{langs[lang].apiKeyGet}</a></li>
                  <li>{langs[lang].apiKeyNote3}</li>
                </>
              ) : (
                <>
                  <li>{lang === 'zh' ? '通义千问是阿里巴巴开发的大语言模型' : 'Qianwen is a large language model developed by Alibaba'}</li>
                  <li>
                    {lang === 'zh' ? '获取API密钥：' : 'Get API Key: '}
                    <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener noreferrer">
                      {lang === 'zh' ? '阿里云DashScope控制台' : 'Alibaba Cloud DashScope Console'}
                    </a>
                  </li>
                  <li>{lang === 'zh' ? 'API密钥将安全存储在本地浏览器中' : 'API key will be securely stored in your local browser'}</li>
                </>
              )}
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