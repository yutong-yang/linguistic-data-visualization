// 智能特征推荐系统 - 让LLM探索完整数据库
import { searchKnowledgeBase } from './knowledgeBaseUtils.js';
import { 
  loadGrambankParameters, 
  loadDplaceVariables, 
  searchFeatureDescriptions,
  getFeatureStatistics,
  getFeaturesByCategory,
  cleanDescription
} from './databaseExplorer.js';
async function callFeatureRecommendationAPI(prompt) {
  try {
    const API_KEY = localStorage.getItem('GEMINI_API_KEY');
    if (!API_KEY) {
      throw new Error('API_KEY_NOT_SET');
    }
    
    const API_URL = window.CONFIG?.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
    
    console.log('Making feature recommendation API request to:', API_URL);
    
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
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid API response format');
    }
  } catch (error) {
    console.error('Feature recommendation API error:', error);
    throw error;
  }
}

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

// 使用LLM探索完整数据库并推荐特征
export async function recommendFeatures(userQuery, languageData, featureDescriptions) {
  try {
    console.log('开始探索完整数据库进行特征推荐...');
    
    // 1. 获取数据库统计信息
    const stats = await getFeatureStatistics();
    console.log('数据库统计:', stats);
    
    // 2. 搜索相关特征描述
    const searchResults = await searchFeatureDescriptions(userQuery, 30);
    console.log('搜索到的相关特征:', searchResults.length);
    
    // 3. 获取当前数据中的特征
    const currentFeatures = getAllAvailableFeatures(languageData);
    
    // 4. 构建数据样本
    const dataSample = languageData.slice(0, 5).map(lang => {
      const sampleFeatures = {};
      currentFeatures.slice(0, 10).forEach(feature => {
        if (lang[feature] !== null && lang[feature] !== undefined) {
          sampleFeatures[feature] = lang[feature];
        }
      });
      return {
        name: lang.Name || lang.name,
        family: lang.Family_level_ID || lang.family,
        features: sampleFeatures
      };
    });
    
    // 5. 构建LLM提示，包含完整的数据库信息
    const prompt = `你是一位专业的语言学数据分析专家。现在你有机会探索完整的语言学数据库来为用户推荐最相关的特征。

=== 用户问题 ===
${userQuery}

=== 完整数据库信息 ===
Grambank数据库: ${stats?.totalGrambankFeatures || 0} 个语法特征
D-PLACE数据库: ${stats?.totalDplaceFeatures || 0} 个社会文化特征

=== 搜索到的相关特征 (${searchResults.length}个) ===
${searchResults.map(feature => 
  `${feature.id} (${feature.source}): ${feature.name}
   分类: ${feature.category}
   描述: ${cleanDescription(feature.description).substring(0, 150)}...`
).join('\n\n')}

=== 当前数据中的特征 (${currentFeatures.length}个) ===
${currentFeatures.slice(0, 20).join(', ')}${currentFeatures.length > 20 ? '...' : ''}

=== 数据样本 (5种语言) ===
${dataSample.map(lang => 
  `${lang.name} (${lang.family}): ${Object.entries(lang.features).map(([k, v]) => `${k}=${v}`).join(', ')}`
).join('\n')}

=== 任务 ===
请分析用户问题，从完整数据库中推荐最相关的特征。你可以：
1. 从搜索到的相关特征中选择
2. 从当前数据中的特征中选择
3. 推荐数据库中其他相关特征

请按以下JSON格式返回推荐：

{
  "recommendations": [
    {
      "category": "特征分类名称",
      "name": "推荐组名称", 
      "description": "推荐理由",
      "features": ["特征ID1", "特征ID2", "特征ID3"],
      "reason": "为什么推荐这些特征",
      "source": "Grambank/D-PLACE/Current Data"
    }
  ]
}

要求：
1. 优先推荐搜索到的相关特征
2. 确保推荐的特征在数据库中实际存在
3. 考虑特征之间的关联性和互补性
4. 提供清晰的推荐理由
5. 标注特征来源（Grambank/D-PLACE/当前数据）`;

    // 调用LLM获取推荐
    const response = await callFeatureRecommendationAPI(prompt);
    
    // 解析LLM响应
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.recommendations) {
          // 验证推荐的特征是否存在
          parsed.recommendations.forEach(rec => {
            rec.features = validateFeatures(rec.features, languageData, featureDescriptions);
          });
          return parsed.recommendations.filter(rec => rec.features.length > 0);
        }
      }
    } catch (parseError) {
      console.warn('LLM响应解析失败，使用备用方法:', parseError);
    }
    
    // 如果LLM解析失败，使用备用方法
    return await fallbackRecommendation(userQuery, languageData, featureDescriptions);
    
  } catch (error) {
    console.error('LLM特征推荐失败:', error);
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
    console.log('开始发现新特征...');
    
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