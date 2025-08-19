// 动态数据服务 - 根据用户选择的特征动态构建数据
import * as d3 from 'd3';

// 缓存数据库内容
let cachedLanguages = null;
let cachedSocieties = null;
let cachedGbValues = null;
let cachedEaValues = null;
let cachedGbParameters = null;
let cachedEaVariables = null;

// 加载Grambank语言数据库
async function loadGrambankLanguages() {
  if (cachedLanguages) return cachedLanguages;
  
  try {
    const response = await fetch('/grambank-grambank-7ae000c/cldf/languages.csv');
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
    console.log(`Loaded ${languages.length} Grambank languages`);
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
    const response = await fetch('/dplace-cldf/cldf/societies.csv');
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
    
    // 调试信息：显示society ID和Glottocode映射
    console.log('Sample societies with Glottocodes:', 
      societies.slice(0, 5).map(soc => `${soc.id} -> ${soc.glottocode} (${soc.name})`)
    );
    
    cachedSocieties = societies;
    console.log(`Loaded ${societies.length} D-PLACE societies`);
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
    const response = await fetch('/grambank-grambank-7ae000c/cldf/values.csv');
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
    console.log(`Loaded Grambank values for ${Object.keys(valuesIndex).length} languages`);
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
    console.log('=== 开始加载D-PLACE数据 ===');
    
    // 只加载data.csv
    const dataResponse = await fetch('/dplace-cldf/cldf/data.csv');
    
    console.log('CSV文件响应状态:', {
      data: dataResponse.status
    });
    
    const dataText = await dataResponse.text();
    
    console.log('CSV文件大小:', {
      data: dataText.length
    });
    
    const data = d3.csvParse(dataText);
    
    console.log('解析后的数据行数:', {
      data: data.length
    });
    
    // 检查第一行数据
    if (data.length > 0) {
      console.log('第一行data.csv数据:', data[0]);
      console.log('data.csv字段名:', Object.keys(data[0]));
    }
    
    // 构建特征值索引：{ society_id: { variable: value } }
    const valuesIndex = {};
    console.log('开始处理数据行...');
    
    data.forEach((row, index) => {
      // 每1000行打印一次进度
      if (index % 1000 === 0) {
        console.log(`处理第 ${index} 行数据...`);
      }
      
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

        // 只在处理前100行时打印详细调试信息
        if (index < 100) {
          console.log(`行 ${index}: ${row.Society_ID} -> ${row.Var_ID} = ${featureValue}`);
        }
        
        if (featureValue !== undefined) {
          valuesIndex[row.Society_ID][row.Var_ID] = featureValue;
        }
      } else {
        // 只在处理前100行时显示不符合条件的数据
        if (index < 100) {
          console.log(`行 ${index} 不符合条件:`, {
            Society_ID: row.Society_ID,
            Var_ID: row.Var_ID,
            Value: row.Value,
            Code_ID: row.Code_ID
          });
        }
      }
    });
    
    // 调试信息
    console.log('D-PLACE data sample:', data.slice(0, 5));
    console.log('Values index sample:', Object.keys(valuesIndex).slice(0, 5));
    console.log('Sample society values:', valuesIndex[Object.keys(valuesIndex)[0]]);
    
    // 检查特定society的数据
    const testSocietyId = 'B72'; // !Kung
    if (valuesIndex[testSocietyId]) {
      console.log(`Test society ${testSocietyId} values:`, valuesIndex[testSocietyId]);
    } else {
      console.log(`Test society ${testSocietyId} not found in valuesIndex`);
    }
    
    // 检查原始数据中是否有这个society
    const testSocietyData = data.filter(row => row.Society_ID === testSocietyId);
    console.log(`Test society ${testSocietyId} raw data rows:`, testSocietyData.length);
    if (testSocietyData.length > 0) {
      console.log(`Sample raw data for ${testSocietyId}:`, testSocietyData[0]);
    }
    
    cachedEaValues = valuesIndex;
    console.log(`Loaded D-PLACE values for ${Object.keys(valuesIndex).length} societies`);
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
    const response = await fetch('/grambank-grambank-7ae000c/cldf/parameters.csv');
    const text = await response.text();
    const data = d3.csvParse(text);
    
    const parameters = data.map(row => ({
      id: row.ID,
      name: row.Name,
      description: row.Description || ''
    }));
    
    cachedGbParameters = parameters;
    console.log(`Loaded ${parameters.length} Grambank parameters`);
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
    const response = await fetch('/dplace-cldf/cldf/variables.csv');
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
    console.log(`Loaded ${variables.length} D-PLACE variables`);
    return variables;
  } catch (error) {
    console.error('Failed to load D-PLACE variables:', error);
    return [];
  }
}

