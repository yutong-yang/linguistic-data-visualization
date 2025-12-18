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
    // 检查特征是否在数据中存在
    const hasData = languageData.length > 0 && languageData[0].hasOwnProperty(feature);
    // 检查特征是否有描述
    const hasDescription = featureDescriptions && featureDescriptions[feature];
    
    if (hasData || hasDescription) {
      validFeatures.push(feature);
    } else {
      invalidFeatures.push(feature);
    }
  });
  
  if (invalidFeatures.length > 0) {
    console.warn('发现无效特征:', invalidFeatures);
  }
  
  return validFeatures;
}

// 使用后端API推荐特征
export async function recommendFeatures(userQuery, languageData, featureDescriptions) {
  try {
    // 获取当前选择的 API provider
    const apiProvider = getSelectedAPIProvider() || 'gemini';
    
    // 获取对应的 API Key
    const apiKey = getAPIKey(apiProvider);
    if (!apiKey) {
      const providerName = apiProvider === 'qianwen' ? 'QIANWEN' : 'GEMINI';
      throw new Error(`${providerName}_API_KEY未设置`);
    }
    
    // 调用后端API
    const response = await fetch(buildApiUrl(API_ENDPOINTS.featureRecommendation), {
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
        api_provider: apiProvider  // 传递 API provider 类型
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `API请求失败: ${response.status}`);
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
    // 如果后端API失败，使用备用方法
    return await fallbackRecommendation(userQuery, languageData, featureDescriptions);
  }
}

// 备用推荐方法（当LLM失败时使用）
async function fallbackRecommendation(userQuery, languageData, featureDescriptions) {
  try {
    const query = userQuery.toLowerCase();
    const allFeatures = getAllAvailableFeatures(languageData);
    const recommendations = [];
    
    // 基于关键词的简单匹配
    const keywordMappings = {
      '性别': ['GB030', 'GB051', 'GB052', 'GB053', 'GB054'],
      'gender': ['GB030', 'GB051', 'GB052', 'GB053', 'GB054'],
      '分类词': ['GB038', 'GB057', 'GB058'],
      'classifier': ['GB038', 'GB057', 'GB058'],
      '形态': ['GB020', 'GB021', 'GB022', 'GB023'],
      'morphology': ['GB020', 'GB021', 'GB022', 'GB023'],
      '句法': ['GB025', 'GB026', 'GB027'],
      'syntax': ['GB025', 'GB026', 'GB027'],
      '社会': ['EA044', 'EA045', 'EA046', 'EA047', 'EA048'],
      'social': ['EA044', 'EA045', 'EA046', 'EA047', 'EA048'],
      '环境': ['AmphibianRichness', 'BirdRichness', 'MammalRichness', 'VascularPlantsRichness'],
      'environment': ['AmphibianRichness', 'BirdRichness', 'MammalRichness', 'VascularPlantsRichness']
    };
    
    // 查找匹配的关键词
    for (const [keyword, features] of Object.entries(keywordMappings)) {
      if (query.includes(keyword)) {
        const validFeatures = validateFeatures(features, languageData, featureDescriptions);
        if (validFeatures.length > 0) {
          recommendations.push({
            category: keyword,
            name: `${keyword}相关特征`,
            description: `基于关键词"${keyword}"的推荐`,
            features: validFeatures,
            reason: `匹配关键词: ${keyword}`
          });
        }
      }
    }
    
    // 如果没有匹配，返回一些常用特征
    if (recommendations.length === 0) {
      const commonFeatures = validateFeatures(['GB020', 'GB030', 'GB051', 'EA044'], languageData, featureDescriptions);
      if (commonFeatures.length > 0) {
        recommendations.push({
          category: 'general',
          name: '通用特征',
          description: '常用的语言学特征',
          features: commonFeatures,
          reason: '通用推荐'
        });
      }
    }
    
    return recommendations;
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
    
    // 提取环境特征
    if (content.includes('richness')) {
      features.add('AmphibianRichness');
      features.add('BirdRichness');
      features.add('MammalRichness');
      features.add('VascularPlantsRichness');
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
    
    // 提取环境特征
    if (content.includes('richness')) {
      features.add('AmphibianRichness');
      features.add('BirdRichness');
      features.add('MammalRichness');
      features.add('VascularPlantsRichness');
    }
  });
  
  return Array.from(features);
}

// 基于数据相关性推荐特征
function recommendBasedOnData(userQuery, languageData) {
  if (!languageData || languageData.length === 0) return [];
  
  const recommendations = [];
  const query = userQuery.toLowerCase();
  
  // 分析数据中的特征分布
  const featureStats = analyzeFeatureDistribution(languageData);
  
  // 根据查询内容推荐相关特征
  if (query.includes('gender') || query.includes('性别')) {
    const genderFeatures = featureStats.filter(f => f.feature.startsWith('GB') && 
      (f.feature.includes('030') || f.feature.includes('051') || f.feature.includes('052')));
    
    if (genderFeatures.length > 0) {
      recommendations.push({
        category: 'data_analysis',
        name: '语法性别分析',
        description: '基于数据分布的性别特征推荐',
        features: genderFeatures.map(f => f.feature),
        score: 2,
        reason: '数据中性别特征分布丰富'
      });
    }
  }
  
  if (query.includes('classifier') || query.includes('分类词')) {
    const classifierFeatures = featureStats.filter(f => f.feature.startsWith('GB') && 
      (f.feature.includes('038') || f.feature.includes('057') || f.feature.includes('058')));
    
    if (classifierFeatures.length > 0) {
      recommendations.push({
        category: 'data_analysis',
        name: '分类词系统分析',
        description: '基于数据分布的分类词特征推荐',
        features: classifierFeatures.map(f => f.feature),
        score: 2,
        reason: '数据中分类词特征分布丰富'
      });
    }
  }
  
  return recommendations;
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

// 生成研究建议
export function generateResearchIdeas(userQuery, recommendations, languageData) {
  const ideas = [];
  
  if (recommendations.length === 0) return ideas;
  
  // 基于推荐特征生成研究想法
  recommendations.forEach(rec => {
    if (rec.category === 'gender') {
      ideas.push({
        title: '语法性别系统的跨语言比较',
        description: `分析${rec.features.join(', ')}等性别特征在不同语言中的分布模式`,
        features: rec.features,
        analysis: 'correlation',
        visualization: 'map'
      });
    }
    
    if (rec.category === 'classifier') {
      ideas.push({
        title: '分类词系统的类型学研究',
        description: `探索${rec.features.join(', ')}等分类词特征的类型学模式`,
        features: rec.features,
        analysis: 'distribution',
        visualization: 'heatmap'
      });
    }
    
    if (rec.category === 'knowledge_based') {
      ideas.push({
        title: '基于文献的数据验证研究',
        description: `使用${rec.features.join(', ')}等特征验证相关理论假设`,
        features: rec.features,
        analysis: 'hypothesis_testing',
        visualization: 'scatter'
      });
    }
  });
  
  return ideas;
}

// 导出获取所有可用特征函数
export { getAllAvailableFeatures };

// 获取特征详细信息
export function getFeatureDetails(featureId, featureDescriptions) {
  return featureDescriptions[featureId] || {
    name: featureId,
    description: '特征描述不可用',
    category: featureId.startsWith('GB') ? 'Grambank' : 
              featureId.startsWith('EA') ? 'D-PLACE' : 'Environmental'
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