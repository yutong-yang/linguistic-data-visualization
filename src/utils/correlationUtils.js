// 相关性计算方法
export const correlationMethods = {
  pearson: {
    name: "Pearson Correlation",
    function: calculatePearson
  },
  spearman: {
    name: "Spearman Rank Correlation", 
    function: calculateSpearman
  },
  kendall: {
    name: "Kendall's Tau",
    function: calculateKendall
  }
};

// 正态分布 p 值计算（近似）
function normalPValue(z) {
  const absZ = Math.abs(z);
  if (absZ > 6) return 0;
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp(-0.5 * absZ * absZ);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 2 * (1 - p) : 2 * p;
}

// Pearson 相关系数 p 值计算
function pearsonPValue(r, n) {
  if (n < 3) return 1;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const absT = Math.abs(t);
  if (absT > 6) return 0;
  const x = absT / Math.sqrt(n - 2 + absT * absT);
  const p = normalPValue(x * Math.sqrt(n - 2));
  return p;
}

// Pearson 相关系数计算
export function calculatePearson(x, y) {
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
  
  if (valid_pairs < 2) return {r: 0, p: 1};
  
  const numerator = valid_pairs * sum_xy - sum_x * sum_y;
  const denominator = Math.sqrt((valid_pairs * sum_x2 - sum_x * sum_x) * (valid_pairs * sum_y2 - sum_y * sum_y));
  const r = denominator === 0 ? 0 : numerator / denominator;
  const p = pearsonPValue(r, valid_pairs);
  
  return {r, p};
}

// Spearman 相关系数计算
export function calculateSpearman(x, y) {
  const n = x.length;
  const valid = [];
  
  for (let i = 0; i < n; i++) {
    if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
      valid.push([x[i], y[i]]);
    }
  }
  
  if (valid.length < 2) return {r: 0, p: 1};
  
  // 排序并赋秩
  function rank(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    return arr.map(v => sorted.indexOf(v) + 1);
  }
  
  const xRank = rank(valid.map(d => d[0]));
  const yRank = rank(valid.map(d => d[1]));
  
  // 用 Pearson 算秩相关
  const {r} = calculatePearson(xRank, yRank);
  
  // 近似 p 值
  const z = r * Math.sqrt(valid.length - 1);
  const p = normalPValue(z);
  
  return {r, p};
}

// Kendall 相关系数计算
export function calculateKendall(x, y) {
  const n = x.length;
  const valid = [];
  
  for (let i = 0; i < n; i++) {
    if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
      valid.push([x[i], y[i]]);
    }
  }
  
  const N = valid.length;
  if (N < 2) return {r: 0, p: 1};
  
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
  
  // 近似 p 值
  const z = tau * Math.sqrt(9 * N * (N - 1) / (2 * (2 * N + 5)));
  const p = normalPValue(z);
  
  return {r: tau, p};
}

// 解析 GB 特征值
export function parseGBValue(value) {
  if (value === null || value === undefined || value === 'NA' || value === '') {
    return null;
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) {
    // 处理字符串值
    if (value === '1' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'present') {
      return 1;
    } else if (value === '0' || value.toLowerCase() === 'no' || value.toLowerCase() === 'absent') {
      return 0;
    }
    return null;
  }
  
  return num;
}

// 计算特征组之间的相关性
export function calculateGroupCorrelations(data, selectedFeatures, method, weights) {
  const correlations = {};
  const methodFunc = correlationMethods[method].function;
  
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
      features: selectedFeatures.filter(f => f.startsWith('GB') && ['GB030', 'GB051', 'GB052', 'GB053', 'GB054', 'GB170', 'GB171', 'GB172', 'GB177', 'GB192', 'GB198', 'GB314', 'GB315', 'GB321'].includes(f))
    },
    gb_classifier: {
      name: 'GB Classifier Features',
      features: selectedFeatures.filter(f => ['GB038', 'GB057', 'GB058'].includes(f))
    }
  };
  
  // 计算每组的加权平均（组内权重归一化）
  const groupValues = {};
  Object.entries(groupDefs).forEach(([key, group]) => {
    if (group.features.length > 0) {
      groupValues[key] = data.map(lang => {
        let totalValue = 0;
        let totalWeight = 0;
        
        group.features.forEach(feature => {
          const weight = weights[feature] || 1;
          let value = lang[feature];
          
          if (feature.startsWith('GB')) {
            value = parseGBValue(value);
          }
          
          if (value !== null && !isNaN(value)) {
            totalValue += value * weight;
            totalWeight += weight;
          }
        });
        
        // 组内权重归一化
        return totalWeight > 0 ? totalValue / totalWeight : null;
      });
    }
  });
  
  // 计算组间相关性
  const groupKeys = Object.keys(groupValues);
  if (groupKeys.length < 2) return {};
  
  groupKeys.forEach(group1 => {
    correlations[group1] = {};
    groupKeys.forEach(group2 => {
      if (group1 === group2) {
        correlations[group1][group2] = {r: 1.0, p: 0};
      } else {
        correlations[group1][group2] = methodFunc(groupValues[group1], groupValues[group2]);
      }
    });
  });
  
  correlations._groupNames = groupDefs;
  return correlations;
}

// 计算所有选中特征的两两相关性大矩阵
export function calculateFeatureCorrelations(data, features, method) {
  const methodFunc = correlationMethods[method].function;
  const result = {};
  
  features.forEach(f1 => {
    result[f1] = {};
    features.forEach(f2 => {
      if (f1 === f2) {
        result[f1][f2] = {r: 1.0, p: 0};
      } else {
        // 只用原始特征值，不考虑权重，GB特征需转为数值
        const x = data.map(d => {
          let v = d[f1];
          if (f1.startsWith('GB')) v = parseGBValue(v);
          return (v !== null && !isNaN(v)) ? v : null;
        });
        
        const y = data.map(d => {
          let v = d[f2];
          if (f2.startsWith('GB')) v = parseGBValue(v);
          return (v !== null && !isNaN(v)) ? v : null;
        });
        
        result[f1][f2] = methodFunc(x, y);
      }
    });
  });
  
  return result;
} 