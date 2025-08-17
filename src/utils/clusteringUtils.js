// 聚类分析工具函数

// 执行特征聚类分析
export async function performFeatureClustering() {
  try {
    // 这里应该实现真正的聚类分析
    // 目前返回模拟数据，后续可以集成真实的聚类算法
    return {
      clusters: [
        {
          id: 1,
          name: 'Cluster 1',
          features: ['GB030', 'GB051', 'GB052'],
          languages: 45,
          centroid: [0.8, 0.7, 0.9]
        },
        {
          id: 2,
          name: 'Cluster 2',
          features: ['GB079', 'GB080', 'GB083'],
          languages: 38,
          centroid: [0.6, 0.5, 0.8]
        },
        {
          id: 3,
          name: 'Cluster 3',
          features: ['GB020', 'GB021', 'GB022'],
          languages: 52,
          centroid: [0.4, 0.3, 0.6]
        }
      ],
      features: ['GB030', 'GB051', 'GB052', 'GB079', 'GB080', 'GB083', 'GB020', 'GB021', 'GB022'],
      silhouetteScore: 0.72,
      method: 'K-means',
      optimalClusters: 3
    };
  } catch (error) {
    console.error('执行特征聚类分析失败:', error);
    return {
      clusters: [],
      features: [],
      silhouetteScore: 0,
      method: 'Unknown',
      optimalClusters: 0
    };
  }
}

// K-means聚类算法
export function kMeansClustering(data, k, maxIterations = 100) {
  if (data.length === 0 || k <= 0) return { clusters: [], centroids: [] };
  
  // 随机初始化聚类中心
  let centroids = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * data.length);
    centroids.push([...data[randomIndex]]);
  }
  
  let clusters = new Array(data.length).fill(0);
  let iterations = 0;
  let converged = false;
  
  while (!converged && iterations < maxIterations) {
    iterations++;
    
    // 分配点到最近的聚类中心
    const newClusters = data.map(point => {
      let minDistance = Infinity;
      let clusterIndex = 0;
      
      centroids.forEach((centroid, i) => {
        const distance = euclideanDistance(point, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          clusterIndex = i;
        }
      });
      
      return clusterIndex;
    });
    
    // 检查是否收敛
    converged = arraysEqual(clusters, newClusters);
    clusters = newClusters;
    
    if (!converged) {
      // 更新聚类中心
      centroids = centroids.map((_, i) => {
        const clusterPoints = data.filter((_, j) => clusters[j] === i);
        if (clusterPoints.length === 0) return centroids[i];
        
        return clusterPoints[0].map((_, dim) => {
          const sum = clusterPoints.reduce((acc, point) => acc + point[dim], 0);
          return sum / clusterPoints.length;
        });
      });
    }
  }
  
  return { clusters, centroids };
}

// 计算欧几里得距离
function euclideanDistance(point1, point2) {
  if (point1.length !== point2.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < point1.length; i++) {
    sum += Math.pow(point1[i] - point2[i], 2);
  }
  
  return Math.sqrt(sum);
}

// 检查两个数组是否相等
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  
  return true;
}

// 计算轮廓系数（Silhouette Score）
export function calculateSilhouetteScore(data, clusters) {
  if (data.length === 0) return 0;
  
  let totalScore = 0;
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const clusterIndex = clusters[i];
    
    // 计算同聚类内的平均距离（a）
    const sameClusterPoints = data.filter((_, j) => clusters[j] === clusterIndex && i !== j);
    let a = 0;
    if (sameClusterPoints.length > 0) {
      a = sameClusterPoints.reduce((sum, otherPoint) => 
        sum + euclideanDistance(point, otherPoint), 0) / sameClusterPoints.length;
    }
    
    // 计算到最近其他聚类的平均距离（b）
    const otherClusters = [...new Set(clusters)].filter(c => c !== clusterIndex);
    let b = Infinity;
    
    otherClusters.forEach(clusterId => {
      const otherClusterPoints = data.filter((_, j) => clusters[j] === clusterId);
      if (otherClusterPoints.length > 0) {
        const avgDistance = otherClusterPoints.reduce((sum, otherPoint) => 
          sum + euclideanDistance(point, otherPoint), 0) / otherClusterPoints.length;
        b = Math.min(b, avgDistance);
      }
    });
    
    // 计算轮廓系数
    if (a === 0 && b === Infinity) {
      totalScore += 0;
    } else if (a === 0) {
      totalScore += 1;
    } else if (b === Infinity) {
      totalScore += -1;
    } else {
      totalScore += (b - a) / Math.max(a, b);
    }
  }
  
  return totalScore / data.length;
}

