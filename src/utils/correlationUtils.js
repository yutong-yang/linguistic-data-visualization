// 相关性分析工具函数

// 获取特征相关性
export async function getFeatureCorrelations() {
  try {
    // 这里应该实现真正的相关性分析
    // 目前返回模拟数据，后续可以集成真实的统计计算
    return [
      {
        feature1: 'GB030',
        feature2: 'GB051',
        correlation: 0.75,
        pValue: 0.001,
        significance: 'high'
      },
      {
        feature1: 'GB079',
        feature2: 'GB080',
        correlation: 0.68,
        pValue: 0.005,
        significance: 'high'
      },
      {
        feature1: 'GB083',
        feature2: 'GB084',
        correlation: 0.72,
        pValue: 0.002,
        significance: 'high'
      }
    ];
  } catch (error) {
    console.error('获取特征相关性失败:', error);
    return [];
  }
}

// 获取社会文化相关性
export async function getSocioCulturalCorrelations() {
  try {
    // 这里应该实现真正的社会文化相关性分析
    return {
      linguistic: ['GB030', 'GB051', 'GB079'],
      cultural: ['EA044', 'EA045', 'EA046'],
      significant: [
        {
          linguistic: 'GB030',
          cultural: 'EA044',
          correlation: 0.65,
          pValue: 0.01
        }
      ]
    };
  } catch (error) {
    console.error('获取社会文化相关性失败:', error);
    return { linguistic: [], cultural: [], significant: [] };
  }
}

// 计算皮尔逊相关系数
export function calculatePearsonCorrelation(x, y) {
  if (x.length !== y.length) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// 计算斯皮尔曼等级相关系数
export function calculateSpearmanCorrelation(x, y) {
  if (x.length !== y.length) return 0;
  
  const n = x.length;
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    sumD2 += d * d;
  }
  
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// 获取排名
function getRanks(values) {
  const sorted = values.map((val, index) => ({ val, index })).sort((a, b) => a.val - b.val);
  const ranks = new Array(values.length);
  
  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].index] = i + 1;
  }
  
  return ranks;
}

// 计算p值（简化版本）
export function calculatePValue(correlation, sampleSize) {
  // 这是一个简化的p值计算，实际应用中应该使用更准确的统计方法
  const t = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
  // 这里应该使用t分布表或统计库来计算准确的p值
  return Math.exp(-Math.abs(t) / 10); // 简化的p值近似
} 