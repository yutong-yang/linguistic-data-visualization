import React, { useState, useEffect, useRef, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { callGeminiAPI, addChatToHistory, checkAPIStatus } from '../utils/chatUtils';
import { gbFeatures, gbOrangeFeatures, eaFeatures } from '../utils/featureData';

const ChatWidget = ({ onShowApiKeyModal }) => {
  const {
    languageData,
    featureDescriptions,
    selectedEAFeatures,
    selectedGBFeatures,
    lang,
    langs
  } = useContext(DataContext);

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [apiStatus, setApiStatus] = useState({ configured: false, hasKey: false });
  const [isResizing, setIsResizing] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const messagesEndRef = useRef(null);
  const chatWidgetRef = useRef(null);

  // Chat suggestions now come from the language pack
  const suggestions = langs[lang].suggestions;

  // Check API status on mount and when API key changes
  useEffect(() => {
    const status = checkAPIStatus();
    setApiStatus(status);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message only once on mount
  useEffect(() => {
    if (messages.length === 0) {
      // 同时显示中英文欢迎消息
      const welcomeMessage = `${langs.zh.welcome}\n\n${langs.en.welcome}`;
      addMessage(welcomeMessage, false);
    }
  }, []); // Only run once on mount

  const addMessage = (text, isUser = false) => {
    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      isUser,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newMessage]);

    if (!isUser) {
      addChatToHistory(isUser ? text : '', text);
    }
  };

  // New method to handle correlation explanation requests
  const explainCorrelation = async (feature1, feature2, correlation, pValue, method) => {
    if (!apiStatus.configured) {
      const errorMsg = lang === 'zh' ? '请配置API Key以获取相关性解释。' : 'Please configure your API Key to get correlation explanations.';
      addMessage(errorMsg, false);
      onShowApiKeyModal && onShowApiKeyModal();
      return;
    }

    const isChinese = lang === 'zh';
    const explanationRequest = isChinese 
      ? `请解释${feature1}和${feature2}之间的相关性。相关系数为${correlation.toFixed(3)}（${method}方法），p值为${pValue.toFixed(4)}。

请按以下结构回答：
**相关性分析**
- 统计显著性和解释
- 语言学意义和含义

**可能的解释**
- 理论背景
- 跨语言模式
- 地域或遗传因素

**建议**
- 进一步分析建议
- 相关特征调查

请使用markdown格式以提高可读性。`
      : `Please explain the correlation between ${feature1} and ${feature2}. The correlation coefficient is ${correlation.toFixed(3)} (${method} method) with p-value ${pValue.toFixed(4)}.

Please structure your response with:
**Correlation Analysis**
- Statistical significance and interpretation
- Linguistic meaning and implications

**Possible Explanations**
- Theoretical background
- Cross-linguistic patterns
- Areal or genetic factors

**Recommendations**
- Further analysis suggestions
- Related features to investigate

Use markdown formatting for better readability.`;

    addMessage(explanationRequest, true);
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = isChinese ? '正在分析相关性...' : 'Analyzing correlation...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(
        explanationRequest,
        languageData,
        featureDescriptions,
        selectedEAFeatures,
        selectedGBFeatures,
        gbFeatures,
        gbOrangeFeatures,
        eaFeatures,
        lang
      );

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Correlation explanation error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = isChinese ? '抱歉，分析相关性时遇到错误。' : 'Sorry, I encountered an error while analyzing the correlation.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = isChinese ? '请配置API Key以获取相关性解释。' : 'Please configure your API Key to get correlation explanations.';
        onShowApiKeyModal && onShowApiKeyModal();
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  // New method to handle method explanation requests
  const explainMethod = async (method) => {
    if (!apiStatus.configured) {
      const errorMsg = lang === 'zh' ? '请配置API Key以获取方法解释。' : 'Please configure your API Key to get method explanations.';
      addMessage(errorMsg, false);
      onShowApiKeyModal && onShowApiKeyModal();
      return;
    }

    const isChinese = lang === 'zh';
    const methodRequest = isChinese
      ? `请解释语言学分析方法：${method.name}。
    
方法详情：
- 描述：${method.description}
- 分类：${method.category}
- 复杂度：${method.complexity}
- 用途：${method.useCase}

请按以下结构回答：
**方法概述**
- 核心概念和理论背景
- 语言学意义

**数据集应用**
- 如何与当前数据实施
- 预期见解和结果

**实施指南**
- 逐步方法
- 所需工具和考虑因素

**理论背景**
- 相关语言学理论
- 跨语言应用

请使用markdown格式以提高可读性。`
      : `Please explain the linguistic analysis method: ${method.name}. 
    
Method details:
- Description: ${method.description}
- Category: ${method.category}
- Complexity: ${method.complexity}
- Use case: ${method.useCase}

Please structure your response with:
**Method Overview**
- Core concepts and theoretical background
- Linguistic significance

**Application to Dataset**
- How to implement with current data
- Expected insights and outcomes

**Implementation Guide**
- Step-by-step approach
- Required tools and considerations

**Theoretical Context**
- Related linguistic theories
- Cross-linguistic applications

Use markdown formatting for better readability.`;

    addMessage(methodRequest, true);
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = isChinese ? '正在分析方法...' : 'Analyzing method...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(
        methodRequest,
        languageData,
        featureDescriptions,
        selectedEAFeatures,
        selectedGBFeatures,
        gbFeatures,
        gbOrangeFeatures,
        eaFeatures,
        lang
      );

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Method explanation error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = isChinese ? '抱歉，分析方法时遇到错误。' : 'Sorry, I encountered an error while analyzing the method.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = isChinese ? '请配置API Key以获取方法解释。' : 'Please configure your API Key to get method explanations.';
        onShowApiKeyModal && onShowApiKeyModal();
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  // New method to handle concept explanation requests
  const explainConcept = async (concept) => {
    if (!apiStatus.configured) {
      const errorMsg = lang === 'zh' ? '请配置API Key以获取概念解释。' : 'Please configure your API Key to get concept explanations.';
      addMessage(errorMsg, false);
      onShowApiKeyModal && onShowApiKeyModal();
      return;
    }

    const isChinese = lang === 'zh';
    const conceptRequest = isChinese
      ? `请解释语言学概念：${concept.name}。
    
概念详情：
- 描述：${concept.description}
- 分类：${concept.category}
- 例子：${concept.examples?.join(', ') || '无'}
- 主要理论：${concept.theories?.join(', ') || '无'}
- 与数据的相关性：${concept.relevance || '无'}

请按以下结构回答：
**概念定义**
- 核心含义和语言学意义
- 理论框架

**跨语言模式**
- 例子和类型学分布
- 地域和遗传因素

**分析应用**
- 与当前数据集的关系
- 类型学研究的见解

**研究背景**
- 历史发展
- 当前研究方向

请使用markdown格式以提高可读性。`
      : `Please explain the linguistic concept: ${concept.name}. 
    
Concept details:
- Description: ${concept.description}
- Category: ${concept.category}
- Examples: ${concept.examples?.join(', ') || 'N/A'}
- Key Theories: ${concept.theories?.join(', ') || 'N/A'}
- Relevance to our data: ${concept.relevance || 'N/A'}

Please structure your response with:
**Concept Definition**
- Core meaning and linguistic significance
- Theoretical framework

**Cross-Linguistic Patterns**
- Examples and typological distribution
- Areal and genetic factors

**Application to Analysis**
- How it relates to current dataset
- Insights for typological research

**Research Context**
- Historical development
- Current research directions

Use markdown formatting for better readability.`;

    addMessage(conceptRequest, true);
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = isChinese ? '正在分析概念...' : 'Analyzing concept...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(
        conceptRequest,
        languageData,
        featureDescriptions,
        selectedEAFeatures,
        selectedGBFeatures,
        gbFeatures,
        gbOrangeFeatures,
        eaFeatures,
        lang
      );

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Concept explanation error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = isChinese ? '抱歉，分析概念时遇到错误。' : 'Sorry, I encountered an error while analyzing the concept.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = isChinese ? '请配置API Key以获取概念解释。' : 'Please configure your API Key to get concept explanations.';
        onShowApiKeyModal && onShowApiKeyModal();
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the explainCorrelation, explainMethod, and explainConcept methods through global functions
  useEffect(() => {
    window.explainCorrelation = explainCorrelation;
    window.explainMethod = explainMethod;
    window.explainConcept = explainConcept;
    return () => {
      delete window.explainCorrelation;
      delete window.explainMethod;
      delete window.explainConcept;
    };
  }, [apiStatus.configured, languageData, featureDescriptions, selectedEAFeatures, selectedGBFeatures]);

  // Handle chat input
  const handleChatInput = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    addMessage(message, true);
    setInputValue('');
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: 'Analyzing your question...',
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(
        message,
        languageData,
        featureDescriptions,
        selectedEAFeatures,
        selectedGBFeatures,
        gbFeatures,
        gbOrangeFeatures,
        eaFeatures
      );

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = 'Sorry, I encountered an error while processing your request.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = 'Please configure your API Key to use the AI assistant.';
        onShowApiKeyModal && onShowApiKeyModal();
        // Update API status after showing modal
        setTimeout(() => {
          const status = checkAPIStatus();
          setApiStatus(status);
        }, 100);
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatInput();
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleShowApiKeyModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onShowApiKeyModal && onShowApiKeyModal();
    // Update API status after showing modal
    setTimeout(() => {
      const status = checkAPIStatus();
      setApiStatus(status);
    }, 100);
  };

  // 拖拽调整大小功能
  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) {
      e.preventDefault();
      setIsResizing(true);
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = chatWidgetRef.current.offsetWidth;
      const startHeight = chatWidgetRef.current.offsetHeight;
      
      const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(300, Math.min(600, startWidth - deltaX));
        const newHeight = Math.max(400, Math.min(700, startHeight - deltaY));
        
        chatWidgetRef.current.style.width = `${newWidth}px`;
        chatWidgetRef.current.style.height = `${newHeight}px`;
      };
      
      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // 处理来源链接点击
  const handleSourceLinkClick = (sourcePath) => {
    if (sourcePath.startsWith('source://')) {
      const actualPath = sourcePath.replace('source://', '');
      console.log('点击了来源链接:', actualPath);
      
      // 这里可以添加更多功能，比如：
      // 1. 打开文件预览
      // 2. 显示详细信息
      // 3. 下载文件
      // 4. 在知识库中搜索相关内容
      
      // 临时显示提示
      const message = `来源文件: ${actualPath.split('/').pop()}`;
      addMessage(message, false);
    }
  };

  // 处理消息文本中的链接
  const processMessageText = (text) => {
    if (!text) return '';
    
    // 将markdown链接转换为可点击的链接
    const linkRegex = /\[([^\]]+)\]\(source:\/\/[^)]+\)/g;
    let processedText = text;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const linkText = match[1];
      const sourcePath = fullMatch.match(/source:\/\/[^)]+/)[0];
      const replacement = `<a href="#" class="source-link" data-source="${sourcePath}" style="color: #007bff; text-decoration: underline; cursor: pointer;">${linkText}</a>`;
      processedText = processedText.replace(fullMatch, replacement);
    }
    
    return processedText;
  };

  return (
    <div
      ref={chatWidgetRef}
      id="chat-widget"
      className={`chat-widget ${isMinimized ? 'minimized' : ''}`}
      onMouseDown={handleMouseDown}
    >
      {/* Title bar */}
      <div
        className="chat-widget-header"
        onClick={toggleMinimize}
      >
        <span className="chat-widget-title">
          {langs[lang].chatTitle}
        </span>
        <div className="chat-widget-controls">
          <span
            id="api-status"
            className={apiStatus.configured ? 'configured' : ''}
          >
            {apiStatus.configured ? 'API: Configured' : 'API: Not Configured'}
          </span>
          <button
            id="api-key-btn"
            onClick={handleShowApiKeyModal}
            title="设置API Key"
            className="chat-toggle-btn"
            style={{ marginRight: '8px' }}
          >
            🔑
          </button>
          <button
            id="chat-toggle"
            className="chat-toggle-btn"
          >
            {isMinimized ? '+' : '−'}
          </button>
        </div>
      </div>

      {/* Chat content area */}
      {!isMinimized && (
        <div id="chat-widget-content" className="chat-widget-content">
          {/* Messages list */}
          <div id="chat-messages" className="chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.isUser ? 'user' : 'assistant'}`}
              >
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: message.isUser ? message.text : processMessageText(message.text) 
                  }}
                  onClick={(e) => {
                    if (e.target.classList.contains('source-link')) {
                      e.preventDefault();
                      const sourcePath = e.target.getAttribute('data-source');
                      handleSourceLinkClick(sourcePath);
                    }
                  }}
                />
                <div style={{ fontSize: '10px', color: message.isUser ? 'rgba(255,255,255,0.7)' : '#999', marginTop: '4px' }}>
                  {message.timestamp}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-container">
            <input
              id="chat-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about language features..."
              disabled={isLoading}
              className="chat-input"
            />
            <button
              id="send-chat"
              onClick={handleChatInput}
              disabled={isLoading || !inputValue.trim()}
              className="chat-send-btn"
            >
              {isLoading ? 'Sending...' : langs[lang].send}
            </button>
          </div>

          {/* Suggestion buttons */}
          <div className="chat-suggestions">
            {(showAllSuggestions ? suggestions : suggestions.slice(0, 6)).map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-btn"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
            {suggestions.length > 6 && (
              <button
                className="suggestion-btn"
                onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                style={{ 
                  background: '#2c7c6c', 
                  color: 'white',
                  borderColor: '#2c7c6c'
                }}
              >
                {showAllSuggestions ? '收起' : '更多...'}
              </button>
            )}
          </div>
          
          {/* Resize handle */}
          <div className="resize-handle" />
        </div>
      )}
    </div>
  );
};

export default ChatWidget; 