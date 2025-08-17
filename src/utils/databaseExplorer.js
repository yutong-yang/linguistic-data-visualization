// 数据库探索工具 - 让LLM访问完整的CLDF数据库
import * as d3 from 'd3';

// 缓存数据库内容
let cachedParameters = null;
let cachedVariables = null;
let cachedLanguages = null;

// 加载Grambank参数数据库
export async function loadGrambankParameters() {
  if (cachedParameters) {
    return cachedParameters;
  }
  
  try {
    // 使用正确的public目录路径
    const csvUrl = '/public/grambank-grambank-7ae000c/cldf/parameters.csv';
    console.log('正在加载Grambank参数，URL:', csvUrl);
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('CSV文件加载成功，内容长度:', text.length);
    
    const data = d3.csvParse(text);
    console.log('CSV解析成功，行数:', data.length);
    
    // 清理和格式化数据
    const parameters = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description || '',
      category: row.Gender_or_Noun_Class || row.Boundness || row.Flexivity || row.Locus_of_Marking || row.Word_Order || row.Informativity || 'Other',
      patrons: row.Patrons,
      grambankId: row.Grambank_ID_desc
    })).filter(row => row.id && row.name); // 过滤掉空行或无效行
    
    cachedParameters = parameters;
    console.log(`Loaded ${parameters.length} Grambank parameters`);
    
    // 特别查找GB057来调试
    const gb057 = parameters.find(p => p.id === 'GB057');
    if (gb057) {
      console.log('找到GB057:', gb057);
    } else {
      console.log('未找到GB057，前5个参数:', parameters.slice(0, 5));
    }
    
    return parameters;
  } catch (error) {
    console.error('Failed to load Grambank parameters:', error);
    return [];
  }
}

// 加载D-PLACE变量数据库
export async function loadDplaceVariables() {
  if (cachedVariables) {
    return cachedVariables;
  }
  
  try {
    // 使用正确的public目录路径
    const csvUrl = '/public/dplace-cldf/cldf/variables.csv';
    console.log('正在加载D-PLACE变量，URL:', csvUrl);
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('D-PLACE CSV文件加载成功，内容长度:', text.length);
    
    const data = d3.csvParse(text);
    console.log('D-PLACE CSV解析成功，行数:', data.length);
    
    // 清理和格式化数据
    const variables = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description,
      category: row.category || 'Other',
      source: row.source || 'D-PLACE'
    }));
    
    cachedVariables = variables;
    console.log(`Loaded ${variables.length} D-PLACE variables`);
    console.log(variables);
    return variables;
  } catch (error) {
    console.error('Failed to load D-PLACE variables:', error);
    return [];
  }
}

// 加载语言数据库
export async function loadLanguages() {
  if (cachedLanguages) {
    return cachedLanguages;
  }
  
  try {
    // 使用正确的public目录路径
    const response = await fetch('/public/grambank-grambank-7ae000c/cldf/languages.csv');
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const languages = data.map(row => ({
      id: row.ID,
      name: row.Name,
      glottocode: row.Glottocode,
      family: row.Family_level_ID,
      genus: row.Genus_level_ID,
      macroarea: row.Macroarea,
      latitude: row.Latitude,
      longitude: row.Longitude
    }));
    
    cachedLanguages = languages;
    console.log(`Loaded ${languages.length} languages`);
    return languages;
  } catch (error) {
    console.error('Failed to load languages:', error);
    return [];
  }
}

