// 智能特征推荐系统 - 调用后端API
import { buildApiUrl, API_ENDPOINTS } from '../config/api.js';
import { getSelectedAPIProvider, getAPIKey } from './chatUtils.js';
// 保留这些导入用于其他辅助函数（discoverNewFeatures, getDatabaseOverview）
import { 
  searchFeatureDescriptions,
  getFeatureStatistics,
  cleanDescription
} from './databaseExplorer.js';

// 获取所有可用特征
function getAllAvailableFeatures(languageData) {
  if (!languageData || languageData.length === 0) return [];
  
  const features = new Set();
  
  languageData.forEach(lang => {
    Object.keys(lang).forEach(key => {
      if (key.startsWith('GB') || key.startsWith('EA') || key.includes('Richness')) {
        // 验证GB特征是否有效
        if (key.startsWith('GB')) {
          const match = key.match(/^GB(\d{3})$/);
          if (match) {
            const num = parseInt(match[1]);
            // 只保留有效的GB特征（通常GB020开始）
            if (num >= 20) {
              features.add(key);
            }
          }
        } else {
          features.add(key);
        }
      }
    });
  });
  
  return Array.from(features).sort();
}

// 验证特征是否存在
function validateFeatures(features, languageData, featureDescriptions) {
  const validFeatures = [];
  const invalidFeatures = [];
  
  features.forEach(feature => {
    // 处理对象格式 {id: '...', source: '...'} 或字符串格式
    const featureId = typeof feature === 'object' ? feature.id : feature;
    const featureSource = typeof feature === 'object' ? feature.source : null;
    
    // 检查特征是否在数据中存在
    const hasData = languageData.length > 0 && languageData[0].hasOwnProperty(featureId);
    // 检查特征是否有描述
    const hasDescription = featureDescriptions && featureDescriptions[featureId];
    
    if (hasData || hasDescription) {
      // 如果后端提供了source信息，保留它；否则返回字符串
      if (featureSource) {
        validFeatures.push({id: featureId, source: featureSource});
      } else {
        validFeatures.push(featureId);
      }
    } else {
      invalidFeatures.push(featureId);
    }
  });
  
  if (invalidFeatures.length > 0) {
    console.warn('发现无效特征:', invalidFeatures);
  }
  
  return validFeatures;
}

// 使用后端API推荐特征
export async function recommendFeatures(userQuery, languageData, featureDescriptions, userLang = 'en') {
  try {
    // 获取当前选择的 API provider
    const apiProvider = getSelectedAPIProvider() || 'gemini';
    
    // 获取对应的 API Key
    const apiKey = getAPIKey(apiProvider);
    if (!apiKey) {
      const providerName = apiProvider === 'qianwen' ? 'QIANWEN' : 'GEMINI';
      const errorMsg = userLang === 'zh'
        ? `${providerName}_API_KEY未设置`
        : `${providerName}_API_KEY is not set`;
      throw new Error(errorMsg);
    }
    
    // 调用后端API，添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时
    
    let response;
    try {
      response = await fetch(buildApiUrl(API_ENDPOINTS.featureRecommendation), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          user_query: userQuery,
          language_data: languageData || [],
          feature_descriptions: featureDescriptions || {},
          n_kb_results: 10,
          api_provider: apiProvider,  // 传递 API provider 类型
          lang: userLang || 'en'  // 传递界面语言
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        const timeoutMsg = userLang === 'zh' 
          ? '请求超时，请稍后重试或检查网络连接'
          : 'Request timeout, please try again later or check your network connection';
        throw new Error(timeoutMsg);
      }
      const networkErrorMsg = userLang === 'zh'
        ? `网络错误: ${fetchError.message || '无法连接到服务器'}`
        : `Network error: ${fetchError.message || 'Unable to connect to server'}`;
      throw new Error(networkErrorMsg);
    }
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = userLang === 'zh'
        ? `API请求失败: ${response.status}`
        : `API request failed: ${response.status}`;
      
      // 处理不同的HTTP状态码
      if (response.status === 504) {
        errorMessage = userLang === 'zh'
          ? '请求超时，服务器响应时间过长，请稍后重试'
          : 'Request timeout, server response time is too long, please try again later';
      } else if (response.status === 500) {
        errorMessage = userLang === 'zh'
          ? '服务器内部错误，请稍后重试'
          : 'Internal server error, please try again later';
      } else if (response.status === 400) {
        errorMessage = userLang === 'zh'
          ? '请求参数错误，请检查输入'
          : 'Invalid request parameters, please check your input';
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = userLang === 'zh'
          ? 'API密钥无效或未设置，请检查配置'
          : 'API key is invalid or not set, please check your configuration';
      }
      
      // 尝试解析错误详情
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // 如果无法解析JSON，使用默认错误消息
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // 后端已经验证了特征，直接返回
    if (data.recommendations && Array.isArray(data.recommendations)) {
      // 再次验证特征（双重保险）
      data.recommendations.forEach(rec => {
        rec.features = validateFeatures(rec.features, languageData, featureDescriptions);
      });
      return data.recommendations.filter(rec => rec.features.length > 0);
    }
    
    return [];
    
  } catch (error) {
    console.error('特征推荐失败:', error);
    // 重新抛出错误，让调用者能够显示错误消息
    throw error;
  }
}

