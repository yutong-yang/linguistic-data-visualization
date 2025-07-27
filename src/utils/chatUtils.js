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
export async function callGeminiAPI(userMessage, languageData, featureDescriptions, selectedEAFeatures, selectedGBFeatures, gbFeatures, gbOrangeFeatures, eaFeatures, lang = 'en') {
  try {
    // 从localStorage获取API密钥
    const API_KEY = localStorage.getItem('GEMINI_API_KEY');
    if (!API_KEY) {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const API_URL = window.CONFIG?.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
    
    // 检查知识库状态并构建RAG上下文
    let knowledgeContext = '';
    try {
      const isKnowledgeBaseAvailable = await checkKnowledgeBaseStatus();
      if (isKnowledgeBaseAvailable) {
        knowledgeContext = await buildRAGContext(userMessage, 3);
      }
    } catch (error) {
      console.warn('知识库不可用，将使用基础模式:', error);
    }
    
    const datasetStats = getDatasetStats(languageData, gbFeatures, gbOrangeFeatures, eaFeatures);
    const featureCategories = getFeatureCategories(gbFeatures, gbOrangeFeatures, eaFeatures);
    const availableFeatures = {
      gender: gbFeatures,
      classifier: gbOrangeFeatures,
      social: eaFeatures.filter(f => f.startsWith('EA')),
      natural: eaFeatures.filter(f => f.includes('Richness'))
    };
    
    // 获取特征描述信息
    const featureDescriptionsText = Object.entries(featureDescriptions)
      .map(([id, info]) => `${id}: ${info.name} - ${info.description?.substring(0, 100)}...`)
      .join('\n');
    
    // 获取数据样本和统计信息
    const dataSample = languageData.slice(0, 5).map(lang => ({
      name: lang.Name,
      family: lang.Family_level_ID,
      region: lang.region,
      features: Object.keys(lang).filter(key => key.startsWith('GB') || key.startsWith('EA')).reduce((acc, key) => {
        if (lang[key] !== null && lang[key] !== undefined) {
          acc[key] = lang[key];
        }
        return acc;
      }, {})
    }));
    
    const dataStats = {
      totalLanguages: languageData.length,
      featureStats: Object.keys(languageData[0] || {}).filter(key => key.startsWith('GB') || key.startsWith('EA')).map(feature => {
        const values = languageData.map(lang => lang[feature]).filter(v => v !== null && v !== undefined);
        return {
          feature,
          count: values.length,
          uniqueValues: [...new Set(values)],
          avgValue: values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0
        };
      })
    };
    
    const isChinese = lang === 'zh';
    const prompt = `${isChinese ? '你是一位专业的语言学数据分析助手，专门研究Grambank (GB)和D-PLACE (EA)特征。' : 'You are a professional linguistic data analysis assistant specializing in Grambank (GB) and D-PLACE (EA) features.'}

${isChinese ? '=== 专业背景 ===' : '=== EXPERTISE ==='}
${isChinese ? '• 语言类型学和跨语言比较' : '• Linguistic typology and cross-linguistic comparison'}
${isChinese ? '• 语法性别和名词分类系统' : '• Grammatical gender and noun classification systems'}
${isChinese ? '• 数词和分类词系统' : '• Numeral and classifier systems'}
${isChinese ? '• 社会组织和文化实践' : '• Social organization and cultural practices'}
${isChinese ? '• 语言演化和系统发育关系' : '• Language evolution and phylogenetic relationships'}

${isChinese ? '=== 数据集信息 ===' : '=== DATASET ==='}
${isChinese ? '• 总语言数：' : '• Total languages: '}${datasetStats?.totalLanguages || 'Unknown'}
${isChinese ? '• 性别特征 (GB)：' : '• Gender features (GB): '}${availableFeatures.gender.slice(0, 5).join(', ')}${availableFeatures.gender.length > 5 ? (isChinese ? '...' : '...') : ''}
${isChinese ? '• 分类词特征 (GB)：' : '• Classifier features (GB)：'}${availableFeatures.classifier.slice(0, 3).join(', ')}${availableFeatures.classifier.length > 3 ? (isChinese ? '...' : '...') : ''}
${isChinese ? '• 社会特征 (EA)：' : '• Social features (EA)：'}${availableFeatures.social.slice(0, 3).join(', ')}${availableFeatures.social.length > 3 ? (isChinese ? '...' : '...') : ''}

${isChinese ? '=== 重要提醒 ===' : '=== IMPORTANT NOTES ==='}
${isChinese ? '• 只推荐实际存在的特征，GB特征从GB020开始' : '• Only recommend features that actually exist, GB features start from GB020'}
${isChinese ? '• 不要推荐GB001-GB019等不存在的特征' : '• Do not recommend non-existent features like GB001-GB019'}
${isChinese ? '• 推荐特征前请验证其存在性' : '• Verify feature existence before recommending'}

${isChinese ? '=== 当前选择特征 ===' : '=== SELECTED FEATURES ==='}
${isChinese ? '• EA特征：' : '• EA Features: '}${selectedEAFeatures.join(', ') || (isChinese ? '无' : 'None')}
${isChinese ? '• GB特征：' : '• GB Features: '}${selectedGBFeatures.join(', ') || (isChinese ? '全部' : 'All')}

${knowledgeContext ? (isChinese ? '=== 相关知识库内容 ===' : '=== KNOWLEDGE BASE CONTEXT ===') + knowledgeContext : ''}

${isChinese ? '=== 用户问题 ===' : '=== USER QUESTION ==='}
${userMessage}

${isChinese ? '=== 回答要求 ===' : '=== RESPONSE GUIDELINES ==='}
${isChinese ? '1. 用简洁专业的语言回答（控制在200-300字）' : '1. Provide concise, professional responses (200-300 words)'}
${isChinese ? '2. 基于类型学专业知识分析数据' : '2. Analyze data using typological expertise'}
${isChinese ? '3. 提供具体的特征建议和理由' : '3. Provide specific feature recommendations with reasoning'}
${isChinese ? '4. 建议合适的分析方法' : '4. Suggest appropriate analysis methods'}
${isChinese ? '5. 考虑地理和遗传因素' : '5. Consider areal and genetic factors'}
${isChinese ? '6. 引用相关语言学理论' : '6. Reference relevant linguistic theories'}
${knowledgeContext ? (isChinese ? '7. 结合知识库中的相关研究文献' : '7. Incorporate relevant research from the knowledge base') : ''}
${knowledgeContext ? (isChinese ? '8. 在回答中明确引用来源，使用格式：[文件名](source://文件路径)' : '8. Explicitly cite sources in your response using format: [filename](source://filepath)') : ''}

${isChinese ? '请用中文回答：' : 'Response:'}`;

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
    
    return `I apologize, but I'm unable to connect to the AI service at the moment. However, I can help you with some basic analysis:

Based on your dataset, you have:
- ${languageData?.length || 0} languages
- ${gbFeatures.length} gender features (${gbFeatures.join(', ')})
- ${gbOrangeFeatures.length} classifier features (${gbOrangeFeatures.join(', ')})
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
}

// 获取 API Key
export function getAPIKey() {
  return localStorage.getItem('GEMINI_API_KEY');
} 