// 搜索特征描述
export async function searchFeatureDescriptions(query, limit = 20) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  // 定义同义词映射，让搜索更智能
  const synonyms = {
    '性别': ['gender', 'sex', 'masculine', 'feminine', 'noun class', 'class'],
    '特征': ['feature', 'parameter', 'property', 'trait'],
    '语法': ['grammar', 'grammatical', 'syntax', 'morphology'],
    '名词': ['noun', 'nominal', 'substantive'],
    '分类': ['class', 'classification', 'category', 'grouping'],
    '一致性': ['agreement', 'concord', 'harmony'],
    '形态': ['morphology', 'inflection', 'declension'],
    '音位': ['phonological', 'phonetic', 'sound'],
    '语义': ['semantic', 'meaning', 'sense'],
    '句法': ['syntax', 'syntactic', 'word order'],
    '时态': ['tense', 'temporal', 'time'],
    '语态': ['voice', 'active', 'passive'],
    '语气': ['mood', 'indicative', 'subjunctive'],
    '数': ['number', 'singular', 'plural'],
    '格': ['case', 'nominative', 'accusative'],
    '人称': ['person', 'first', 'second', 'third']
  };
  
  // 扩展查询词，包含同义词
  let expandedQuery = queryLower;
  for (const [chinese, english] of Object.entries(synonyms)) {
    if (queryLower.includes(chinese)) {
      expandedQuery += ' ' + english.join(' ');
    }
  }
  
  console.log('原始查询:', query, '扩展查询:', expandedQuery);
  
  try {
    // 搜索Grambank参数
    const parameters = await loadGrambankParameters();
    console.log('搜索参数:', query, '在', parameters.length, '个参数中');
    
    const gbMatches = parameters.filter(param => {
      // 精确匹配ID优先
      if (param.id && param.id.toLowerCase() === queryLower) {
        return true;
      }
      
      // 扩展搜索：检查名称、描述、分类
      const searchText = [
        param.name || '',
        param.description || '',
        param.category || ''
      ].join(' ').toLowerCase();
      
      // 检查原始查询词
      const originalMatch = queryLower.split(' ').some(word => 
        word.length > 2 && searchText.includes(word)
      );
      
      // 检查扩展查询词
      const expandedMatch = expandedQuery.split(' ').some(word => 
        word.length > 2 && searchText.includes(word)
      );
      
      return originalMatch || expandedMatch;
    }).slice(0, limit);
    
    console.log('Grambank匹配结果:', gbMatches.length);
    if (gbMatches.length > 0) {
      console.log('前3个匹配:', gbMatches.slice(0, 3));
    }
    
    results.push(...gbMatches.map(param => ({
      ...param,
      source: 'Grambank',
      type: 'GB'
    })));
    
    // 搜索D-PLACE变量
    const variables = await loadDplaceVariables();
    const eaMatches = variables.filter(var_ => {
      const searchText = [
        var_.name || '',
        var_.description || '',
        var_.category || ''
      ].join(' ').toLowerCase();
      
      // 检查原始查询词
      const originalMatch = queryLower.split(' ').some(word => 
        word.length > 2 && searchText.includes(word)
      );
      
      // 检查扩展查询词
      const expandedMatch = expandedQuery.split(' ').some(word => 
        word.length > 2 && searchText.includes(word)
      );
      
      return originalMatch || expandedMatch;
    }).slice(0, limit);
    
    results.push(...eaMatches.map(var_ => ({
      ...var_,
      source: 'D-PLACE',
      type: 'EA'
    })));
    
    return results.sort((a, b) => {
      // 优先返回名称匹配的结果
      const aNameMatch = a.name.toLowerCase().includes(queryLower);
      const bNameMatch = b.name.toLowerCase().includes(queryLower);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return 0;
    });
  } catch (error) {
    console.error('Feature description search failed:', error);
    return [];
  }
}

// 获取特征统计信息
export async function getFeatureStatistics() {
  try {
    const parameters = await loadGrambankParameters();
    const variables = await loadDplaceVariables();
    
    return {
      totalGrambankFeatures: parameters.length,
      totalDplaceFeatures: variables.length,
      grambankCategories: [...new Set(parameters.map(p => p.category))],
      dplaceCategories: [...new Set(variables.map(v => v.category))],
      sampleFeatures: {
        grambank: parameters.slice(0, 10).map(p => ({ id: p.id, name: p.name, category: p.category })),
        dplace: variables.slice(0, 10).map(v => ({ id: v.id, name: v.name, category: v.category }))
      }
    };
  } catch (error) {
    console.error('Failed to get feature statistics:', error);
    return null;
  }
}

