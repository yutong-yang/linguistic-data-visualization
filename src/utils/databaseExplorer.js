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
    const response = await fetch('/grambank-grambank-7ae000c/cldf/parameters.csv');
    const text = await response.text();
    const data = d3.csvParse(text);
    
    // 清理和格式化数据
    const parameters = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description,
      category: row.Gender_or_Noun_Class || row.Boundness || row.Flexivity || row.Locus_of_Marking || row.Word_Order || row.Informativity || 'Other',
      patrons: row.Patrons,
      grambankId: row.Grambank_ID_desc
    }));
    
    cachedParameters = parameters;
    console.log(`Loaded ${parameters.length} Grambank parameters`);
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
    const response = await fetch('/dplace-cldf/cldf/variables.csv');
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
    console.log(`Loaded ${variables.length} D-PLACE variables`);
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
    const response = await fetch('/grambank-grambank-7ae000c/cldf/languages.csv');
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
  
  try {
    // 搜索Grambank参数
    const parameters = await loadGrambankParameters();
    const gbMatches = parameters.filter(param => 
      param.name.toLowerCase().includes(queryLower) ||
      param.description.toLowerCase().includes(queryLower) ||
      param.category.toLowerCase().includes(queryLower)
    ).slice(0, limit);
    
    results.push(...gbMatches.map(param => ({
      ...param,
      source: 'Grambank',
      type: 'GB'
    })));
    
    // 搜索D-PLACE变量
    const variables = await loadDplaceVariables();
    const eaMatches = variables.filter(var_ => 
      var_.name.toLowerCase().includes(queryLower) ||
      var_.description.toLowerCase().includes(queryLower) ||
      var_.category.toLowerCase().includes(queryLower)
    ).slice(0, limit);
    
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