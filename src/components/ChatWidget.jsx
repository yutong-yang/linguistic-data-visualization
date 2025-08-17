import React, { useState, useEffect, useRef, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { callGeminiAPI, addChatToHistory, checkAPIStatus, clearChatHistory, getChatHistory } from '../utils/chatUtils';
import { gbFeatures, gbOrangeFeatures, eaFeatures } from '../utils/featureData';
import ReactMarkdown from 'react-markdown';

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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const messagesEndRef = useRef(null);
  const chatWidgetRef = useRef(null);

  // Chat suggestions now come from the language pack
  const suggestions = langs[lang].suggestions;

  // Check API status on mount and when API key changes
  useEffect(() => {
    const status = checkAPIStatus();
    setApiStatus(status);
    
    // 监听localStorage变化，当API Key更新时自动刷新状态
    const handleStorageChange = () => {
      const newStatus = checkAPIStatus();
      setApiStatus(newStatus);
    };
    
    // 监听storage事件
    window.addEventListener('storage', handleStorageChange);
    
    // 监听自定义事件（用于同一页面内的更新）
    window.addEventListener('apiKeyUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('apiKeyUpdated', handleStorageChange);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message and update when language changes
  useEffect(() => {
    if (messages.length === 0) {
      // 根据当前语言显示欢迎消息
      const welcomeMessage = langs[lang].welcome;
      addMessage(welcomeMessage, false);
    }
  }, []);

  // Update welcome message when language changes
  useEffect(() => {
    if (messages.length > 0 && messages[0] && !messages[0].isUser) {
      // 更新第一条消息（欢迎消息）
      setMessages(prev => {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          text: langs[lang].welcome
        };
        return updated;
      });
    }
  }, [lang, langs]);

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
    
    // 提取特征的问题标题
    const getFeatureQuestion = (featureId) => {
      const featureInfo = featureDescriptions[featureId];
      if (!featureInfo?.description) return '';
      const lines = featureInfo.description.split('\n');
      const firstLine = lines[0];
      if (firstLine.startsWith('##')) {
        return firstLine.replace(/^##\s*/, '').trim();
      }
      return featureInfo.description.substring(0, 60) + (featureInfo.description.length > 60 ? '...' : '');
    };
    
    const feature1Question = getFeatureQuestion(feature1);
    const feature2Question = getFeatureQuestion(feature2);
    
    // 用户看到的简洁消息（包含特征问题）
    const userMessage = isChinese 
      ? `请解释相关性 (r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)})：
• ${feature1}${feature1Question ? ` (${feature1Question})` : ''}
• ${feature2}${feature2Question ? ` (${feature2Question})` : ''}`
      : `Please explain correlation (r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)}):
• ${feature1}${feature1Question ? ` (${feature1Question})` : ''}
• ${feature2}${feature2Question ? ` (${feature2Question})` : ''}`;
    
    // 首先从知识库检索两个特征的详细信息
    let knowledgeContext = '';
    try {
      const { checkKnowledgeBaseStatus, buildRAGContext } = await import('../utils/knowledgeBaseUtils');
      const isKnowledgeBaseAvailable = await checkKnowledgeBaseStatus();
      if (isKnowledgeBaseAvailable) {
        // 检索两个特征的相关信息
        const searchQuery = `${feature1} ${feature2} feature definition correlation relationship`;
        knowledgeContext = await buildRAGContext(searchQuery, 10);
      }
    } catch (error) {
      console.warn('知识库检索失败，将使用基础分析:', error);
    }
    
    // 发送给AI的详细提示
    const explanationRequest = isChinese 
      ? `基于数据分析${feature1}和${feature2}的相关性：r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)} (${method}方法)

=== 特征1: ${feature1} ===
${featureDescriptions[feature1]?.description || '数据库中无描述'}

=== 特征2: ${feature2} ===  
${featureDescriptions[feature2]?.description || '数据库中无描述'}

${knowledgeContext ? '=== 知识库相关研究 ===' + knowledgeContext : ''}

**分析要求：**
1. 主要基于上述特征定义、统计结果和知识库进行详细分析
2. 提供全面的语言学解释和理论背景
3. 不推测数据库外的信息，但可基于知识库进行合理推论
4. 回答要详实充分，一般控制在300-400字
5. **结构化格式**：回答必须包含以下JSON结构，放在回答的最后：

\`\`\`json
{
  "feature_pair": ["${feature1}", "${feature2}"],
  "correlation": {
    "coefficient": ${correlation.toFixed(3)},
    "p_value": ${pValue.toFixed(4)},
    "method": "${method}",
    "significance": "${pValue < 0.05 ? '显著' : '不显著'}"
  },
  "summary": "简要总结",
  "statistical_interpretation": "统计解释",
  "feature_relationship": "特征关系分析",
  "typological_significance": "类型学意义",
  "research_evidence": "研究证据",
  "research_value": "研究价值",
  "methodology_suggestions": "方法建议"
}
\`\`\`

**回答格式：**
**统计解释**：[详细解释相关系数和p值的语言学意义]
**特征关系**：[基于定义深入分析两特征的理论关系和可能机制]
**类型学意义**：[解释此关联在跨语言研究中的重要性]
${knowledgeContext ? '**研究证据**：[知识库中的相关理论和实证发现]' : ''}
**研究价值**：[此发现对语言类型学研究的贡献]

**📚 数据来源：**
- 相关性数据：本地数据库实时统计计算
- 特征编号：${feature1}, ${feature2}（来自本地CSV文件）
- 统计方法：${method}方法，r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)}
- 计算基础：当前加载的语言数据集

要求：详实、基于数据和知识库，必须包含完整的JSON结构。`
      : `Analyze correlation based on data: ${feature1} vs ${feature2}, r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)} (${method} method)

=== Feature 1: ${feature1} ===
${featureDescriptions[feature1]?.description || 'No description in database'}

=== Feature 2: ${feature2} ===
${featureDescriptions[feature2]?.description || 'No description in database'}

${knowledgeContext ? '=== Related Research from Knowledge Base ===' + knowledgeContext : ''}

**Analysis Requirements:**
1. Provide detailed analysis based primarily on above feature definitions, statistical results, and knowledge base
2. Include comprehensive linguistic explanations and theoretical background
3. Do not speculate beyond database information, but may make reasonable inferences based on knowledge base
4. Answer should be informative and comprehensive, generally 180-220 words

**Response Format:**
**Statistical Interpretation**: [Detailed explanation of correlation coefficient and p-value linguistic significance]
**Feature Relationship**: [In-depth analysis of theoretical relationship and possible mechanisms between features]
**Typological Significance**: [Explain the importance of this correlation in cross-linguistic research]
${knowledgeContext ? '**Research Evidence**: [Related theories and empirical findings from knowledge base]' : ''}
**Research Value**: [Contribution of this finding to linguistic typology research]

**📚 Data Sources:**
- Correlation Data: Real-time statistical calculation from local database
- Feature Codes: ${feature1}, ${feature2} (from local CSV files)
- Statistical Method: ${method} method, r=${correlation.toFixed(3)}, p=${pValue.toFixed(4)}
- Calculation Basis: Currently loaded language dataset

Requirements: Comprehensive, based on data and knowledge base.`;

    addMessage(userMessage, true);
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
      const response = await callGeminiAPI(explanationRequest, lang);

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
    
    // 用户看到的简洁消息
    const userMessage = isChinese 
      ? `请解释分析方法：${method.name}`
      : `Please explain analysis method: ${method.name}`;
    
    // 发送给AI的详细提示
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

**📚 方法来源：**
- 方法名称：${method.name}
- 分类：${method.category}
- 复杂度：${method.complexity}
- 应用数据：本地Grambank & D-PLACE数据库文件

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

**📚 Method Source:**
- Method Name: ${method.name}
- Category: ${method.category}
- Complexity: ${method.complexity}
- Applied Data: Local Grambank & D-PLACE database files

Use markdown formatting for better readability.`;

    addMessage(userMessage, true);
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
      const response = await callGeminiAPI(methodRequest, lang);

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
    
    // 用户看到的简洁消息
    const userMessage = isChinese 
      ? `请解释语言学概念：${concept.name}`
      : `Please explain linguistic concept: ${concept.name}`;
    
    // 发送给AI的详细提示
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

**📚 概念来源：**
- 概念名称：${concept.name}
- 分类：${concept.category}
- 理论基础：${concept.theories?.join(', ') || '无'}
- 本地数据相关性：${concept.relevance || '无'}

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

**📚 Concept Source:**
- Concept Name: ${concept.name}
- Category: ${concept.category}
- Theoretical Foundation: ${concept.theories?.join(', ') || 'N/A'}
- Local Data Relevance: ${concept.relevance || 'N/A'}

Use markdown formatting for better readability.`;

    addMessage(userMessage, true);
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
      const response = await callGeminiAPI(conceptRequest, lang);

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

  // New method to handle feature explanation requests
  const explainFeature = async (feature) => {
    if (!apiStatus.configured) {
      const errorMsg = lang === 'zh' ? '请配置API Key以获取特征解释。' : 'Please configure your API Key to get feature explanations.';
      addMessage(errorMsg, false);
      onShowApiKeyModal && onShowApiKeyModal();
      return;
    }

    const isChinese = lang === 'zh';
    
    // 提取特征的问题标题（从Description的第一行）
    const getFeatureQuestion = (description) => {
      if (!description) return '';
      const lines = description.split('\n');
      const firstLine = lines[0];
      // 如果第一行以##开头，说明是问题标题
      if (firstLine.startsWith('##')) {
        return firstLine.replace(/^##\s*/, '').trim();
      }
      // 否则返回描述的前100个字符
      return description.substring(0, 100) + (description.length > 100 ? '...' : '');
    };
    
    const featureQuestion = getFeatureQuestion(feature.description);
    
    // 用户看到的简洁消息（包含实际的问题）
    const userMessage = isChinese 
      ? `请解释特征：${feature.id || feature.name}${featureQuestion ? ` (${featureQuestion})` : ''}`
      : `Please explain feature: ${feature.id || feature.name}${featureQuestion ? ` (${featureQuestion})` : ''}`;
    
    // 首先从知识库检索特征的详细信息
    let knowledgeContext = '';
    try {
      const { checkKnowledgeBaseStatus, buildRAGContext } = await import('../utils/knowledgeBaseUtils');
      const isKnowledgeBaseAvailable = await checkKnowledgeBaseStatus();
      if (isKnowledgeBaseAvailable) {
        // 使用特征ID和名称进行检索
        const searchQuery = `${feature.id || ''} ${feature.name || ''} feature definition explanation`;
        knowledgeContext = await buildRAGContext(searchQuery, 10); // 获取更多相关信息
      }
    } catch (error) {
      console.warn('知识库检索失败，将使用基础信息:', error);
    }
    
    // 发送给AI的详细提示
    const featureRequest = isChinese
      ? `基于数据库信息解释特征：${feature.id || feature.name}

=== 数据库中的特征定义 ===
${feature.description ? feature.description : '数据库中未提供描述'}

${knowledgeContext ? '=== 知识库中的相关研究 ===' + knowledgeContext : ''}

**回答要求：**
1. 主要基于上述数据库定义和知识库信息进行详细解释
2. 提供全面的语言学背景和理论意义
3. 如果信息不足，说明"数据库/知识库中未提供此信息"
4. 回答要详实充分，一般控制在300-400字
5. **结构化格式**：回答必须包含以下JSON结构，放在回答的最后：

\`\`\`json
{
  "feature_id": "${feature.id || feature.name}",
  "feature_name": "特征名称",
  "summary": "简要总结",
  "definition": "详细定义解释",
  "classification": "分类归属",
  "measurement": "测量方法",
  "cross_linguistic_distribution": "跨语言分布",
  "theoretical_significance": "理论意义",
  "related_features": ["相关特征1", "相关特征2"],
  "research_applications": "研究应用",
  "knowledge_base_insights": "知识库中的研究发现"
}
\`\`\`

**回答格式：**
**定义**：[详细解释数据库定义的语言学含义]
**分类与测量**：[说明特征的分类归属、编码方式和测量标准]  
**跨语言分布**：[基于知识库描述典型的分布模式]
**理论意义**：[解释该特征在语言类型学中的重要性]
**相关特征**：[可能与之相关的其他语法或社会特征]
${knowledgeContext ? '**研究背景**：[基于知识库的学术研究发现]' : ''}

**📚 数据来源：**
- 数据库：本地Grambank/D-PLACE数据库
- 特征编号：${feature.id || feature.name}（来自本地数据库CSV文件）
- 特征定义：${feature.description ? '来自数据库原始描述' : '数据库中暂无描述'}

要求：详实、准确、基于数据库和知识库，必须包含完整的JSON结构。`
      : `Explain feature based on database information: ${feature.id || feature.name}

=== Database Feature Definition ===
${feature.description ? feature.description : 'No description provided in database'}

${knowledgeContext ? '=== Related Research from Knowledge Base ===' + knowledgeContext : ''}

**Response Requirements:**
1. Provide detailed explanation based primarily on the above database definition and knowledge base information
2. Include comprehensive linguistic background and theoretical significance
3. If information is insufficient, state "not provided in database/knowledge base"
4. Answer should be informative and comprehensive, generally 200-250 words

**Response Format:**
**Definition**: [Detailed explanation of the linguistic meaning of the database definition]
**Classification & Measurement**: [Explain feature's categorical classification, coding method, and measurement standards]
**Cross-linguistic Distribution**: [Describe typical distribution patterns based on knowledge base]
**Theoretical Significance**: [Explain the importance of this feature in linguistic typology]
**Related Features**: [Other grammatical or social features that may be related]
${knowledgeContext ? '**Research Background**: [Based only on knowledge base information]' : ''}

**📚 Data Sources:**
- Database: Local Grambank/D-PLACE database
- Feature Code: ${feature.id || feature.name} (from local database CSV files)
- Feature Definition: ${feature.description ? 'From database original description' : 'No description in database'}

Requirements: Concise, accurate, data-based.`;

    addMessage(userMessage, true);
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = isChinese ? '正在分析特征...' : 'Analyzing feature...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(featureRequest, lang);

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Feature explanation error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = isChinese ? '抱歉，分析特征时遇到错误。' : 'Sorry, I encountered an error while analyzing the feature.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = isChinese ? '请配置API Key以获取特征解释。' : 'Please configure your API Key to get feature explanations.';
        onShowApiKeyModal && onShowApiKeyModal();
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  // New method to handle recommendation explanation requests
  const explainRecommendation = async (recommendation) => {
    if (!apiStatus.configured) {
      const errorMsg = lang === 'zh' ? '请配置API Key以获取推荐解释。' : 'Please configure your API Key to get recommendation explanations.';
      addMessage(errorMsg, false);
      onShowApiKeyModal && onShowApiKeyModal();
      return;
    }

    const isChinese = lang === 'zh';
    
    // 用户看到的简洁消息
    const userMessage = isChinese 
      ? `请解释推荐：${recommendation.name || recommendation.reason}`
      : `Please explain recommendation: ${recommendation.name || recommendation.reason}`;
    
    // 发送给AI的详细提示
    const recommendationRequest = isChinese
      ? `请解释特征推荐：${recommendation.reason}。

推荐特征：${recommendation.features?.join(', ') || '未指定'}
推荐理由：${recommendation.reason || '未提供'}
相关性：${recommendation.correlation || '未知'}

请按以下结构回答：
**推荐理由分析**
- 为什么推荐这些特征
- 理论和经验依据

**特征关联性**
- 特征间的潜在联系
- 语言学理论支持

**研究价值**
- 对当前研究的贡献
- 可能的发现和见解

**实施建议**
- 如何有效使用这些特征
- 分析方法建议

**📚 推荐来源：**
- 推荐特征：${recommendation.features?.join(', ') || '未指定'}
- 推荐理由：${recommendation.reason || '未提供'}
- 相关性评分：${recommendation.correlation || '未知'}
- 数据来源：本地Grambank & D-PLACE数据库文件

请使用markdown格式以提高可读性。`
      : `Please explain the feature recommendation: ${recommendation.reason}.

Recommended features: ${recommendation.features?.join(', ') || 'Not specified'}
Recommendation reason: ${recommendation.reason || 'Not provided'}
Correlation: ${recommendation.correlation || 'Unknown'}

Please structure your response with:
**Recommendation Analysis**
- Why these features are recommended
- Theoretical and empirical basis

**Feature Relationships**
- Potential connections between features
- Linguistic theory support

**Research Value**
- Contribution to current research
- Possible discoveries and insights

**Implementation Suggestions**
- How to effectively use these features
- Analysis method recommendations

**📚 Recommendation Source:**
- Recommended Features: ${recommendation.features?.join(', ') || 'Not specified'}
- Recommendation Reason: ${recommendation.reason || 'Not provided'}
- Correlation Score: ${recommendation.correlation || 'Unknown'}
- Data Source: Local Grambank & D-PLACE database files

Use markdown formatting for better readability.`;

    addMessage(userMessage, true);
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = isChinese ? '正在分析推荐...' : 'Analyzing recommendation...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(recommendationRequest, lang);

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);

    } catch (error) {
      console.error('Recommendation explanation error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = isChinese ? '抱歉，分析推荐时遇到错误。' : 'Sorry, I encountered an error while analyzing the recommendation.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = isChinese ? '请配置API Key以获取推荐解释。' : 'Please configure your API Key to get recommendation explanations.';
        onShowApiKeyModal && onShowApiKeyModal();
      }
      addMessage(errorMessage, false);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose all explanation methods through global functions
  useEffect(() => {
    window.explainCorrelation = (feature1, feature2, correlation, pValue, method) => {
      explainCorrelation(feature1, feature2, correlation, pValue, method);
    };
    window.explainMethod = (method) => {
      explainMethod(method);
    };
    window.explainConcept = (concept) => {
      explainConcept(concept);
    };
    window.explainFeature = (feature) => {
      explainFeature(feature);
    };
    window.explainRecommendation = (recommendation) => {
      explainRecommendation(recommendation);
    };
    return () => {
      delete window.explainCorrelation;
      delete window.explainMethod;
      delete window.explainConcept;
      delete window.explainFeature;
      delete window.explainRecommendation;
    };
  }, [explainCorrelation, explainMethod, explainConcept, explainFeature, explainRecommendation]);

  // Handle chat input
  const handleChatInput = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    addMessage(message, true);
    setInputValue('');
    setIsLoading(true);

    const loadingMessageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const loadingText = lang === 'zh' ? '正在分析您的问题...' : 'Analyzing your question...';
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      text: loadingText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const response = await callGeminiAPI(message, lang);

      // Remove loading message and add AI response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      addMessage(response, false);
      
      // 添加到聊天历史记录
      addChatToHistory(message, response);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      let errorMessage = lang === 'zh' ? '抱歉，处理您的请求时遇到错误。' : 'Sorry, I encountered an error while processing your request.';
      if (error.message === 'API_KEY_NOT_SET') {
        errorMessage = lang === 'zh' ? '请配置API Key以使用AI助手。' : 'Please configure your API Key to use the AI assistant.';
        onShowApiKeyModal && onShowApiKeyModal();
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
  };

  const handleClearHistory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 清除聊天历史
    clearChatHistory();
    
    // 清除UI中的消息
    setMessages([{
      id: `welcome-${Date.now()}`,
      text: langs[lang].welcome,
      isUser: false,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleShowHistory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowHistoryModal(true);
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
            onClick={handleShowHistory}
            title={lang === 'zh' ? '查看对话历史' : 'View chat history'}
            className="chat-toggle-btn"
            style={{ marginRight: '8px' }}
          >
            📜
          </button>
          <button
            onClick={handleClearHistory}
            title={lang === 'zh' ? '清除对话历史' : 'Clear chat history'}
            className="chat-toggle-btn"
            style={{ marginRight: '8px' }}
          >
            🗑️
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
                {message.isUser ? (
                  <div>{message.text}</div>
                ) : (
                  <ReactMarkdown 
                    components={{
                      // 自定义代码块样式
                      code: ({node, inline, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <pre style={{
                            background: '#f6f8fa',
                            padding: '12px',
                            borderRadius: '6px',
                            overflow: 'auto',
                            fontSize: '12px',
                            border: '1px solid #e1e4e8'
                          }}>
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      // 自定义JSON代码块样式
                      pre: ({children}) => (
                        <pre style={{
                          background: '#f6f8fa',
                          padding: '12px',
                          borderRadius: '6px',
                          overflow: 'auto',
                          fontSize: '12px',
                          border: '1px solid #e1e4e8',
                          margin: '8px 0'
                        }}>
                          {children}
                        </pre>
                      )
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                )}
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
      
      {/* 历史记录模态框 */}
      {showHistoryModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '80%',
            maxHeight: '80%',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #eee',
              paddingBottom: '10px'
            }}>
              <h3 style={{ margin: 0, color: '#333' }}>
                {lang === 'zh' ? '对话历史' : 'Chat History'}
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>
            
            <div className="history-content" style={{ minHeight: '200px' }}>
              {getChatHistory().length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                  {lang === 'zh' ? '暂无对话历史' : 'No chat history'}
                </p>
              ) : (
                getChatHistory().map((item, index) => (
                  <div key={index} style={{
                    marginBottom: '20px',
                    padding: '15px',
                    border: '1px solid #eee',
                    borderRadius: '6px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#2c7c6c'
                    }}>
                      {lang === 'zh' ? '用户：' : 'User: '}
                    </div>
                    <div style={{
                      marginBottom: '15px',
                      padding: '10px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      borderLeft: '4px solid #2196f3'
                    }}>
                      {item.user}
                    </div>
                    
                    <div style={{
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#f57c00'
                    }}>
                      {lang === 'zh' ? 'AI助手：' : 'AI Assistant: '}
                    </div>
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#f3e5f5',
                      borderRadius: '4px',
                      borderLeft: '4px solid #9c27b0',
                      lineHeight: '1.5'
                    }}>
                      {item.assistant}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget; 