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

// 获取特征分类信息
export function getFeatureCategories(gbFeatures, gbOrangeFeatures, eaFeatures) {
  return {
    gender: {
      name: "Gender/Noun Class Features",
      description: "Grammatical gender and noun classification systems",
      features: gbFeatures,
      examples: ["GB030", "GB051", "GB052", "GB053", "GB054"]
    },
    classifier: {
      name: "Classifier Features", 
      description: "Numeral and noun classifier systems",
      features: gbOrangeFeatures,
      examples: ["GB038", "GB057", "GB058"]
    },
    social: {
      name: "Social/Cultural Features",
      description: "Social organization, kinship, and cultural practices",
      features: eaFeatures.filter(f => f.startsWith('EA')),
      examples: ["EA044", "EA045", "EA046", "EA047", "EA048"]
    },
    natural: {
      name: "Environmental Features",
      description: "Biodiversity and environmental factors",
      features: eaFeatures.filter(f => f.includes('Richness')),
      examples: ["AmphibianRichness", "BirdRichness", "MammalRichness", "VascularPlantsRichness"]
    }
  };
}

// 调用 Gemini API
export async function callGeminiAPI(userMessage, lang = 'en') {
  try {
    // 从localStorage获取API密钥
    const API_KEY = localStorage.getItem('GEMINI_API_KEY');
    if (!API_KEY) {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const API_URL = window.CONFIG?.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
    
    // 特殊处理：如果用户问的是特定特征（如GB057），先从数据库查找
    let specificFeatureInfo = '';
    let relatedFeatures = '';
    
    const featureMatch = userMessage.match(/\b(GB\d+|EA\d+)\b/i);
    if (featureMatch) {
      try {
        const { searchFeatureDescriptions, cleanDescription } = await import('./databaseExplorer.js');
        const featureId = featureMatch[0].toUpperCase();
        console.log('正在查找特征:', featureId);
        
        // 搜索特征信息
        const searchResults = await searchFeatureDescriptions(featureId, 10);
        const exactMatch = searchResults.find(f => f.id === featureId);
        
        if (exactMatch) {
          specificFeatureInfo = `\n=== 数据库中的特征信息 ===\n${featureId}: ${exactMatch.name}\n分类: ${exactMatch.category}\n描述: ${exactMatch.description}\n来源: ${exactMatch.source}`;
          console.log('找到特征信息:', exactMatch);
        } else {
          console.log('未找到特征:', featureId, '搜索结果:', searchResults);
        }
      } catch (error) {
        console.warn('特征搜索失败:', error);
      }
    }
    
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
        console.log('执行特征推荐搜索...');
        
        // 获取所有真实存在的特征编号
        const allIds = await getAllFeatureIds();
        validFeatureIds = `\n=== 真实存在的特征编号（仅使用这些）===\nGrambank特征: ${allIds.grambank.slice(0, 20).join(', ')}... (共${allIds.grambank.length}个)\nD-PLACE特征: ${allIds.dplace.slice(0, 20).join(', ')}... (共${allIds.dplace.length}个)`;
        
        // 从用户消息中提取关键词进行搜索 - 使用与左侧特征推荐相同的方法
        const searchResults = await searchFeatureDescriptions(userMessage, 15);
        console.log('搜索到的相关特征:', searchResults.length);
        
        if (searchResults.length > 0) {
          relatedFeatures = `\n=== 相关特征推荐（直接来自数据库CSV文件）===\n${searchResults.slice(0, 10).map(feature => 
            `${feature.id} (${feature.source}): ${feature.name}\n  分类: ${feature.category}\n  描述: ${cleanDescription ? cleanDescription(feature.description).substring(0, 200) : feature.description?.substring(0, 200) || ''}...`
          ).join('\n\n')}`;
        }
      } catch (error) {
        console.warn('特征推荐搜索失败:', error);
      }
    }
    
    // 搜索后端知识库
    let knowledgeContext = '';
    try {
      console.log('正在搜索后端知识库...');
      const { searchKnowledgeBase } = await import('./knowledgeBaseUtils.js');
      // 增加搜索结果数量，让AI获得更全面的信息
      const searchResults = await searchKnowledgeBase(userMessage, 10);
      
      if (searchResults && searchResults.results && searchResults.results.length > 0) {
        // 检查搜索结果的相关性 - 大幅放宽距离限制，让更多相关结果被包含
        const relevantResults = searchResults.results.filter(result => 
          result.distance < 0.95 && result.content && result.content.length > 20
        );
        
        if (relevantResults.length > 0) {
          knowledgeContext = `\n=== 知识库搜索结果 ===\n${relevantResults.map((result, index) => 
            `文档 ${index + 1}:\n标题: ${result.metadata?.title || result.metadata?.filename || '未知'}\n来源: ${result.metadata?.source || '未知'}\n内容片段: ${result.content?.substring(0, 300) || '无内容'}...`
          ).join('\n\n')}`;
          console.log('知识库搜索成功，找到', relevantResults.length, '个相关结果');
        } else {
          knowledgeContext = '\n=== 知识库搜索无相关结果 ===\n注意：虽然找到了一些文档片段，但相关性较低，可能无法准确回答您的问题。';
          console.log('知识库搜索结果相关性较低');
        }
      } else {
        knowledgeContext = '\n=== 知识库搜索无结果 ===\n注意：在知识库中没有找到与您问题相关的内容。';
        console.log('知识库搜索无结果');
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
    console.log('callGeminiAPI语言设置:', lang, '是否中文:', isChinese);
    
    // 获取聊天历史并构建上下文
    const recentHistory = chatHistory.slice(-5); // 获取最近5轮对话
    let historyContext = '';
    if (recentHistory.length > 0) {
      historyContext = isChinese 
        ? '\n=== 最近对话历史 ===\n' + recentHistory.map(h => `用户: ${h.user}\n助手: ${h.assistant.substring(0, 100)}...`).join('\n\n')
        : '\n=== Recent Conversation History ===\n' + recentHistory.map(h => `User: ${h.user}\nAssistant: ${h.assistant.substring(0, 100)}...`).join('\n\n');
    }
    const prompt = `${isChinese ? '你是专业的语言学数据分析助手，擅长分析跨语言类型学数据。' : 'You are a professional linguistic data analysis assistant, specializing in cross-linguistic typological data analysis.'}

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
    ? `\n=== 🎯 特征搜索结果（必须优先使用） ===\n${relatedFeatures}\n\n🚫 禁止使用其他来源的特征信息！上述搜索结果是最新、最准确的数据库信息。回答问题时必须基于这些特征结果，不得引用其他过时的特征列表。`
    : `\n=== 🎯 FEATURE SEARCH RESULTS (MANDATORY - Use ONLY This Information) ===\n${relatedFeatures}\n\n🚫 FORBIDDEN: Do NOT use feature information from other sources! The above search results are the most current and accurate database information. You MUST base your answers on these feature results and MUST NOT reference other outdated feature lists.`)
  : ''
}

${knowledgeContext ? (isChinese ? '=== 学术知识库 ===\n' : '=== Academic Knowledge Base ===\n') + knowledgeContext.substring(0, 600) + (knowledgeContext.length > 600 ? '...' : '') : ''}

${historyContext ? (isChinese ? '=== 对话历史 ===\n' : '=== Conversation History ===\n') + historyContext.substring(0, 400) + (historyContext.length > 400 ? '...' : '') : ''}

=== 用户问题 ===
${userMessage}

=== 回答要求 ===
${isChinese ? 
`1. **诚实原则**：如果知识库搜索无结果或结果相关性低，必须明确告知用户，不要编造信息
2. 主要基于上述数据库和知识库信息回答，确保准确性
3. **回答要求**：
   - 简洁明了，控制在150-200字
   - 重点突出，用要点形式呈现
   - 避免冗余，直接回答核心问题
4. **结构化格式**：回答最后必须包含以下JSON结构：

\`\`\`json
{
  "核心要点": "用一句话总结",
  "主要特征": ["特征1", "特征2"],
  "分布模式": "简要描述",
  "研究价值": "一句话说明"
}
\`\`\`

5. 如果数据库中没有相关信息，在JSON中明确标注"无数据"` 
: 
`1. **Honesty Principle**: If knowledge base search returns no results or low relevance, clearly inform the user, do not fabricate information
2. Answer primarily based on the above database and knowledge base information, ensuring accuracy
3. **Response Requirements**:
   - Concise and clear, within 150-200 words
   - Focus on key points, present in bullet points
   - Avoid redundancy, directly answer the core question
4. **Structured Format**: Answer must include the following JSON structure at the end:

\`\`\`json
{
  "key_points": "Summarize in one sentence",
  "main_features": ["Feature 1", "Feature 2"],
  "distribution": "Brief description",
  "research_value": "One sentence explanation"
}
\`\`\`

5. If no relevant information in database, clearly mark "No data" in JSON`}

=== 示例回答格式 ===
${isChinese ? 
`用户问题：语言中名词词性是否有阴阳等变化？

回答：
【语法性别系统】世界语言中广泛存在的名词分类系统，基于非自然属性（如阳性、阴性）进行分类。

【主要特征】
• GB057：描述名词性别或名词类别
• 影响语法一致性和形态变化
• 与社会文化因素密切相关

【分布】印欧语系、班图语系中常见，其他语系较少见

【JSON数据】
{
  "核心要点": "语法性别是世界语言中广泛存在的名词分类系统",
  "主要特征": ["GB057", "语法一致性", "形态变化"],
  "分布模式": "印欧语系、班图语系中常见",
  "研究价值": "理解语言结构、演变和文化背景"
}`
:
`User Question: Do languages have grammatical gender systems?

Answer:
[Grammatical Gender Systems] Widely distributed noun classification systems in world languages, based on non-natural properties (e.g., masculine, feminine).

[Key Features]
• GB057: Describes gender or noun class features
• Affects grammatical agreement and morphology
• Closely related to socio-cultural factors

[Distribution] Common in Indo-European and Bantu families, less common in others

[JSON Data]
{
  "key_points": "Grammatical gender is widely distributed in world languages",
  "main_features": ["GB057", "grammatical agreement", "morphology"],
  "distribution": "Common in Indo-European and Bantu families",
  "research_value": "Understanding language structure, evolution, and cultural background"
}`}

要求：回答简洁明了，重点突出，使用【】或[]标记重点，JSON数据直接放在最后，不要使用HTML标签。`

    console.log('Making API request to:', API_URL);
    console.log('API Key:', API_KEY.substring(0, 10) + '...');
    
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response data:', data);
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected API response structure:', data);
      throw new Error('Unexpected API response structure');
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    if (error.message === 'API_KEY_NOT_SET') {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const isChinese = lang === 'zh';
    
    return isChinese ? 
      `抱歉，目前无法连接到AI服务。不过我可以为您提供一些基本的数据分析信息：

基于您的数据集，您拥有：
- ${languageData?.length || 0} 种语言
- ${gbFeatures.length} 个性别特征 (${gbFeatures.slice(0, 3).join(', ')}${gbFeatures.length > 3 ? '...' : ''})
- ${gbOrangeFeatures.length} 个分类词特征 (${gbOrangeFeatures.slice(0, 3).join(', ')}${gbOrangeFeatures.length > 3 ? '...' : ''})
- ${eaFeatures.filter(f => f.startsWith('EA')).length} 个社会特征
- ${eaFeatures.filter(f => f.includes('Richness')).length} 个自然丰富度特征

请稍后再试或检查您的API配置。` :
      `I apologize, but I'm unable to connect to the AI service at the moment. However, I can help you with some basic analysis:

Based on your dataset, you have:
- ${languageData?.length || 0} languages
- ${gbFeatures.length} gender features (${gbFeatures.slice(0, 3).join(', ')}${gbFeatures.length > 3 ? '...' : ''})
- ${gbOrangeFeatures.length} classifier features (${gbOrangeFeatures.slice(0, 3).join(', ')}${gbOrangeFeatures.length > 3 ? '...' : ''})
- ${eaFeatures.filter(f => f.startsWith('EA')).length} social features
- ${eaFeatures.filter(f => f.includes('Richness')).length} natural richness features

Please try again later or check your API configuration.`;
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

// 检查 API 配置状态
export function checkAPIStatus() {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  return {
    configured: !!(apiKey && apiKey.trim() !== ''),
    hasKey: !!(apiKey && apiKey.trim() !== '')
  };
}

// 保存 API Key
export function saveAPIKey(apiKey) {
  localStorage.setItem('GEMINI_API_KEY', apiKey);
  
  // 触发自定义事件通知API Key已更新
  window.dispatchEvent(new Event('apiKeyUpdated'));
}

// 获取 API Key
export function getAPIKey() {
  return localStorage.getItem('GEMINI_API_KEY');
} 

// 给例子 要求回答成什么样 [{"role": "user", "content": "你好"}, {"role": "assistant", "content": "你好，有什么可以帮你的吗？"}]