// 动态构建数据
export async function buildDynamicData(selectedGbFeatures, selectedEaFeatures) {
  console.log('Building dynamic data for features:', { selectedGbFeatures, selectedEaFeatures });
  
  try {
    // 并行加载所有必要的数据
    const [languages, societies, gbValues, eaValues, gbParams, eaVars] = await Promise.all([
      loadGrambankLanguages(),
      loadDplaceSocieties(),
      loadGrambankValues(),
      loadDplaceValues(),
      loadGrambankParameters(),
      loadEaVariables()
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

    // 调试信息：显示映射情况
    console.log('Language to societies mapping sample:', 
      Object.entries(languageToSocieties).slice(0, 3).map(([glotto, socs]) => 
        `${glotto}: ${socs.length} societies (${socs.map(s => s.id).join(', ')})`
      )
    );
    
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
      const hasSelectedGbFeatures = selectedGbFeatures.length > 0 && selectedGbFeatures.every(feature => {
        const value = langGbValues[feature];
        return value !== undefined && value !== 'NA' && value !== null && value !== '';
      });
      
      // 检查是否有选中的EA特征
      let hasSelectedEaFeatures = false;
      let eaFeatureValues = {};
      
      if (langSocieties.length > 0) {
        console.log(`Language ${lang.glottocode} has ${langSocieties.length} societies:`, 
          langSocieties.map(s => `${s.id} (${s.name})`)
        );
        
        // 检查所有EA特征是否都有有效数据
        const allEaFeaturesValid = selectedEaFeatures.every(feature => {
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
          selectedEaFeatures.forEach(feature => {
            for (const soc of langSocieties) {
              const socEaValues = eaValues[soc.id] || {};
              const value = socEaValues[feature];
              if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
                eaFeatureValues[feature] = value;
                console.log(`Found EA feature ${feature} = ${value} for society ${soc.id}`);
                break; // 找到第一个有效值就停止
              }
            }
          });
        } else {
          // 调试信息：显示缺失的EA特征
          console.log(`Language ${lang.glottocode} missing some EA features:`, 
            selectedEaFeatures.map(feature => {
              const hasFeature = langSocieties.some(soc => {
                const socEaValues = eaValues[soc.id] || {};
                return socEaValues[feature] !== undefined;
              });
              return { feature, hasData: hasFeature };
            })
          );
          filteredLanguages++;
        }
      } else {
        console.log(`No societies found for language ${lang.glottocode}`);
        if (selectedEaFeatures.length > 0) {
          filteredLanguages++;
        }
      }
      
      // 检查GB特征缺失的情况
      if (selectedGbFeatures.length > 0 && !hasSelectedGbFeatures) {
        console.log(`Language ${lang.glottocode} missing some GB features:`, 
          selectedGbFeatures.map(feature => ({
            feature, 
            hasData: langGbValues[feature] !== undefined
          }))
        );
        filteredLanguages++;
      }
      
      // 只有当语言有相关特征时才添加到结果中
      // 如果有EA特征，必须所有EA特征都有数据才添加
      if (selectedEaFeatures.length > 0) {
        // 有EA特征时，必须所有EA特征都有数据
        if (hasSelectedEaFeatures) {
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
          
          // 添加GB特征值
          selectedGbFeatures.forEach(feature => {
            const value = langGbValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            }
          });
          
          // 添加EA特征值
          selectedEaFeatures.forEach(feature => {
            const value = eaFeatureValues[feature];
            if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
              dataPoint[feature] = value;
            }
          });
          
          resultData.push(dataPoint);
          displayedLanguages++;
        }
      } else if (hasSelectedGbFeatures) {
        // 没有EA特征时，只检查GB特征
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
        
        // 添加GB特征值
        selectedGbFeatures.forEach(feature => {
          const value = langGbValues[feature];
          if (value !== undefined && value !== 'NA' && value !== null && value !== '') {
            dataPoint[feature] = value;
          }
        });
        
        resultData.push(dataPoint);
        displayedLanguages++;
      }
    });
    
    // 显示过滤统计信息
    if (selectedEaFeatures.length > 0 || selectedGbFeatures.length > 0) {
      console.log(`Dynamic data filtering: ${totalLanguages} total languages, ${filteredLanguages} filtered out (missing features), ${displayedLanguages} displayed`);
      if (selectedGbFeatures.length > 0) {
        console.log(`GB features required: ${selectedGbFeatures.join(', ')}`);
      }
      if (selectedEaFeatures.length > 0) {
        console.log(`EA features required: ${selectedEaFeatures.join(', ')}`);
      }
    }
    
    console.log(`Built dynamic data with ${resultData.length} language points`);
    return resultData;
    
  } catch (error) {
    console.error('Error building dynamic data:', error);
    return [];
  }
}

// 获取特征描述
export async function getFeatureDescriptions() {
  const [gbParams, eaVars] = await Promise.all([
    loadGrambankParameters(),
    loadEaVariables()
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
      description: variable.description
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
}