// 备用推荐方法（当LLM失败时使用）
async function fallbackRecommendation(userQuery, languageData, featureDescriptions) {
  try {
    // 尝试使用数据库搜索作为备用方案
    const searchResults = await searchFeatureDescriptions(userQuery, 10);
    
    if (searchResults && searchResults.length > 0) {
      // 基于搜索结果创建推荐
      const recommendations = [{
        category: 'database_search',
        name: '数据库搜索结果',
        description: '基于数据库搜索的相关特征',
        features: searchResults.slice(0, 10).map(f => f.id),
        reason: '从数据库中找到的相关特征',
        source: 'Database Search'
      }];
      
      // 验证特征
      recommendations.forEach(rec => {
        rec.features = validateFeatures(rec.features, languageData, featureDescriptions);
      });
      
      return recommendations.filter(rec => rec.features.length > 0);
    }
    
    // 如果数据库搜索也失败，返回空数组
    return [];
  } catch (error) {
    console.error('备用推荐失败:', error);
    return [];
  }
}

// 从搜索结果中提取特征信息
function extractFeaturesFromSearchResults(results) {
  const features = new Set();
  
  results.forEach(result => {
    const content = result.content.toLowerCase();
    
    // 提取GB特征
    const gbMatches = content.match(/gb\d{3}/gi);
    if (gbMatches) {
      gbMatches.forEach(match => features.add(match.toUpperCase()));
    }
    
    // 提取EA特征
    const eaMatches = content.match(/ea\d{3}/gi);
    if (eaMatches) {
      eaMatches.forEach(match => features.add(match.toUpperCase()));
    }
    
    // 提取环境特征（从内容中动态提取，不硬编码）
    if (content.includes('richness')) {
      // 尝试从内容中提取具体的richness特征名称
      const richnessMatches = content.match(/(\w+richness)/gi);
      if (richnessMatches) {
        richnessMatches.forEach(match => {
          const featureName = match.charAt(0).toUpperCase() + match.slice(1);
          features.add(featureName);
        });
      }
    }
  });
  
  return Array.from(features);
}

// 从知识库搜索结果中提取特征ID
function extractFeaturesFromKnowledgeBase(kbResults) {
  const features = new Set();
  
  kbResults.forEach(result => {
    const document = result.document || {};
    const content = (result.content || document.content || '').toLowerCase();
    
    // 提取GB特征（支持GB001-GB999格式）
    const gbMatches = content.match(/gb\d{3}/gi);
    if (gbMatches) {
      gbMatches.forEach(match => {
        const featureId = match.toUpperCase();
        // 验证特征ID格式（GB020-GB999通常是有效的）
        const num = parseInt(featureId.substring(2));
        if (num >= 20 && num <= 999) {
          features.add(featureId);
        }
      });
    }
    
    // 提取EA特征
    const eaMatches = content.match(/ea\d{3}/gi);
    if (eaMatches) {
      eaMatches.forEach(match => features.add(match.toUpperCase()));
    }
    
    // 提取环境特征（从内容中动态提取，不硬编码）
    if (content.includes('richness')) {
      // 尝试从内容中提取具体的richness特征名称
      const richnessMatches = content.match(/(\w+richness)/gi);
      if (richnessMatches) {
        richnessMatches.forEach(match => {
          const featureName = match.charAt(0).toUpperCase() + match.slice(1);
          features.add(featureName);
        });
      }
    }
  });
  
  return Array.from(features);
}

// 基于数据相关性推荐特征（已移除硬编码，仅基于数据分布）
function recommendBasedOnData(userQuery, languageData) {
  if (!languageData || languageData.length === 0) return [];
  
  // 分析数据中的特征分布
  const featureStats = analyzeFeatureDistribution(languageData);
  
  // 只返回覆盖率高的特征，不进行硬编码匹配
  if (featureStats.length > 0) {
    return [{
      category: 'data_analysis',
      name: '高覆盖率特征',
      description: '基于数据分布的特征推荐',
      features: featureStats.slice(0, 10).map(f => f.feature),
      reason: '数据中覆盖率较高的特征'
    }];
  }
  
  return [];
}

