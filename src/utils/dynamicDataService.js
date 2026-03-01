// 动态数据服务 - 根据用户选择的特征动态构建数据
import * as d3 from 'd3';

// 缓存数据库内容
let cachedLanguages = null;
let cachedSocieties = null;
let cachedGbValues = null;
let cachedEaValues = null;
let cachedGbParameters = null;
let cachedEaVariables = null;
let cachedWalsLanguages = null;
let cachedWalsValues = null;
let cachedWalsParameters = null;
let cachedWalsCodes = null;

// 加载Grambank语言数据库
async function loadGrambankLanguages() {
  if (cachedLanguages) return cachedLanguages;
  
  try {
    const response = await fetch(`grambank-grambank-7ae000c/cldf/languages.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const languages = data.map(row => ({
      id: row.ID,
      name: row.Name,
      glottocode: row.Glottocode,
      family: row.Family_level_ID,
      macroarea: row.Macroarea,
      latitude: parseFloat(row.Latitude) || 0,
      longitude: parseFloat(row.Longitude) || 0
    })).filter(lang => lang.glottocode && lang.latitude && lang.longitude);
    
    cachedLanguages = languages;
    return languages;
  } catch (error) {
    console.error('Failed to load Grambank languages:', error);
    return [];
  }
}

// 加载D-PLACE社会群体数据库
async function loadDplaceSocieties() {
  if (cachedSocieties) return cachedSocieties;
  
  try {
    const response = await fetch(`dplace-cldf/cldf/societies.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const societies = data.map(row => ({
      id: row.ID,
      name: row.Name,
      glottocode: row.Glottocode,
      latitude: parseFloat(row.Latitude) || 0,
      longitude: parseFloat(row.Longitude) || 0,
      region: row.region,
      type: row.type
    })).filter(soc => soc.glottocode && soc.latitude && soc.longitude);
    
    cachedSocieties = societies;
    return societies;
  } catch (error) {
    console.error('Failed to load D-PLACE societies:', error);
    return [];
  }
}

// 加载Grambank特征值数据库
async function loadGrambankValues() {
  if (cachedGbValues) return cachedGbValues;
  
  try {
    const response = await fetch(`grambank-grambank-7ae000c/cldf/values.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    // 构建特征值索引：{ glottocode: { parameter: value } }
    const valuesIndex = {};
    data.forEach(row => {
      if (row.Language_ID && row.Parameter_ID && row.Value !== undefined && row.Value !== '' && row.Value !== 'NA') {
        if (!valuesIndex[row.Language_ID]) {
          valuesIndex[row.Language_ID] = {};
        }
        valuesIndex[row.Language_ID][row.Parameter_ID] = row.Value;
      }
    });
    
    cachedGbValues = valuesIndex;
    return valuesIndex;
  } catch (error) {
    console.error('Failed to load Grambank values:', error);
    return {};
  }
}

// 加载D-PLACE特征值数据库
async function loadDplaceValues() {
  if (cachedEaValues) return cachedEaValues;
  
  try {
    // 加载data.csv
    const dataResponse = await fetch(`dplace-cldf/cldf/data.csv`);
    const dataText = await dataResponse.text();
    const data = d3.csvParse(dataText);
    
    // 构建特征值索引：{ society_id: { variable: value } }
    const valuesIndex = {};
    
    data.forEach((row, index) => {
      // 性能优化：移除进度日志
      
      if (row.Society_ID && row.Var_ID && (row.Value !== undefined && row.Value !== '' || row.Code_ID)) {
        if (!valuesIndex[row.Society_ID]) {
          valuesIndex[row.Society_ID] = {};
        }
        
        let featureValue;
        
        if (row.Code_ID) {
          // 分类变量：直接保留Code_ID减去Var_ID剩下的数字
          const codeNumber = row.Code_ID.replace(row.Var_ID + '-', '');
          featureValue = codeNumber;
        } else if (row.Value !== undefined && row.Value !== '') {
          // 连续变量：直接使用Value
          featureValue = row.Value;
        }

        if (featureValue !== undefined) {
          valuesIndex[row.Society_ID][row.Var_ID] = featureValue;
        }
      }
    });
    
    cachedEaValues = valuesIndex;
    return valuesIndex;
  } catch (error) {
    console.error('Failed to load D-PLACE values:', error);
    return {};
  }
}

// 加载Grambank参数定义
async function loadGrambankParameters() {
  if (cachedGbParameters) return cachedGbParameters;
  
  try {
    const response = await fetch(`grambank-grambank-7ae000c/cldf/parameters.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const parameters = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description || ''
    }));
    
    cachedGbParameters = parameters;
    return parameters;
  } catch (error) {
    console.error('Failed to load Grambank parameters:', error);
    return [];
  }
}

