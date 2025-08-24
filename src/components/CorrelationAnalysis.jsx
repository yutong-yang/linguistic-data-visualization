import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { gbFeatures, gbOrangeFeatures } from '../utils/featureData';
import { getFamilyName, loadCombinedFamilyMapping } from '../utils/familyMapping';

const CorrelationAnalysis = () => {
  const {
    languageData,
    selectedGBFeatures,
    selectedEAFeatures,
    gbWeights,
    eaWeights,
    lang,
    langs
  } = useContext(DataContext);

  const [correlationResults, setCorrelationResults] = useState(null);
  const [groupCorrelationResults, setGroupCorrelationResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [correlationMethod, setCorrelationMethod] = useState('pearson');
  
  // 新增：分组分析相关状态
  const [groupByType, setGroupByType] = useState('none'); // 'none', 'family', 'region', 'macroarea'
  const [groupedCorrelationResults, setGroupedCorrelationResults] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [familyMapping, setFamilyMapping] = useState({});

  // 语言配置
  const t = langs[lang];

  // 相关性方法选项
  const correlationMethodOptions = [
    { value: 'pearson', label: t.correlationMethodPearson || 'Pearson Correlation' },
    { value: 'spearman', label: t.correlationMethodSpearman || 'Spearman Rank Correlation' },
    { value: 'kendall', label: t.correlationMethodKendall || "Kendall's Tau" }
  ];

  // 分组类型选项
  const groupTypeOptions = [
    { value: 'none', label: t.groupAnalysisNone || 'No Grouping (Overall Analysis)' },
    { value: 'family', label: t.groupAnalysisByFamily || 'Group by Language Family' },
    { value: 'region', label: t.groupAnalysisByRegion || 'Group by Region' },
    { value: 'macroarea', label: t.groupAnalysisByMacroarea || 'Group by Macro Area' }
  ];

  // 计算皮尔逊相关系数 - 与原始HTML版本保持一致
  const calculatePearsonCorrelation = (x, y) => {
    const n = x.length;
    let sum_x = 0, sum_y = 0, sum_xy = 0;
    let sum_x2 = 0, sum_y2 = 0;
    let valid_pairs = 0;
    const xvals = [], yvals = [];
    
    for (let i = 0; i < n; i++) {
      if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
        sum_x += x[i];
        sum_y += y[i];
        sum_xy += x[i] * y[i];
        sum_x2 += x[i] * x[i];
        sum_y2 += y[i] * y[i];
        xvals.push(x[i]);
        yvals.push(y[i]);
        valid_pairs++;
      }
    }
    
    if (valid_pairs < 2) return { correlation: 0, pValue: 1 };
    
    const numerator = valid_pairs * sum_xy - sum_x * sum_y;
    const denominator = Math.sqrt((valid_pairs * sum_x2 - sum_x * sum_x) * (valid_pairs * sum_y2 - sum_y * sum_y));
    const correlation = denominator === 0 ? 0 : numerator / denominator;
    const pValue = pearsonPValue(correlation, valid_pairs);
    
    return { correlation, pValue };
  };

  // 准确的皮尔逊p值计算（与原始HTML版本一致）
  const pearsonPValue = (r, n) => {
    if (n < 3) return 1.0;
    const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
    
    function betacf(x, a, b) {
      let fpmin = 1e-30, m = 1, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
      if (Math.abs(d) < fpmin) d = fpmin;
      d = 1 / d;
      let h = d;
      for (; m <= 100; m++) {
        let m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < fpmin) d = fpmin;
        c = 1 + aa / c;
        if (Math.abs(c) < fpmin) c = fpmin;
        d = 1 / d;
        h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < fpmin) d = fpmin;
        c = 1 + aa / c;
        if (Math.abs(c) < fpmin) c = fpmin;
        d = 1 / d;
        h *= d * c;
        if (Math.abs(aa) < 1e-10) break;
      }
      return h;
    }
    
    function betai(x, a, b) {
      let bt = (x === 0 || x === 1) ? 0 :
        Math.exp(
          gammaln(a + b) - gammaln(a) - gammaln(b) +
          a * Math.log(x) + b * Math.log(1 - x)
        );
      if (x < 0 || x > 1) return 0;
      if (x < (a + 1) / (a + b + 2))
        return bt * betacf(x, a, b) / a;
      else
        return 1 - bt * betacf(1 - x, b, a) / b;
    }
    
    function gammaln(xx) {
      const cof = [
        76.18009172947146, -86.50532032941677,
        24.01409824083091, -1.231739572450155,
        0.1208650973866179e-2, -0.5395239384953e-5
      ];
      let x = xx - 1, tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) ser += cof[j] / ++x;
      return -tmp + Math.log(2.5066282746310005 * ser);
    }
    
    const df = n - 2;
    const x = df / (df + t * t);
    const p = betai(x, df / 2, 0.5);
    return Math.min(1, 2 * p); // 双尾
  };

  // 计算斯皮尔曼相关系数 - 与原始HTML版本保持一致
  const calculateSpearmanCorrelation = (x, y) => {
    const n = x.length;
    const valid = [];
    for (let i = 0; i < n; i++) {
      if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
        valid.push([x[i], y[i]]);
      }
    }
    if (valid.length < 2) return { correlation: 0, pValue: 1 };
    
    // 排序并赋秩
    function rank(arr) {
      const sorted = arr.slice().sort((a, b) => a - b);
      return arr.map(v => sorted.indexOf(v) + 1);
    }
    const xRank = rank(valid.map(d => d[0]));
    const yRank = rank(valid.map(d => d[1]));
    
    // 用Pearson算秩相关
    const { correlation } = calculatePearsonCorrelation(xRank, yRank);
    
    // 近似p值
    const z = correlation * Math.sqrt(valid.length - 1);
    const pValue = normalPValue(z);
    
    return { correlation, pValue };
  };

  // 计算肯德尔相关系数 - 与原始HTML版本保持一致
  const calculateKendallCorrelation = (x, y) => {
    const n = x.length;
    const valid = [];
    for (let i = 0; i < n; i++) {
      if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
        valid.push([x[i], y[i]]);
      }
    }
    const N = valid.length;
    if (N < 2) return { correlation: 0, pValue: 1 };
    
    // 计算 concordant/discordant 对
    let concordant = 0, discordant = 0;
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = valid[i][0] - valid[j][0];
        const dy = valid[i][1] - valid[j][1];
        const prod = dx * dy;
        if (prod > 0) concordant++;
        else if (prod < 0) discordant++;
      }
    }
    
    const tau = (concordant - discordant) / (0.5 * N * (N - 1));
    
    // 近似p值
    const z = tau * Math.sqrt(9 * N * (N - 1) / (2 * (2 * N + 5)));
    const pValue = normalPValue(z);
    
    return { correlation: tau, pValue };
  };

  // 正态分布p值计算
  const normalPValue = (z) => {
    return 2 * (1 - normalCdf(Math.abs(z)));
  };

  const normalCdf = (z) => {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
  };

  const erf = (x) => {
    // 误差函数近似 - Abramowitz and Stegun formula 7.1.26
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  };

  // 相关性方法 - 确保返回值格式一致
  const correlationMethods = {
    pearson: {
      name: 'Pearson',
      function: (x, y) => {
        const result = calculatePearsonCorrelation(x, y);
        return { r: result.correlation, p: result.pValue };
      }
    },
    spearman: {
      name: 'Spearman',
      function: (x, y) => {
        const result = calculateSpearmanCorrelation(x, y);
        return { r: result.correlation, p: result.pValue };
      }
    },
    kendall: {
      name: 'Kendall',
      function: (x, y) => {
        const result = calculateKendallCorrelation(x, y);
        return { r: result.correlation, p: result.pValue };
      }
    }
  };

  // 解析GB值 - 与原始HTML版本保持一致
  const parseGBValue = (value) => {
    if (value === '0' || value === 0) return 0;
    if (value === '1' || value === 1) return 1;
    return null;
  };



  // 计算组间相关性 - 修复加权计算问题
  const calculateGroupCorrelations = (data, selectedFeatures, method) => {
    const methodFunc = correlationMethods[method].function;
    const correlations = {};
    
    // 四组特征定义
    const groupDefs = {
      ea_social: {
        name: 'EA Social Features',
        features: selectedFeatures.filter(f => f.startsWith('EA') && !f.includes('Richness'))
      },
      ea_ecological: {
        name: 'EA Ecological Features',
        features: selectedFeatures.filter(f => f.includes('Richness'))
      },
      gb_gender: {
        name: 'GB Gender Features',
        features: selectedFeatures.filter(f => gbFeatures.includes(f))
      },
      gb_classifier: {
        name: 'GB Classifier Features',
        features: selectedFeatures.filter(f => gbOrangeFeatures.includes(f))
      }
    };

    console.log('Group definitions:', groupDefs);
    console.log('Selected features:', selectedFeatures);

    // 计算每组的加权平均 - 修复权重获取和组内权重归一化
    const groupValues = {};
    Object.entries(groupDefs).forEach(([key, group]) => {
      if (group.features.length > 0) {
        console.log(`Processing group ${key}:`, group.features);
        groupValues[key] = data.map(lang => {
          let totalValue = 0;
          let totalWeight = 0;
          
          group.features.forEach(feature => {
            // 修复权重获取方式 - 直接从权重对象获取
            let weight = 1;
            if (feature.startsWith('GB')) {
              const weightStr = gbWeights[feature];
              weight = weightStr === '' || weightStr === null || weightStr === undefined ? 1 : parseFloat(weightStr) || 1;
            } else {
              const weightStr = eaWeights[feature];
              weight = weightStr === '' || weightStr === null || weightStr === undefined ? 1 : parseFloat(weightStr) || 1;
            }
            
            let value = lang[feature];
            
            // 修复GB值解析
            if (feature.startsWith('GB')) {
              value = parseGBValue(value);
            }
            
            if (value !== null && !isNaN(value)) {
              totalValue += value * weight;
              totalWeight += weight;
            }
          });
          
          // 组内权重归一化 - 这是关键修复
          return totalWeight > 0 ? totalValue / totalWeight : null;
        });
        
        // 过滤掉null值并显示统计信息
        const validValues = groupValues[key].filter(v => v !== null);
        console.log(`Group ${key} valid values:`, validValues.length, 'out of', groupValues[key].length);
        if (validValues.length > 0) {
          console.log(`Group ${key} sample values:`, validValues.slice(0, 5));
          console.log(`Group ${key} value range:`, Math.min(...validValues), 'to', Math.max(...validValues));
        }
      }
    });

    console.log('Group values:', groupValues);

    // 计算组间相关性
    const groupKeys = Object.keys(groupValues);
    if (groupKeys.length < 2) return {};
    
    groupKeys.forEach(group1 => {
      correlations[group1] = {};
      groupKeys.forEach(group2 => {
        if (group1 === group2) {
          correlations[group1][group2] = {r: 1.0, p: 0};
        } else {
          // 确保两个数组有相同的索引
          const validIndices = [];
          for (let i = 0; i < groupValues[group1].length; i++) {
            if (groupValues[group1][i] !== null && groupValues[group2][i] !== null) {
              validIndices.push(i);
            }
          }
          
          const filteredValues1 = validIndices.map(i => groupValues[group1][i]);
          const filteredValues2 = validIndices.map(i => groupValues[group2][i]);
          
          console.log(`Correlation ${group1} vs ${group2}:`, {
            values1Length: filteredValues1.length,
            values2Length: filteredValues2.length,
            sampleValues1: filteredValues1.slice(0, 3),
            sampleValues2: filteredValues2.slice(0, 3)
          });
          
          if (filteredValues1.length > 0 && filteredValues2.length > 0) {
            const result = methodFunc(filteredValues1, filteredValues2);
            console.log(`Correlation result for ${group1} vs ${group2}:`, {
              r: result.r,
              p: result.p,
              significance: getSignificance(result.p)
            });
            correlations[group1][group2] = result;
          } else {
            correlations[group1][group2] = {r: 0, p: 1};
          }
        }
      });
    });
    
    correlations._groupNames = groupDefs;
    return correlations;
  };

  // 计算相关性矩阵
  const calculateCorrelations = () => {
    setIsCalculating(true);
    
    // 合并所有选中的特征
    const allFeatures = [...selectedGBFeatures, ...selectedEAFeatures];
    
    if (allFeatures.length < 2) {
      setCorrelationResults(null);
      setGroupCorrelationResults(null);
      setGroupedCorrelationResults(null);
      setIsCalculating(false);
      return;
    }

    // 过滤有效数据 - 修复GB特征的处理
    const validData = languageData.filter(lang => {
      return allFeatures.every(feature => {
        const value = lang[feature];
        if (feature.startsWith('GB')) {
          // GB特征：只有0、1、null三种值
          return value === '0' || value === 0 || value === '1' || value === 1;
        } else {
          // EA特征：需要是有效数值
          return value !== null && value !== undefined && value !== '' && !isNaN(value);
        }
      });
    });

    if (validData.length < 10) {
      setCorrelationResults(null);
      setGroupCorrelationResults(null);
      setGroupedCorrelationResults(null);
      setIsCalculating(false);
      return;
    }

    // 计算特征间相关性矩阵
    const correlations = {};
    const pValues = {};

    allFeatures.forEach(feature1 => {
      correlations[feature1] = {};
      pValues[feature1] = {};
      
      allFeatures.forEach(feature2 => {
        if (feature1 === feature2) {
          correlations[feature1][feature2] = 1;
          pValues[feature1][feature2] = 0;
        } else {
          // 修复特征值获取 - 正确处理GB特征
          const values1 = validData.map(d => {
            let value = d[feature1];
            if (feature1.startsWith('GB')) {
              value = parseGBValue(value);
            } else {
              value = parseFloat(value);
            }
            return value;
          });
          const values2 = validData.map(d => {
            let value = d[feature2];
            if (feature2.startsWith('GB')) {
              value = parseGBValue(value);
            } else {
              value = parseFloat(value);
            }
            return value;
          });
          
          // 使用与组间相关性计算相同的方法
          const result = correlationMethods[correlationMethod].function(values1, values2);
          
          // 添加调试信息
          if (feature1 === 'GB030' && feature2 === 'EA044') {
            console.log('Feature correlation debug:', {
              feature1,
              feature2,
              result,
              values1Sample: values1.slice(0, 5),
              values2Sample: values2.slice(0, 5)
            });
          }
          
          correlations[feature1][feature2] = result.r;
          pValues[feature1][feature2] = result.p;
        }
      });
    });

    // 计算组间相关性
    const groupCorrelations = calculateGroupCorrelations(validData, allFeatures, correlationMethod);

    // 新增：计算分组相关性（如果启用了分组）
    let groupedResults = null;
    if (groupByType !== 'none' && selectedGroups.length > 0) {
      groupedResults = calculateGroupedCorrelations(validData, allFeatures, correlationMethod, groupByType, selectedGroups);
    }

    setCorrelationResults({
      correlations,
      pValues,
      features: allFeatures,
      sampleSize: validData.length,
      method: correlationMethod
    });
    
    setGroupCorrelationResults({
      correlations: groupCorrelations,
      sampleSize: validData.length,
      method: correlationMethod
    });
    
    setGroupedCorrelationResults(groupedResults);
    
    setIsCalculating(false);
  };

  // 获取显著性标记
  const getSignificance = (pValue) => {
    if (pValue === null || pValue === undefined || typeof pValue !== 'number') return '';
    if (pValue < 0.001) return '***';
    if (pValue < 0.01) return '**';
    if (pValue < 0.05) return '*';
    return '';
  };

  // 新增：当语言数据或分组类型变化时，更新可用分组选项
  React.useEffect(() => {
    if (languageData && languageData.length > 0) {
      const groups = getAvailableGroups();
      setAvailableGroups(groups);
      
      // 如果当前选中的分组不在可用分组中，清空选择
      if (groupByType !== 'none') {
        const validSelectedGroups = selectedGroups.filter(group => groups.includes(group));
        if (validSelectedGroups.length !== selectedGroups.length) {
          setSelectedGroups(validSelectedGroups);
        }
      }
    }
  }, [languageData, groupByType]);

  // 新增：组件挂载时初始化分组选项
  React.useEffect(() => {
    if (languageData && languageData.length > 0) {
      const groups = getAvailableGroups();
      setAvailableGroups(groups);
    }
  }, []);

  // 新增：加载语系映射
  React.useEffect(() => {
    const loadFamilyMapping = async () => {
      try {
        const mapping = await loadCombinedFamilyMapping();
        setFamilyMapping(mapping);
      } catch (error) {
        console.error('加载语系映射失败:', error);
      }
    };
    
    loadFamilyMapping();
  }, []);

  // 新增：获取可用的分组选项
  const getAvailableGroups = () => {
    if (!languageData || languageData.length === 0) return [];
    
    const groups = new Set();
    languageData.forEach(lang => {
      if (groupByType === 'family' && lang.Family_level_ID) {
        groups.add(lang.Family_level_ID);
      } else if (groupByType === 'region' && lang.region) {
        groups.add(lang.region);
      } else if (groupByType === 'macroarea' && lang.Macroarea) {
        groups.add(lang.Macroarea);
      }
    });
    
    return Array.from(groups).sort();
  };

  // 新增：获取分组的显示名称（将ID转换为友好名称）
  const getGroupDisplayName = (groupId) => {
    if (groupByType === 'family') {
      // 对于语系，使用语系名称而不是ID
      return getFamilyName(groupId, familyMapping) || groupId;
    } else {
      // 对于地区和大区域，直接使用名称
      return groupId;
    }
  };

  // 新增：按分组计算相关性
  const calculateGroupedCorrelations = (data, selectedFeatures, method, groupType, selectedGroups) => {
    if (groupType === 'none' || selectedGroups.length === 0) return null;
    
    const results = {};
    
    selectedGroups.forEach(groupName => {
      // 过滤该分组的数据
      let groupData;
      if (groupType === 'family') {
        groupData = data.filter(lang => lang.Family_level_ID === groupName);
      } else if (groupType === 'region') {
        groupData = data.filter(lang => lang.region === groupName);
      } else if (groupType === 'macroarea') {
        groupData = data.filter(lang => lang.Macroarea === groupName);
      }
      
      if (groupData.length < 5) {
        // 样本太少，跳过
        results[groupName] = { error: t.sampleSizeTooSmall || 'Sample size too small', sampleSize: groupData.length };
        return;
      }
      
      // 计算该分组内的特征相关性
      const correlations = {};
      const pValues = {};
      
      selectedFeatures.forEach(feature1 => {
        correlations[feature1] = {};
        pValues[feature1] = {};
        
        selectedFeatures.forEach(feature2 => {
          if (feature1 === feature2) {
            correlations[feature1][feature2] = 1;
            pValues[feature1][feature2] = 0;
          } else {
            const values1 = groupData.map(d => {
              let value = d[feature1];
              if (feature1.startsWith('GB')) {
                value = parseGBValue(value);
              } else {
                value = parseFloat(value);
              }
              return value;
            });
            
            const values2 = groupData.map(d => {
              let value = d[feature2];
              if (feature2.startsWith('GB')) {
                value = parseGBValue(value);
              } else {
                value = parseFloat(value);
              }
              return value;
            });
            
            const result = correlationMethods[method].function(values1, values2);
            correlations[feature1][feature2] = result.r;
            pValues[feature1][feature2] = result.p;
          }
        });
      });
      
      results[groupName] = {
        correlations,
        pValues,
        sampleSize: groupData.length,
        features: selectedFeatures
      };
    });
    
    return results;
  };

  // 新增：计算分组间的相关性差异
  const calculateGroupDifferences = (groupedResults, selectedFeatures) => {
    if (!groupedResults || Object.keys(groupedResults).length < 2) return null;
    
    const groupNames = Object.keys(groupedResults).filter(name => 
      !groupedResults[name].error
    );
    
    if (groupNames.length < 2) return null;
    
    const differences = {};
    
    selectedFeatures.forEach(feature1 => {
      differences[feature1] = {};
      selectedFeatures.forEach(feature2 => {
        if (feature1 === feature2) {
          differences[feature1][feature2] = { maxDiff: 0, groups: [] };
          return;
        }
        
        const correlations = groupNames.map(groupName => ({
          group: groupName,
          correlation: groupedResults[groupName].correlations[feature1][feature2],
          pValue: groupedResults[groupName].pValues[feature1][feature2]
        }));
        
        // 计算最大差异
        const validCorrelations = correlations.filter(c => 
          typeof c.correlation === 'number' && !isNaN(c.correlation)
        );
        
        if (validCorrelations.length >= 2) {
          const maxCorr = Math.max(...validCorrelations.map(c => c.correlation));
          const minCorr = Math.min(...validCorrelations.map(c => c.correlation));
          const maxDiff = maxCorr - minCorr;
          
          // 找出差异最大的组对
          let maxDiffGroups = [];
          for (let i = 0; i < validCorrelations.length; i++) {
            for (let j = i + 1; j < validCorrelations.length; j++) {
              const diff = Math.abs(validCorrelations[i].correlation - validCorrelations[j].correlation);
              if (diff === maxDiff) {
                maxDiffGroups = [
                  { name: validCorrelations[i].group, correlation: validCorrelations[i].correlation },
                  { name: validCorrelations[j].group, correlation: validCorrelations[j].correlation }
                ];
              }
            }
          }
          
          differences[feature1][feature2] = {
            maxDiff,
            groups: maxDiffGroups,
            allCorrelations: correlations
          };
        } else {
          differences[feature1][feature2] = { maxDiff: 0, groups: [] };
        }
      });
    });
    
    return differences;
  };

  // 获取背景颜色 - 改进颜色区分
  const getBackgroundColor = (correlation) => {
    // 处理undefined、null或非数字值
    if (correlation === undefined || correlation === null || typeof correlation !== 'number') {
      return '#f5f5f5'; // 默认背景色
    }
    
    const absCorr = Math.abs(correlation);
    if (correlation > 0) {
      // 正相关 - 红色系
      if (absCorr > 0.7) return '#ffcccc'; // 强正相关 - 深红色
      if (absCorr > 0.5) return '#ffdddd'; // 中等正相关 - 红色
      if (absCorr > 0.3) return '#ffeeee'; // 弱正相关 - 浅红色
      return '#fff5f5'; // 很弱正相关 - 极浅红色
    } else {
      // 负相关 - 绿色系
      if (absCorr > 0.7) return '#ccffcc'; // 强负相关 - 深绿色
      if (absCorr > 0.5) return '#ddffdd'; // 中等负相关 - 绿色
      if (absCorr > 0.3) return '#eeffee'; // 弱负相关 - 浅绿色
      return '#f5fff5'; // 很弱负相关 - 极浅绿色
    }
  };

  // 获取文字颜色
  const getTextColor = (correlation) => {
    // 处理undefined、null或非数字值
    if (correlation === undefined || correlation === null || typeof correlation !== 'number') {
      return '#999'; // 默认文字颜色
    }
    
    const absCorr = Math.abs(correlation);
    if (absCorr > 0.5) return '#000'; // 强相关 - 黑色
    if (absCorr > 0.3) return '#333'; // 中等相关 - 深灰色
    return '#666'; // 弱相关 - 灰色
  };

  return (
    <div className="chart-container analysis-section">
      <div className="chart-title">{langs[lang].correlationAnalysis}</div>
      
      <div className="correlation-controls">
        <select 
          value={correlationMethod}
          onChange={(e) => setCorrelationMethod(e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}
        >
          {correlationMethodOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {/* 新增：分组分析控制 */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>
            {t.groupAnalysisType}:
          </label>
          <select 
            value={groupByType}
            onChange={(e) => {
              setGroupByType(e.target.value);
              setSelectedGroups([]);
              setGroupedCorrelationResults(null);
            }}
            style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}
          >
            {groupTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* 分组选择器 */}
        {groupByType !== 'none' && (
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>
              {t.selectGroupsToAnalyze?.replace('{type}', 
                groupByType === 'family' ? t.languageFamily : 
                groupByType === 'region' ? t.region : 
                t.macroarea
              ) || `Select ${groupByType === 'family' ? 'language families' : groupByType === 'region' ? 'regions' : 'macro areas'} to analyze:`}
            </label>
            
            {/* 全选/全不选按钮 */}
            <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  const groups = getAvailableGroups();
                  setSelectedGroups(groups);
                }}
                style={{
                  padding: '4px 8px',
                  background: '#2c7c6c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
                title={t.selectAll}
              >
                {t.selectAll}
              </button>
              <button
                onClick={() => setSelectedGroups([])}
                style={{
                  padding: '4px 8px',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
                title={t.deselectAll}
              >
                {t.deselectAll}
              </button>
              <span style={{ fontSize: '10px', color: '#666', lineHeight: '24px' }}>
                {t.selectedCount?.replace('{count}', selectedGroups.length) || `Selected: ${selectedGroups.length}`}
              </span>
            </div>
            
            <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #ddd', padding: '4px', borderRadius: '4px', background: '#f9f9f9' }}>
              {(() => {
                const groups = getAvailableGroups();
                return groups.map(group => (
                  <label key={group} style={{ display: 'block', fontSize: '11px', marginBottom: '2px' }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroups([...selectedGroups, group]);
                        } else {
                          setSelectedGroups(selectedGroups.filter(g => g !== group));
                        }
                      }}
                      style={{ marginRight: '4px' }}
                    />
                    {getGroupDisplayName(group)}
                  </label>
                ));
              })()}
            </div>
          </div>
        )}
        
        <button
          onClick={calculateCorrelations}
          disabled={isCalculating || selectedGBFeatures.length + selectedEAFeatures.length < 2}
          style={{
            width: '100%',
            padding: '8px',
            background: isCalculating ? '#ccc' : '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isCalculating ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {isCalculating ? (t.calculating || 'Calculating...') : (t.calculateCorrelations || 'Calculate Correlations')}
        </button>
      </div>

      {/* 组间相关性结果 */}
      {groupCorrelationResults && (
        <div id="group-correlation-results" className="correlation-results" style={{ display: 'block', marginTop: '15px' }}>
          <h4>{t.groupCorrelationTitle?.replace('{method}', groupCorrelationResults.method.toUpperCase()) || `${t.groupCorrelationTitleFallback || 'Group Correlations'} (${groupCorrelationResults.method.toUpperCase()})`}</h4>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
            {t.groupCorrelationSampleSize?.replace('{size}', groupCorrelationResults.sampleSize)}
          </p>
          <div id="group-correlation-matrix" className="correlation-matrix">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ background: '#f0f0f0', padding: '6px', border: '1px solid #ddd' }}></th>
                  {Object.entries(groupCorrelationResults.correlations._groupNames || {}).map(([key, group]) => (
                    <th 
                      key={key}
                      className="correlation-header"
                      style={{ 
                        background: '#f0f0f0', 
                        textAlign: 'center', 
                        padding: '6px',
                        border: '1px solid #ddd',
                        fontSize: '10px'
                      }}
                    >
                      {group.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupCorrelationResults.correlations._groupNames || {}).map(([group1Key, group1]) => (
                  <tr key={group1Key}>
                    <th 
                      className="correlation-header"
                      style={{ 
                        background: '#f0f0f0', 
                        textAlign: 'left', 
                        padding: '6px',
                        border: '1px solid #ddd',
                        fontSize: '10px'
                      }}
                    >
                      {group1.name}
                    </th>
                    {Object.entries(groupCorrelationResults.correlations._groupNames || {}).map(([group2Key, group2]) => {
                      const correlation = groupCorrelationResults.correlations[group1Key]?.[group2Key]?.r || 0;
                      const pValue = groupCorrelationResults.correlations[group1Key]?.[group2Key]?.p || 1;
                      const significance = getSignificance(pValue);
                      const bgColor = getBackgroundColor(correlation);
                      const textColor = getTextColor(correlation);
                      const isSignificant = typeof pValue === 'number' && pValue < 0.05;
                      
                      return (
                        <td 
                          key={group2Key}
                          className="correlation-cell"
                          style={{
                            textAlign: 'center',
                            padding: '4px',
                            background: bgColor,
                            fontWeight: isSignificant ? 'bold' : 'normal',
                            border: '1px solid #ddd',
                            fontSize: '10px',
                            borderRadius: '2px',
                            margin: '1px',
                            color: textColor,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => {
                            if (window.explainCorrelation && typeof correlation === 'number') {
                              window.explainCorrelation(
                                group1.name, 
                                group2.name, 
                                correlation, 
                                pValue, 
                                groupCorrelationResults.method
                              );
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                          }}
                          title={t.clickToGetAIExplanation || 'Click to get AI explanation of this correlation'}
                        >
                          {typeof correlation === 'number' ? correlation.toFixed(3) : '0.000'}
                          {significance && (
                            <span style={{ 
                              fontSize: '9px', 
                              color: isSignificant ? '#d63384' : '#888',
                              fontWeight: 'bold'
                            }}>
                              {significance}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新增：分组相关性结果 */}
      {groupedCorrelationResults && (
        <div id="grouped-correlation-results" className="correlation-results" style={{ display: 'block', marginTop: '15px' }}>
          <h4>{t.groupedCorrelationTitle} ({correlationMethod.toUpperCase()}) - {t.groupedCorrelationByType?.replace('{type}', 
            groupByType === 'family' ? t.languageFamily : 
            groupByType === 'region' ? t.region : 
            t.macroarea
          )}</h4>
          
          {/* 分组结果概览 */}
          <div style={{ marginBottom: '15px' }}>
            <h5 style={{ fontSize: '14px', marginBottom: '8px' }}>{t.groupOverviewTitle}</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(groupedCorrelationResults).map(([groupName, result]) => (
                <div key={groupName} style={{ 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  background: result.error ? '#fff3cd' : '#f8f9fa'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>
                    {getGroupDisplayName(groupName)}
                  </div>
                  {result.error ? (
                    <div style={{ fontSize: '11px', color: '#856404' }}>
                      {result.error} ({t.sampleSize}: {result.sampleSize})
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {t.sampleSize}: {result.sampleSize} {t.languages}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 分组相关性矩阵 */}
          {Object.entries(groupedCorrelationResults).map(([groupName, result]) => {
            if (result.error) return null;
            
            return (
              <div key={groupName} style={{ marginBottom: '20px' }}>
                <h5 style={{ fontSize: '13px', marginBottom: '8px', color: '#2c7c6c' }}>
                  {getGroupDisplayName(groupName)} - {t.correlationMatrixTitle} ({t.sampleSize}: {result.sampleSize})
                </h5>
                <div className="correlation-matrix" style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: '300px' }}>
                    <thead>
                      <tr>
                        <th style={{ background: '#f0f0f0', padding: '4px', border: '1px solid #ddd', fontSize: '9px' }}></th>
                        {result.features.map(feature => (
                          <th 
                            key={feature}
                            style={{ 
                              background: '#f0f0f0', 
                              textAlign: 'center', 
                              padding: '4px',
                              border: '1px solid #ddd',
                              fontSize: '9px'
                            }}
                          >
                            {feature}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.features.map(feature1 => (
                        <tr key={feature1}>
                          <th 
                            style={{ 
                              background: '#f0f0f0', 
                              textAlign: 'left', 
                              padding: '4px',
                              border: '1px solid #ddd',
                              fontSize: '9px'
                            }}
                          >
                            {feature1}
                          </th>
                          {result.features.map(feature2 => {
                            const correlation = result.correlations[feature1]?.[feature2] || 0;
                            const pValue = result.pValues[feature1]?.[feature2] || 1;
                            const significance = getSignificance(pValue);
                            const bgColor = getBackgroundColor(correlation);
                            const textColor = getTextColor(correlation);
                            const isSignificant = typeof pValue === 'number' && pValue < 0.05;
                            
                            return (
                              <td 
                                key={feature2}
                                style={{
                                  textAlign: 'center',
                                  padding: '2px',
                                  background: bgColor,
                                  fontWeight: isSignificant ? 'bold' : 'normal',
                                  border: '1px solid #ddd',
                                  fontSize: '8px',
                                  borderRadius: '2px',
                                  color: textColor
                                }}
                                title={`${feature1} ${t.vs} ${feature2}: ${correlation.toFixed(3)} (${t.pValue}: ${pValue.toFixed(4)})`}
                              >
                                {typeof correlation === 'number' ? correlation.toFixed(3) : '0.000'}
                                {significance && (
                                  <span style={{ 
                                    fontSize: '7px', 
                                    color: isSignificant ? '#d63384' : '#888',
                                    fontWeight: 'bold'
                                  }}>
                                    {significance}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增：分组间差异分析 */}
      {groupedCorrelationResults && Object.keys(groupedCorrelationResults).length >= 2 && (
        <div id="group-differences" className="correlation-results" style={{ display: 'block', marginTop: '15px' }}>
          <h4>{t.groupDifferencesTitle}</h4>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
            {t.compareCorrelationPatterns?.replace('{type}', 
              groupByType === 'family' ? t.languageFamily : 
              groupByType === 'region' ? t.region : 
              t.macroarea
            )}
          </p>
          
          {(() => {
            const differences = calculateGroupDifferences(groupedCorrelationResults, selectedGBFeatures.concat(selectedEAFeatures));
            if (!differences) return <div style={{ color: '#666', fontSize: '11px' }}>{t.cannotCalculateDifferences || '无法计算差异（需要至少2个有效分组）'}</div>;
            
            // 找出差异最大的特征对
            const maxDifferences = [];
            Object.entries(differences).forEach(([feature1, feature2Diffs]) => {
              Object.entries(feature2Diffs).forEach(([feature2, diff]) => {
                if (feature1 !== feature2 && diff.maxDiff > 0) {
                  maxDifferences.push({
                    feature1,
                    feature2,
                    maxDiff: diff.maxDiff,
                    groups: diff.groups
                  });
                }
              });
            });
            
            // 按差异大小排序
            maxDifferences.sort((a, b) => b.maxDiff - a.maxDiff);
            
            return (
              <div>
                <h5 style={{ fontSize: '13px', marginBottom: '8px', color: '#dc3545' }}>
                  {t.maxDifferencesTitle} (10)
                </h5>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>{t.featurePair}</th>
                        <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{t.maxDifference}</th>
                        <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'left' }}>{t.groupsWithMaxDiff}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maxDifferences.slice(0, 10).map((diff, index) => (
                        <tr key={index} style={{ background: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                          <td style={{ padding: '6px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            {diff.feature1} {t.vs} {diff.feature2}
                          </td>
                          <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', color: '#dc3545', fontWeight: 'bold' }}>
                            {diff.maxDiff.toFixed(3)}
                          </td>
                          <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                            {diff.groups.map((group, i) => (
                              <span key={i}>
                                {getGroupDisplayName(group.name)}: {group.correlation.toFixed(3)}
                                {i < diff.groups.length - 1 ? ' vs ' : ''}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 特征间相关性结果 */}
      {correlationResults && (
        <div id="correlation-results" className="correlation-results" style={{ display: 'block', marginTop: '15px' }}>
          <h4>{t.featureCorrelationTitle} ({correlationResults.method.toUpperCase()})</h4>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
            {t.featureCorrelationSampleSize?.replace('{size}', correlationResults.sampleSize)}
          </p>
          <div id="correlation-matrix" className="correlation-matrix">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ background: '#f0f0f0', padding: '6px', border: '1px solid #ddd' }}></th>
                  {correlationResults.features.map(feature => (
                    <th 
                      key={feature}
                      className="correlation-header"
                      style={{ 
                        background: '#f0f0f0', 
                        textAlign: 'center', 
                        padding: '6px',
                        border: '1px solid #ddd',
                        fontSize: '10px'
                      }}
                    >
                      {feature}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlationResults.features.map(feature1 => (
                  <tr key={feature1}>
                    <th 
                      className="correlation-header"
                      style={{ 
                        background: '#f0f0f0', 
                        textAlign: 'left', 
                        padding: '6px',
                        border: '1px solid #ddd',
                        fontSize: '10px'
                      }}
                    >
                      {feature1}
                    </th>
                    {correlationResults.features.map(feature2 => {
                      const correlation = correlationResults.correlations[feature1]?.[feature2] || 0;
                      const pValue = correlationResults.pValues[feature1]?.[feature2] || 1;
                      const significance = getSignificance(pValue);
                      const bgColor = getBackgroundColor(correlation);
                      const textColor = getTextColor(correlation);
                      const isSignificant = typeof pValue === 'number' && pValue < 0.05;
                      
                      return (
                        <td 
                          key={feature2}
                          className="correlation-cell"
                          style={{
                            textAlign: 'center',
                            padding: '4px',
                            background: bgColor,
                            fontWeight: isSignificant ? 'bold' : 'normal',
                            border: '1px solid #ddd',
                            fontSize: '10px',
                            borderRadius: '2px',
                            margin: '1px',
                            color: textColor,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => {
                            if (window.explainCorrelation && typeof correlation === 'number') {
                              window.explainCorrelation(
                                feature1, 
                                feature2, 
                                correlation, 
                                pValue, 
                                correlationResults.method
                              );
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                          }}
                          title={t.clickToGetAIExplanation || 'Click to get AI explanation of this correlation'}
                        >
                          {typeof correlation === 'number' ? correlation.toFixed(3) : '0.000'}
                          {significance && (
                            <span style={{ 
                              fontSize: '9px', 
                              color: isSignificant ? '#d63384' : '#888',
                              fontWeight: 'bold'
                            }}>
                              {significance}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrelationAnalysis; 