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
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    const data = d3.csvParse(text);
    
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
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    const data = d3.csvParse(text);
    
    // 清理和格式化数据
    const variables = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description,
      category: row.category || 'Other',
      source: row.source || 'D-PLACE'
    }));
    
    cachedVariables = variables;
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
    const response = await fetch(`public/grambank-grambank-7ae000c/cldf/languages.csv`);
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
  
  
  try {
    // 搜索Grambank参数
    const parameters = await loadGrambankParameters();
    
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
      
      // 使用统一的匹配逻辑，不进行特殊处理
      return originalMatch || expandedMatch;
    }).slice(0, limit);
    
    if (gbMatches.length > 0) {
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