// 肘部法则确定最优聚类数
export function findOptimalClusters(data, maxK = 10) {
  const inertias = [];
  const silhouetteScores = [];
  
  for (let k = 2; k <= maxK; k++) {
    const { clusters, centroids } = kMeansClustering(data, k);
    const inertia = calculateInertia(data, clusters, centroids);
    const silhouette = calculateSilhouetteScore(data, clusters);
    
    inertias.push(inertia);
    silhouetteScores.push(silhouette);
  }
  
  // 找到轮廓系数最高的k值
  const maxSilhouetteIndex = silhouetteScores.indexOf(Math.max(...silhouetteScores));
  const optimalK = maxSilhouetteIndex + 2; // +2 because we start from k=2
  
  return {
    optimalK,
    inertias,
    silhouetteScores,
    recommendations: [
      `最优聚类数: ${optimalK}`,
      `轮廓系数: ${silhouetteScores[maxSilhouetteIndex].toFixed(3)}`,
      `建议使用 ${optimalK} 个聚类`
    ]
  };
}

// 计算聚类惯性（Inertia）
function calculateInertia(data, clusters, centroids) {
  let inertia = 0;
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const clusterIndex = clusters[i];
    const centroid = centroids[clusterIndex];
    
    inertia += Math.pow(euclideanDistance(point, centroid), 2);
  }
  
  return inertia;
}

// 层次聚类算法
export function hierarchicalClustering(data, method = 'complete') {
  if (data.length <= 1) return { clusters: data.map((_, i) => i), dendrogram: [] };
  
  // 计算距离矩阵
  const distances = [];
  for (let i = 0; i < data.length; i++) {
    distances[i] = [];
    for (let j = 0; j < data.length; j++) {
      if (i === j) {
        distances[i][j] = 0;
      } else {
        distances[i][j] = euclideanDistance(data[i], data[j]);
      }
    }
  }
  
  // 初始化聚类
  let clusters = data.map((_, i) => [i]);
  let dendrogram = [];
  
  while (clusters.length > 1) {
    // 找到最近的两个聚类
    let minDistance = Infinity;
    let cluster1Index = 0;
    let cluster2Index = 1;
    
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = calculateClusterDistance(clusters[i], clusters[j], distances, method);
        if (distance < minDistance) {
          minDistance = distance;
          cluster1Index = i;
          cluster2Index = j;
        }
      }
    }
    
    // 合并聚类
    const mergedCluster = [...clusters[cluster1Index], ...clusters[cluster2Index]];
    dendrogram.push({
      cluster1: clusters[cluster1Index],
      cluster2: clusters[cluster2Index],
      merged: mergedCluster,
      distance: minDistance
    });
    
    // 更新聚类列表
    clusters.splice(Math.max(cluster1Index, cluster2Index), 1);
    clusters.splice(Math.min(cluster1Index, cluster2Index), 1);
    clusters.push(mergedCluster);
  }
  
  return {
    clusters: clusters[0],
    dendrogram,
    method
  };
}

// 计算聚类间距离
function calculateClusterDistance(cluster1, cluster2, distances, method) {
  const distancesBetween = [];
  
  cluster1.forEach(i => {
    cluster2.forEach(j => {
      distancesBetween.push(distances[i][j]);
    });
  });
  
  switch (method) {
    case 'complete':
      return Math.max(...distancesBetween);
    case 'single':
      return Math.min(...distancesBetween);
    case 'average':
      return distancesBetween.reduce((sum, d) => sum + d, 0) / distancesBetween.length;
    default:
      return Math.max(...distancesBetween);
  }
}