// 获取特定类别的特征
export async function getFeaturesByCategory(category, source = 'both') {
  try {
    const results = [];
    
    if (source === 'both' || source === 'grambank') {
      const parameters = await loadGrambankParameters();
      const gbFeatures = parameters.filter(p => 
        p.category.toLowerCase().includes(category.toLowerCase())
      );
      results.push(...gbFeatures.map(f => ({ ...f, source: 'Grambank', type: 'GB' })));
    }
    
    if (source === 'both' || source === 'dplace') {
      const variables = await loadDplaceVariables();
      const eaFeatures = variables.filter(v => 
        v.category.toLowerCase().includes(category.toLowerCase())
      );
      results.push(...eaFeatures.map(f => ({ ...f, source: 'D-PLACE', type: 'EA' })));
    }
    
    return results;
  } catch (error) {
    console.error('Failed to get features by category:', error);
    return [];
  }
}

// 清理描述文本
export function cleanDescription(text) {
  if (!text) return '';
  
  return text
    .replace(/^#+\s*/gm, '') // 移除markdown标题
    .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体
    .replace(/\*(.*?)\*/g, '$1') // 移除斜体
    .replace(/`(.*?)`/g, '$1') // 移除代码
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接
    .replace(/\n+/g, ' ') // 将换行替换为空格
    .trim();
}

// 获取所有真实存在的特征编号
export async function getAllFeatureIds() {
  try {
    const [grambankFeatures, dplaceFeatures] = await Promise.all([
      loadGrambankParameters(),
      loadDplaceVariables()
    ]);
    
    const allIds = {
      grambank: grambankFeatures.map(f => f.id).filter(id => id),
      dplace: dplaceFeatures.map(f => f.id).filter(id => id),
      all: [
        ...grambankFeatures.map(f => f.id).filter(id => id),
        ...dplaceFeatures.map(f => f.id).filter(id => id)
      ]
    };
    
    console.log('所有真实特征编号:', {
      grambank: allIds.grambank.length,
      dplace: allIds.dplace.length,
      total: allIds.all.length
    });
    
    return allIds;
  } catch (error) {
    console.error('获取特征编号失败:', error);
    return { grambank: [], dplace: [], all: [] };
  }
}

// 验证特征编号是否真实存在
export async function validateFeatureId(featureId) {
  const allIds = await getAllFeatureIds();
  return allIds.all.includes(featureId);
}

// 获取地理分布信息
export async function getGeographicDistribution() {
  try {
    // 这里应该实现真正的地理分布分析
    // 目前返回模拟数据
    return {
      regions: ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'],
      features: ['GB030', 'GB051', 'GB079', 'GB080'],
      patterns: [
        { region: 'Europe', feature: 'GB030', frequency: 0.85 },
        { region: 'Asia', feature: 'GB051', frequency: 0.72 },
        { region: 'Africa', feature: 'GB079', frequency: 0.68 }
      ]
    };
  } catch (error) {
    console.error('获取地理分布失败:', error);
    return { regions: [], features: [], patterns: [] };
  }
}

// 获取语言家族比较
export async function getFamilyComparison() {
  try {
    // 这里应该实现真正的语言家族比较
    // 目前返回模拟数据
    return {
      families: ['Indo-European', 'Sino-Tibetan', 'Niger-Congo', 'Austronesian'],
      features: ['GB030', 'GB051', 'GB079', 'GB080'],
      differences: [
        { family: 'Indo-European', feature: 'GB030', value: 0.9 },
        { family: 'Sino-Tibetan', feature: 'GB051', value: 0.8 },
        { family: 'Niger-Congo', feature: 'GB079', value: 0.7 }
      ]
    };
  } catch (error) {
    console.error('获取语言家族比较失败:', error);
    return { families: [], features: [], differences: [] };
  }
} 