// 分析特征分布
function analyzeFeatureDistribution(languageData) {
  const featureCounts = {};
  
  languageData.forEach(lang => {
    Object.keys(lang).forEach(key => {
      if (key.startsWith('GB') || key.startsWith('EA') || key.includes('Richness')) {
        if (lang[key] !== null && lang[key] !== undefined) {
          featureCounts[key] = (featureCounts[key] || 0) + 1;
        }
      }
    });
  });
  
  return Object.entries(featureCounts)
    .map(([feature, count]) => ({
      feature,
      count,
      coverage: count / languageData.length
    }))
    .filter(f => f.coverage > 0.1) // 只推荐覆盖率超过10%的特征
    .sort((a, b) => b.coverage - a.coverage);
}

// 生成研究建议（完全基于推荐结果，无硬编码）
export function generateResearchIdeas(userQuery, recommendations, languageData) {
  const ideas = [];
  
  if (recommendations.length === 0) return ideas;
  
  // 基于推荐特征生成研究想法，完全使用推荐中的信息
  recommendations.forEach(rec => {
    // 使用推荐中的信息，不添加硬编码的分析类型或可视化方式
    ideas.push({
      title: rec.name || `${rec.category || '特征'}相关研究`,
      description: rec.description || rec.reason || `分析${rec.features.slice(0, 5).join(', ')}${rec.features.length > 5 ? '等' : ''}特征`,
      features: rec.features,
      reason: rec.reason || rec.description || '基于推荐特征的研究建议'
    });
  });
  
  return ideas;
}

// 导出获取所有可用特征函数
export { getAllAvailableFeatures };

// 获取特征详细信息
export function getFeatureDetails(featureId, featureDescriptions) {
  // WALS特征：数字+字母格式，如1A, 2A, 10A等
  const isWals = /^\d+[A-Z]$/.test(featureId);
  
  // D-PLACE特征包括：EA开头、CARNEIRO_开头、B开头（Binford数据集，如B001, B030）、SCCS开头、Richness相关、其他环境特征
  const isDPlace = !isWals && (
    featureId.startsWith('EA') || 
    featureId.startsWith('CARNEIRO_') || 
    featureId.startsWith('SCCS') ||
    (featureId.startsWith('B') && !featureId.startsWith('GB') && /^B\d{1,4}$/.test(featureId)) ||
    featureId.includes('Richness') ||
    /^(Annual|Monthly|Net|Precipitation|Temperature|Biome|EcoRegion|Elevation|Slope|DistToCoast)/.test(featureId)
  );
  
  return featureDescriptions[featureId] || {
    name: featureId,
    description: '特征描述不可用',
    category: featureId.startsWith('GB') ? 'Grambank' : 
              isDPlace ? 'D-PLACE' : 'Environmental'
  };
}

// 发现新特征 - 从完整数据库中查找用户可能感兴趣的特征
export async function discoverNewFeatures(userQuery, limit = 10) {
  try {
    
    // 搜索相关特征
    const searchResults = await searchFeatureDescriptions(userQuery, limit);
    
    // 按相关性排序
    const sortedResults = searchResults.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(userQuery.toLowerCase());
      const bNameMatch = b.name.toLowerCase().includes(userQuery.toLowerCase());
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return 0;
    });
    
    return sortedResults.map(feature => ({
      id: feature.id,
      name: feature.name,
      description: cleanDescription(feature.description),
      category: feature.category,
      source: feature.source,
      type: feature.type,
      relevance: 'high' // 可以根据匹配度调整
    }));
  } catch (error) {
    console.error('特征发现失败:', error);
    return [];
  }
}

// 获取数据库概览
export async function getDatabaseOverview() {
  try {
    const stats = await getFeatureStatistics();
    
    return {
      totalFeatures: (stats?.totalGrambankFeatures || 0) + (stats?.totalDplaceFeatures || 0),
      grambankFeatures: stats?.totalGrambankFeatures || 0,
      dplaceFeatures: stats?.totalDplaceFeatures || 0,
      grambankCategories: stats?.grambankCategories || [],
      dplaceCategories: stats?.dplaceCategories || [],
      sampleFeatures: stats?.sampleFeatures || { grambank: [], dplace: [] }
    };
  } catch (error) {
    console.error('获取数据库概览失败:', error);
    return null;
  }
} 