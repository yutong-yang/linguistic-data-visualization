// 聊天历史记录
let chatHistory = [];

// 导入知识库工具
import { buildRAGContext, checkKnowledgeBaseStatus } from './knowledgeBaseUtils.js';

// 获取数据集统计信息
export function getDatasetStats(languageData, gbFeatures, gbOrangeFeatures, eaFeatures) {
  if (!languageData || languageData.length === 0) return null;
  
  const stats = {
    totalLanguages: languageData.length,
    features: {
      gender: gbFeatures.length,
      classifier: gbOrangeFeatures.length,
      social: eaFeatures.filter(f => f.startsWith('EA')).length,
      natural: eaFeatures.filter(f => f.includes('Richness')).length
    },
    regions: [...new Set(languageData.map(d => d.region).filter(Boolean))],
    families: [...new Set(languageData.map(d => d.Family_level_ID).filter(Boolean))]
  };
  
  return stats;
}

// 调用千问 API（通过后端代理，避免CORS问题）
export async function callQianwenAPI(userMessage, lang = 'en') {
  try {
    // 检查API Key是否设置（用于提示用户）
    const API_KEY = localStorage.getItem('QIANWEN_API_KEY');
    if (!API_KEY) {
      throw new Error('API_KEY_NOT_SET');
    }
    
    // 构建提示词（与Gemini相同的逻辑）
    const prompt = await buildPrompt(userMessage, lang);
    
    // 通过后端代理调用千问API（避免CORS问题）
    const { buildApiUrl } = await import('../config/api.js');
    const API_URL = buildApiUrl('/api/qianwen/chat');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY  // 通过请求头传递API Key（如果后端环境变量未设置）
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'qwen-turbo', // 或 'qwen-plus', 'qwen-max' 等
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { detail: errorText };
      }
      console.error('Qianwen API Error Response:', errorData);
      throw new Error(`API request failed: ${response.status} - ${errorData.detail || errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.success && data.content) {
      return data.content;
    } else {
      console.error('Unexpected Qianwen API response structure:', data);
      throw new Error('Unexpected API response structure');
    }
    
  } catch (error) {
    console.error('Error calling Qianwen API:', error);
    
    if (error.message === 'API_KEY_NOT_SET') {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const isChinese = lang === 'zh';
    
    // 如果是网络错误，提示检查后端服务
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return isChinese ? 
        `无法连接到后端服务。请确保后端服务正在运行（python api.py）。如果后端服务已启动，请检查API配置。` :
        `Unable to connect to backend service. Please ensure the backend service is running (python api.py). If the backend is running, please check the API configuration.`;
    }
    
    return isChinese ? 
      `抱歉，调用千问AI服务时出错：${error.message}。请检查后端服务状态和API配置。` :
      `Sorry, error calling Qianwen AI service: ${error.message}. Please check backend service status and API configuration.`;
  }
}

// 构建提示词（提取为公共函数，供Gemini和千问共用）
async function buildPrompt(userMessage, lang = 'en') {
  // 特殊处理：如果用户问的是特定特征（如GB057），先从数据库查找
  let specificFeatureInfo = '';
  let relatedFeatures = '';
  
  const featureMatch = userMessage.match(/\b(GB\d+|EA\d+)\b/i);
  if (featureMatch) {
    try {
      const { searchFeatureDescriptions, cleanDescription } = await import('./databaseExplorer.js');
      const featureId = featureMatch[0].toUpperCase();
      
      // 搜索特征信息
      const searchResults = await searchFeatureDescriptions(featureId, 10);
      const exactMatch = searchResults.find(f => f.id === featureId);
      
      if (exactMatch) {
        specificFeatureInfo = `\n=== 数据库中的特征信息 ===\n${featureId}: ${exactMatch.name}\n分类: ${exactMatch.category}\n描述: ${exactMatch.description}\n来源: ${exactMatch.source}`;
      }
    } catch (error) {
      console.warn('特征搜索失败:', error);
    }
  }
  
  // 检测用户是否要求提出假设
  const requiresHypothesis = /假设|hypothesis|提出.*假设|提出.*假说|研究假设/i.test(userMessage);
  
  // 如果用户询问推荐特征或寻找特定类型的特征，进行关键词搜索
  const recommendKeywords = [
    // 中文关键词
    '推荐', '相关', '特征', '特征有哪些', '什么特征', '哪些特征', '特征是什么', '特征介绍', '特征说明',
    '语法', '语法特征', '语法功能', '语法标记', '语法系统',
    '时态', '语气', '语态', '体貌', '否定', '疑问', '命令', '祈使',
    '名词', '动词', '形容词', '代词', '数词', '量词', '介词', '连词',
    '词序', '语序', '词形', '词缀', '前缀', '后缀', '中缀', '屈折',
    '分类', '类别', '性别', '数', '格', '人称', '一致', '标记',
    '社会', '文化', '环境', '人口', '经济', '政治', '宗教', '亲属',
    
    // 英文关键词
    'recommend', 'related', 'features', 'feature', 'what', 'which', 'how', 'can', 'does', 'is there',
    'grammar', 'grammatical', 'syntax', 'morphology', 'phonology', 'semantics',
    'tense', 'aspect', 'mood', 'voice', 'negation', 'interrogative', 'imperative',
    'noun', 'verb', 'adjective', 'pronoun', 'numeral', 'classifier', 'preposition', 'conjunction',
    'word order', 'morphological', 'affix', 'prefix', 'suffix', 'infix', 'inflection',
    'class', 'category', 'gender', 'number', 'case', 'person', 'agreement', 'marking',
    'social', 'cultural', 'environmental', 'demographic', 'economic', 'political', 'religious', 'kinship'
  ];
  
  // 更智能的判断：如果包含特征相关词汇，或者问的是"what are"、"which"等疑问句，就认为是特征查询
  const isRecommendationQuery = recommendKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword.toLowerCase())
  ) || 
  /what\s+(are|is|can|does)/i.test(userMessage) ||
  /which\s+(features?|parameters?|properties?)/i.test(userMessage) ||
  /how\s+(many|much)/i.test(userMessage) ||
  /features?\s+(related|about|for|of)/i.test(userMessage);
  
  let validFeatureIds = '';
  if (isRecommendationQuery) {
    try {
      const { searchFeatureDescriptions, getAllFeatureIds, cleanDescription } = await import('./databaseExplorer.js');
      
      // 获取所有真实存在的特征编号
      const allIds = await getAllFeatureIds();
      validFeatureIds = `\n=== 真实存在的特征编号（仅使用这些）===\nGrambank特征: ${allIds.grambank.slice(0, 20).join(', ')}... (共${allIds.grambank.length}个)\nD-PLACE特征: ${allIds.dplace.slice(0, 20).join(', ')}... (共${allIds.dplace.length}个)`;
      
      // 从用户消息中提取关键词进行搜索 - 使用与左侧特征推荐相同的方法
      // 增加搜索数量，确保找到所有相关特征
      const searchResults = await searchFeatureDescriptions(userMessage, 50);
      
      if (searchResults.length > 0) {
        // 显示所有搜索结果（最多50个），确保LLM能看到所有相关特征
        const displayCount = Math.min(searchResults.length, 50);
        relatedFeatures = `\n=== 相关特征推荐（直接来自数据库CSV文件，共找到${searchResults.length}个相关特征）===\n${searchResults.slice(0, displayCount).map(feature => 
          `${feature.id} (${feature.source}): ${feature.name}\n  分类: ${feature.category}\n  描述: ${cleanDescription ? cleanDescription(feature.description).substring(0, 200) : feature.description?.substring(0, 200) || ''}...`
        ).join('\n\n')}${searchResults.length > displayCount ? `\n\n...还有${searchResults.length - displayCount}个相关特征未显示` : ''}`;
      }
    } catch (error) {
      console.warn('特征推荐搜索失败:', error);
    }
  }
  
  // 搜索后端知识库
  let knowledgeContext = '';
  try {
    const { searchKnowledgeBase } = await import('./knowledgeBaseUtils.js');
    // 增加搜索结果数量，让AI获得更全面的信息
    const searchResults = await searchKnowledgeBase(userMessage, 10);
    
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
      // 检查搜索结果的相关性 - 大幅放宽距离限制，让更多相关结果被包含
      const relevantResults = searchResults.results.filter(result => 
        result.distance < 0.95 && result.content && result.content.length > 20
      );
      
      // 调试：打印检索到的内容（可在浏览器控制台查看）
      console.log('🔍 知识库检索结果:', {
        总结果数: searchResults.results.length,
        相关结果数: relevantResults.length,
        结果预览: relevantResults.slice(0, 3).map(r => ({
          来源: r.metadata?.source || r.metadata?.filename || '未知',
          内容片段: r.content?.substring(0, 200) || '无内容',
          距离: r.distance
        }))
      });
      
      if (relevantResults.length > 0) {
        knowledgeContext = `\n=== 知识库搜索结果（必须明确引用） ===\n${relevantResults.map((result) => {
          const filename = result.metadata?.filename || result.metadata?.source || '未知文档';
          const title = result.metadata?.title || filename;
          const content = result.content?.substring(0, 800) || '无内容';
          return `**文档名称**: ${title}\n**来源**: ${filename}\n**内容**: ${content}${result.content && result.content.length > 800 ? '...' : ''}`;
        }).join('\n\n---\n\n')}\n\n⚠️ **引用格式要求（必须严格遵守）**：
1. 引用时直接使用文档名称，格式为："根据[文档名称]" 或 "[文档名称]提到..."
2. **绝对禁止**：使用"文献1"、"文献2"、"Document 1"等编号前缀
3. **绝对禁止**：使用PDF内容片段作为文档名称
4. **必须**：使用上述文档名称列表中列出的确切名称，不要修改或截断
5. 正确示例："根据${relevantResults[0]?.metadata?.title || relevantResults[0]?.metadata?.filename || '[文档名称]'}" ✅
6. 错误示例："根据文献1: ${relevantResults[0]?.metadata?.title || '[文档名称]'}" ❌（不要使用编号）`;
      } else {
        knowledgeContext = '\n=== 知识库搜索无相关结果 ===\n注意：虽然找到了一些文档片段，但相关性较低，可能无法准确回答您的问题。';
      }
    } else {
      console.warn('⚠️ 知识库搜索无结果');
      knowledgeContext = '\n=== 知识库搜索无结果 ===\n注意：在知识库中没有找到与您问题相关的内容。';
    }
  } catch (error) {
    console.warn('知识库搜索失败:', error);
    knowledgeContext = '\n=== 知识库搜索失败，仅使用预设数据库 ===';
  }
  
  // 获取完整数据库统计信息
  let databaseStats = null;
  try {
    const { getFeatureStatistics } = await import('./databaseExplorer.js');
    databaseStats = await getFeatureStatistics();
  } catch (error) {
    console.warn('无法获取数据库统计信息:', error);
  }
  
  const isChinese = lang === 'zh';
  
  // 获取聊天历史并构建上下文
  const recentHistory = chatHistory.slice(-5); // 获取最近5轮对话
  let historyContext = '';
  if (recentHistory.length > 0) {
    historyContext = isChinese 
      ? '\n=== 最近对话历史 ===\n' + recentHistory.map(h => `用户: ${h.user}\n助手: ${h.assistant.substring(0, 100)}...`).join('\n\n')
      : '\n=== Recent Conversation History ===\n' + recentHistory.map(h => `User: ${h.user}\nAssistant: ${h.assistant.substring(0, 100)}...`).join('\n\n');
  }
  
  return `${isChinese ? '你是专业的语言学数据分析助手，擅长分析跨语言类型学数据。' : 'You are a professional linguistic data analysis assistant, specializing in cross-linguistic typological data analysis.'}

=== 数据库资源 ===
${databaseStats ? 
  (isChinese 
    ? `- Grambank数据库：${databaseStats.totalGrambankFeatures}个语法特征，覆盖世界各语言的语法类型
- D-PLACE数据库：${databaseStats.totalDplaceFeatures}个社会文化特征，涵盖环境、人口、社会结构等维度` 
    : `- Grambank database: ${databaseStats.totalGrambankFeatures} grammatical features covering grammatical typology across world languages
- D-PLACE database: ${databaseStats.totalDplaceFeatures} social-cultural features covering environment, population, social structure dimensions`)
  : ''
}

${specificFeatureInfo}${validFeatureIds}

${relatedFeatures ? 
  (isChinese 
    ? `\n=== 🎯 特征搜索结果（必须优先使用） ===\n${relatedFeatures}\n\n🚫 禁止使用其他来源的特征信息！上述搜索结果是最新、最准确的数据库信息。回答问题时必须基于这些特征结果，不得引用其他过时的特征列表。\n\n⚠️ 重要提示：如果搜索结果中包含多个相关特征，必须列出所有相关特征，不要使用"唯一"、"只有"、"仅"等限定词，除非搜索结果确实只包含一个特征。例如，如果搜索结果包含多个相关特征，必须全部列出，不能说某个特征是"唯一的"。`
    : `\n=== 🎯 FEATURE SEARCH RESULTS (MANDATORY - Use ONLY This Information) ===\n${relatedFeatures}\n\n🚫 FORBIDDEN: Do NOT use feature information from other sources! The above search results are the most current and accurate database information. You MUST base your answers on these feature results and MUST NOT reference other outdated feature lists.\n\n⚠️ IMPORTANT: If the search results contain multiple related features, you MUST list ALL related features. Do NOT use words like "only", "unique", "sole" unless the search results indeed contain only one feature. For example, if the search results contain multiple related features, you MUST list them all, and MUST NOT say a feature is "the only" one.`)
  : ''
}

${knowledgeContext ? (isChinese ? '=== 学术知识库 ===\n' : '=== Academic Knowledge Base ===\n') + knowledgeContext.substring(0, 4000) + (knowledgeContext.length > 4000 ? '...' : '') : ''}

${historyContext ? (isChinese ? '=== 对话历史 ===\n' : '=== Conversation History ===\n') + historyContext.substring(0, 400) + (historyContext.length > 400 ? '...' : '') : ''}

=== 用户问题 ===
${userMessage}

=== 回答要求 ===
${isChinese ? 
`1. **诚实原则**：如果知识库搜索无结果或结果相关性低，可以简单提及，但不要过度强调
2. 主要基于上述数据库和知识库信息回答，确保准确性
3. **引用要求**（仅在用户明确要求时严格执行）：
   - 如果用户明确要求引用文献，则必须明确引用，格式为："根据[文档名称]" 或 "[文档名称]提到..."
   - **绝对禁止**：使用"文献1"、"文献2"、"Document 1"等编号前缀
   - **绝对禁止**：使用PDF内容片段作为文档名称
   - **必须**：使用知识库搜索结果中列出的确切文档名称，不要修改或截断
   - 如果用户没有明确要求，可以自然地融入知识库内容，不需要强制引用格式
   - 如果使用了知识库内容，可以自然地提及"根据相关研究"或"有文献表明"
4. **假设要求**：${requiresHypothesis ? '用户明确要求提出假设，请基于数据库特征和知识库文献自然地提出研究假设，不需要严格的格式要求，可以自然地融入回答中' : '如果用户要求提出假设，请自然地提出，不需要严格的格式要求'}
5. **回答要求**：
   - 自然流畅，根据问题复杂度调整长度，不要强制限制字数
   - 重点突出，但可以用自然的语言表达
   - 根据用户问题的风格调整回答风格，保持对话的自然性
6. **结构化格式**（仅在用户明确要求时使用）：
   - 如果用户没有明确要求JSON格式，可以自然回答，不需要强制添加JSON结构
   - 如果用户要求结构化数据，再提供JSON格式` 
: 
`1. **Honesty Principle**: If knowledge base search returns no results or low relevance, you can briefly mention it, but don't overemphasize
2. Answer primarily based on the above database and knowledge base information, ensuring accuracy
3. **Citation Requirements** (only strictly enforced when user explicitly requests):
   - If user explicitly requests citations, you MUST explicitly cite, format: "According to [Document Name]" or "[Document Name] mentions..."
   - **ABSOLUTELY FORBIDDEN**: Using "Document 1", "文献1" or any number prefix
   - **ABSOLUTELY FORBIDDEN**: Using PDF content snippets as document names
   - **REQUIRED**: Use the exact document names from the knowledge base search results, do NOT modify or truncate
   - If user doesn't explicitly request, you can naturally incorporate knowledge base content without forced citation format
   - If you use knowledge base content, you can naturally mention "according to related research" or "literature shows"
4. **Hypothesis Requirements**: ${requiresHypothesis ? 'User explicitly requests hypotheses. Please naturally propose research hypotheses based on database features and knowledge base literature, no strict format required, can be naturally integrated into the answer' : 'If user requests hypotheses, please propose them naturally, no strict format required'}
5. **Response Requirements**:
   - Natural and fluent, adjust length based on question complexity, don't force word limits
   - Focus on key points, but express in natural language
   - Adjust response style based on user's question style, maintain conversational naturalness
6. **Structured Format** (only use when user explicitly requests):
   - If user doesn't explicitly request JSON format, answer naturally without forcing JSON structure
   - If user requests structured data, then provide JSON format`}

=== 回答风格指南 ===
${isChinese ? 
`请根据用户的问题风格自然地回答：
- 如果用户问得简单直接，就简单直接地回答
- 如果用户问得详细深入，就详细深入地回答
- 如果用户要求格式化的答案，就提供格式化答案
- 如果用户只是聊天，就自然地聊天
- 保持对话的自然流畅，不要过度格式化
- 可以根据需要使用要点、段落或自然语言，灵活调整格式`
:
`Please answer naturally based on the user's question style:
- If the user asks simply, answer simply
- If the user asks in detail, answer in detail
- If the user requests formatted answers, provide formatted answers
- If the user is just chatting, chat naturally
- Maintain natural conversational flow, don't over-format
- You can flexibly use bullet points, paragraphs, or natural language as needed`}
`;
}

// 调用 Gemini API（通过后端代理，避免CORS问题和保护API Key）
export async function callGeminiAPI(userMessage, lang = 'en') {
  try {
    // 检查API Key是否设置（用于提示用户）
    const API_KEY = localStorage.getItem('GEMINI_API_KEY');
    if (!API_KEY) {
      throw new Error('API_KEY_NOT_SET');
    }
    
    // 构建提示词（与千问相同的逻辑）
    const prompt = await buildPrompt(userMessage, lang);
    
    // 通过后端代理调用Gemini API（避免CORS问题和保护API Key）
    const { buildApiUrl } = await import('../config/api.js');
    const API_URL = buildApiUrl('/api/gemini/chat');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY  // 通过请求头传递API Key（如果后端环境变量未设置）
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { detail: errorText };
      }
      console.error('Gemini API Error Response:', errorData);
      throw new Error(`API request failed: ${response.status} - ${errorData.detail || errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.success && data.content) {
      return data.content;
    } else {
      console.error('Unexpected Gemini API response structure:', data);
      throw new Error('Unexpected API response structure');
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    if (error.message === 'API_KEY_NOT_SET') {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const isChinese = lang === 'zh';
    
    // 如果是网络错误，提示检查后端服务
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return isChinese ? 
        `无法连接到后端服务。请确保后端服务正在运行（python api.py）。如果后端服务已启动，请检查API配置。` :
        `Unable to connect to backend service. Please ensure the backend service is running (python api.py). If the backend is running, please check the API configuration.`;
    }
    
    return isChinese ? 
      `抱歉，调用Gemini AI服务时出错：${error.message}。请检查后端服务状态和API配置。` :
      `Sorry, error calling Gemini AI service: ${error.message}. Please check backend service status and API configuration.`;
  }
}

// 添加聊天消息到历史记录
export function addChatToHistory(userMessage, assistantResponse) {
  chatHistory.push({ user: userMessage, assistant: assistantResponse });
  
  // 限制历史记录长度
  if (chatHistory.length > 50) {
    chatHistory = chatHistory.slice(-50);
  }
}

// 获取聊天历史记录
export function getChatHistory() {
  return chatHistory;
}

// 清除聊天历史记录
export function clearChatHistory() {
  chatHistory = [];
}

// 获取当前选择的API提供商
export function getSelectedAPIProvider() {
  return localStorage.getItem('SELECTED_API_PROVIDER') || 'gemini';
}

// 设置API提供商
export function setSelectedAPIProvider(provider) {
  localStorage.setItem('SELECTED_API_PROVIDER', provider);
  window.dispatchEvent(new Event('apiKeyUpdated'));
}

// 检查 API 配置状态
export function checkAPIStatus() {
  const provider = getSelectedAPIProvider();
  let apiKey;
  
  if (provider === 'qianwen') {
    apiKey = localStorage.getItem('QIANWEN_API_KEY');
  } else {
    apiKey = localStorage.getItem('GEMINI_API_KEY');
  }
  
  return {
    configured: !!(apiKey && apiKey.trim() !== ''),
    hasKey: !!(apiKey && apiKey.trim() !== ''),
    provider: provider
  };
}

// 保存 API Key
export function saveAPIKey(apiKey, provider = null) {
  const selectedProvider = provider || getSelectedAPIProvider();
  
  if (selectedProvider === 'qianwen') {
    localStorage.setItem('QIANWEN_API_KEY', apiKey);
  } else {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
  }
  
  // 触发自定义事件通知API Key已更新
  window.dispatchEvent(new Event('apiKeyUpdated'));
}

// 获取 API Key
export function getAPIKey(provider = null) {
  const selectedProvider = provider || getSelectedAPIProvider();
  
  if (selectedProvider === 'qianwen') {
    return localStorage.getItem('QIANWEN_API_KEY');
  } else {
    return localStorage.getItem('GEMINI_API_KEY');
  }
}

// 统一的API调用函数，根据选择的提供商自动调用对应的API
export async function callAIAPI(userMessage, lang = 'en') {
  const provider = getSelectedAPIProvider();
  
  if (provider === 'qianwen') {
    return await callQianwenAPI(userMessage, lang);
  } else {
    return await callGeminiAPI(userMessage, lang);
  }
}