// 加载D-PLACE变量定义
async function loadEaVariables() {
  if (cachedEaVariables) return cachedEaVariables;
  
  try {
    const response = await fetch(`dplace-cldf/cldf/variables.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const variables = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description || '',
      type: row.type || 'Unknown', // 变量类型：Continuous, Categorical, Ordinal
      category: row.category || '',
      unit: row.unit || ''
    }));
    
    cachedEaVariables = variables;
    return variables;
  } catch (error) {
    console.error('Failed to load D-PLACE variables:', error);
    return [];
  }
}

// 加载WALS语言数据库
async function loadWalsLanguages() {
  if (cachedWalsLanguages) return cachedWalsLanguages;
  
  try {
    const response = await fetch(`cldf-datasets-wals-014143f/cldf/languages.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const languages = data.map(row => ({
      id: row.ID,
      name: row.Name,
      glottocode: row.Glottocode,
      family: row.Family,
      macroarea: row.Macroarea,
      latitude: parseFloat(row.Latitude) || 0,
      longitude: parseFloat(row.Longitude) || 0
    })).filter(lang => lang.latitude && lang.longitude);
    
    cachedWalsLanguages = languages;
    return languages;
  } catch (error) {
    console.error('Failed to load WALS languages:', error);
    return [];
  }
}

// 加载WALS特征值数据库
async function loadWalsValues() {
  if (cachedWalsValues) return cachedWalsValues;
  
  try {
    const response = await fetch(`cldf-datasets-wals-014143f/cldf/values.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    // 构建特征值索引：{ language_id: { parameter: value } }
    const valuesIndex = {};
    data.forEach(row => {
      if (row.Language_ID && row.Parameter_ID && row.Value !== undefined && row.Value !== '' && row.Value !== 'NA') {
        if (!valuesIndex[row.Language_ID]) {
          valuesIndex[row.Language_ID] = {};
        }
        // 存储Code_ID作为值
        valuesIndex[row.Language_ID][row.Parameter_ID] = row.Code_ID || row.Value;
      }
    });
    
    cachedWalsValues = valuesIndex;
    return valuesIndex;
  } catch (error) {
    console.error('Failed to load WALS values:', error);
    return {};
  }
}

// 加载WALS特征参数数据库
async function loadWalsParameters() {
  if (cachedWalsParameters) return cachedWalsParameters;
  
  try {
    const response = await fetch(`cldf-datasets-wals-014143f/cldf/parameters.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const parameters = {};
    data.forEach(row => {
      if (row.ID) {
        parameters[row.ID] = {
          id: row.ID,
          name: row.Name,
          description: row.Description || row.Name,
          area: row.Area,
          chapter: row.Chapter
        };
      }
    });
    
    cachedWalsParameters = parameters;
    return parameters;
  } catch (error) {
    console.error('Failed to load WALS parameters:', error);
    return {};
  }
}

// 加载WALS特征值代码（codes.csv）
async function loadWalsCodes() {
  if (cachedWalsCodes) return cachedWalsCodes;
  
  try {
    const response = await fetch(`cldf-datasets-wals-014143f/cldf/codes.csv`);
    const text = await response.text();
    const data = d3.csvParse(text);
    
    // 构建代码索引：{ code_id: { name, description } }
    const codes = {};
    data.forEach(row => {
      if (row.ID) {
        codes[row.ID] = {
          id: row.ID,
          parameterId: row.Parameter_ID,
          name: row.Name,
          description: row.Description || row.Name,
          number: row.Number
        };
      }
    });
    
    cachedWalsCodes = codes;
    return codes;
  } catch (error) {
    console.error('Failed to load WALS codes:', error);
    return {};
  }
}

// 导出获取WALS代码描述的函数
export async function getWalsCodeDescription(codeId) {
  const codes = await loadWalsCodes();
  return codes[codeId] || null;
}

// 动态构建数据
export async function buildDynamicData(selectedGBFeatures, selectedEAFeatures, selectedWALSFeatures = [], filterMode = 'intersection') {
  
  try {
    // 并行加载所有必要的数据
    const [languages, societies, walsLanguages, gbValues, eaValues, walsValues, gbParams, eaVars, walsParams] = await Promise.all([
      loadGrambankLanguages(),
      loadDplaceSocieties(),
      loadWalsLanguages(),
      loadGrambankValues(),
      loadDplaceValues(),
      loadWalsValues(),
      loadGrambankParameters(),
      loadEaVariables(),
      loadWalsParameters()
    ]);
    
    // 构建语言到社会的映射
    const languageToSocieties = {};
    societies.forEach(soc => {
      if (soc.glottocode) {
        if (!languageToSocieties[soc.glottocode]) {
          languageToSocieties[soc.glottocode] = [];
        }
        languageToSocieties[soc.glottocode].push(soc);
      }
    });

    // 构建WALS语言ID到Grambank glottocode的映射
    const walsIdToGlottocode = {};
    const glottocodeToWalsId = {};
    walsLanguages.forEach(lang => {
      if (lang.id) {
        walsIdToGlottocode[lang.id] = lang.glottocode;
        if (lang.glottocode) {
          if (!glottocodeToWalsId[lang.glottocode]) {
            glottocodeToWalsId[lang.glottocode] = [];
          }
          glottocodeToWalsId[lang.glottocode].push(lang.id);
        }
      }
    });
    
    // 构建结果数据
    const resultData = [];
    
    let totalLanguages = 0;
    let filteredLanguages = 0;
    let displayedLanguages = 0;
    
    // 处理Grambank语言
    languages.forEach(lang => {
      totalLanguages++;
      
      const langGbValues = gbValues[lang.glottocode] || {};
      const langSocieties = languageToSocieties[lang.glottocode] || [];
      
      // 检查是否有选中的GB特征
      let hasSelectedGbFeatures = false;
      if (selectedGBFeatures.length > 0) {
        if (filterMode === 'intersection') {
          // 交集模式：必须拥有所有特征
          hasSelectedGbFeatures = selectedGBFeatures.every(feature => {
            const value = langGbValues[feature];
            return value !== undefined && value !== 'NA' && value !== null && value !== '';
          });
        } else {
          // 并集模式：拥有任意一个特征即可
          hasSelectedGbFeatures = selectedGBFeatures.some(feature => {
            const value = langGbValues[feature];
            return value !== undefined && value !== 'NA' && value !== null && value !== '';
          });
        }
      }
      
      // 检查是否有选中的WALS特征
      let hasSelectedWalsFeatures = false;
      let walsFeatureValues = {};
      const langWalsIds = glottocodeToWalsId[lang.glottocode] || [];
      
      if (selectedWALSFeatures.length > 0 && langWalsIds.length > 0) {
        if (filterMode === 'intersection') {
          // 交集模式：必须拥有所有WALS特征
          const allWalsFeaturesValid = selectedWALSFeatures.every(feature => {
            // 检查是否有任何WALS语言ID有这个特征的数据
            return langWalsIds.some(walsId => {
              const langWalsValues = walsValues[walsId] || {};
              const value = langWalsValues[feature];
              return value !== undefined && value !== 'NA' && value !== null && value !== '';
            });
          });
          
          if (allWalsFeaturesValid) {
            hasSelectedWalsFeatures = true;
            // 收集所有WALS特征值（从第一个有数据的WALS语言获取）
            selectedWALSFeatures.forEach(feature => {
              for (const walsId of langWalsIds) {
                const langWalsValues = walsValues[walsId] || {};
                const value = langWalsValues[feature];
                if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
                  walsFeatureValues[feature] = value;
                  break;
                }
              }
            });
          }
        } else {
          // 并集模式：拥有任意一个WALS特征即可
          const hasAnyWalsFeatures = selectedWALSFeatures.some(feature => {
            return langWalsIds.some(walsId => {
              const langWalsValues = walsValues[walsId] || {};
              const value = langWalsValues[feature];
              return value !== undefined && value !== 'NA' && value !== null && value !== '';
            });
          });
          
          if (hasAnyWalsFeatures) {
            hasSelectedWalsFeatures = true;
            // 收集所有可用的WALS特征值
            selectedWALSFeatures.forEach(feature => {
              for (const walsId of langWalsIds) {
                const langWalsValues = walsValues[walsId] || {};
                const value = langWalsValues[feature];
                if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
                  walsFeatureValues[feature] = value;
                  break;
                }
              }
            });
          }
        }
      }
      
      // 检查是否有选中的EA特征
      let hasSelectedEaFeatures = false;
      let eaFeatureValues = {};
      
      if (selectedEAFeatures.length > 0 && langSocieties.length > 0) {
        if (filterMode === 'intersection') {
          // 交集模式：检查所有EA特征是否都有有效数据
          const allEaFeaturesValid = selectedEAFeatures.every(feature => {
            // 检查是否有任何society有这个特征的数据，且值不是NA
            return langSocieties.some(soc => {
              const socEaValues = eaValues[soc.id] || {};
              const value = socEaValues[feature];
              return value !== undefined && value !== 'NA' && value !== null && value !== '';
            });
          });
          
          if (allEaFeaturesValid) {
            hasSelectedEaFeatures = true;
            
            // 收集所有EA特征值（从第一个有数据的society获取）
            selectedEAFeatures.forEach(feature => {
              for (const soc of langSocieties) {
                const socEaValues = eaValues[soc.id] || {};
                const value = socEaValues[feature];
                if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
                  eaFeatureValues[feature] = value;
                  break; // 找到第一个有效值就停止
                }
              }
            });
          } else {
            filteredLanguages++;
          }
        } else {
          // 并集模式：检查是否有任意EA特征有有效数据
          const hasAnyEaFeatures = selectedEAFeatures.some(feature => {
            return langSocieties.some(soc => {
              const socEaValues = eaValues[soc.id] || {};
              const value = socEaValues[feature];
              return value !== undefined && value !== 'NA' && value !== null && value !== '';
            });
          });
          
          if (hasAnyEaFeatures) {
            hasSelectedEaFeatures = true;
            
            // 收集所有可用的EA特征值（从第一个有数据的society获取）
            selectedEAFeatures.forEach(feature => {
              for (const soc of langSocieties) {
                const socEaValues = eaValues[soc.id] || {};
                const value = socEaValues[feature];
                if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
                  eaFeatureValues[feature] = value;
                  break; // 找到第一个有效值就停止
                }
              }
            });
          } else {
            filteredLanguages++;
          }
        }
      } else if (selectedEAFeatures.length > 0) {
        // 没有societies但选择了EA特征
        hasSelectedEaFeatures = false; // 没有数据，设为false
        filteredLanguages++;
      }
      
      // 检查GB特征缺失的情况
      if (selectedGBFeatures.length > 0 && !hasSelectedGbFeatures) {
        filteredLanguages++;
      }
      
      // 只有当语言有相关特征时才添加到结果中
      if (filterMode === 'intersection') {
        // 交集模式：只检查被选中的数据集
        // 如果选了GB特征，必须满足GB条件；如果选了EA特征，必须满足EA条件；WALS同理
        const gbCondition = selectedGBFeatures.length === 0 || hasSelectedGbFeatures;
        const eaCondition = selectedEAFeatures.length === 0 || hasSelectedEaFeatures;
        const walsCondition = selectedWALSFeatures.length === 0 || hasSelectedWalsFeatures;
        const shouldInclude = gbCondition && eaCondition && walsCondition;
        
        if (shouldInclude) {
          const dataPoint = {
            Language_ID: lang.glottocode,
            Name: lang.name,
            Latitude: lang.latitude,
            Longitude: lang.longitude,
            Family_level_ID: lang.family,
            Macroarea: lang.macroarea,
            region: langSocieties[0]?.region || '',
            Soc_ID: langSocieties[0]?.id || ''
          };
          
          // 添加GB特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedGBFeatures.forEach(feature => {
            const value = langGbValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          // 添加EA特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedEAFeatures.forEach(feature => {
            const value = eaFeatureValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          // 添加WALS特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedWALSFeatures.forEach(feature => {
            const value = walsFeatureValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          resultData.push(dataPoint);
          displayedLanguages++;
        }
      } else {
        // 并集模式：GB、EA和WALS特征之间取并集
        if (hasSelectedGbFeatures || hasSelectedEaFeatures || hasSelectedWalsFeatures) {
          const dataPoint = {
            Language_ID: lang.glottocode,
            Name: lang.name,
            Latitude: lang.latitude,
            Longitude: lang.longitude,
            Family_level_ID: lang.family,
            Macroarea: lang.macroarea,
            region: langSocieties[0]?.region || '',
            Soc_ID: langSocieties[0]?.id || ''
          };
          
          // 添加GB特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedGBFeatures.forEach(feature => {
            const value = langGbValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          // 添加EA特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedEAFeatures.forEach(feature => {
            const value = eaFeatureValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          // 添加WALS特征值（确保所有选中的特征都出现在数据中，没有数据的设为'NA'）
          selectedWALSFeatures.forEach(feature => {
            const value = walsFeatureValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            } else {
              // 即使没有数据，也要添加该特征字段，设为'NA'
              dataPoint[feature] = 'NA';
            }
          });
          
          resultData.push(dataPoint);
          displayedLanguages++;
        }
      }
    });
    
    return resultData;
    
  } catch (error) {
    console.error('Error building dynamic data:', error);
    return [];
  }
}

// 获取特征描述
export async function getFeatureDescriptions() {
  const [gbParams, eaVars, walsParams] = await Promise.all([
    loadGrambankParameters(),
    loadEaVariables(),
    loadWalsParameters()
  ]);
  
  const descriptions = {};
  
  gbParams.forEach(param => {
    descriptions[param.id] = {
      name: param.name,
      description: param.description
    };
  });
  
  eaVars.forEach(variable => {
    descriptions[variable.id] = {
      name: variable.name,
      description: variable.description,
      type: variable.type,
      category: variable.category,
      unit: variable.unit
    };
  });
  
  Object.values(walsParams).forEach(param => {
    descriptions[param.id] = {
      name: param.name,
      description: param.description,
      area: param.area,
      chapter: param.chapter
    };
  });
  
  return descriptions;
}

// 清除缓存（用于重新加载数据）
export function clearCache() {
  cachedLanguages = null;
  cachedSocieties = null;
  cachedGbValues = null;
  cachedEaValues = null;
  cachedGbParameters = null;
  cachedEaVariables = null;
  cachedWalsLanguages = null;
  cachedWalsValues = null;
  cachedWalsParameters = null;
  cachedWalsCodes = null;
}
