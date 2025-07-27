// 定义特征组
export const gbFeatures = ['GB030', 'GB051', 'GB052', 'GB053', 'GB054', 'GB170', 'GB171', 'GB172', 'GB177', 'GB192', 'GB198', 'GB314', 'GB315', 'GB321'];
export const gbOrangeFeatures = ['GB038', 'GB057', 'GB058'];
export const eaFeatures = ['EA044', 'EA045', 'EA046', 'EA047', 'EA048', 'EA049', 'EA050', 'EA051', 'EA052', 'EA053', 'EA054', 'EA066', 'EA067', 'EA030', 'EA031', 'EA032', 'EA033', "AmphibianRichness","BirdRichness","MammalRichness","VascularPlantsRichness"];

// 特征组配置
export const featureGroups = {
  gender: {
    name: "Gender Features",
    features: gbFeatures,
    color: "cyan"
  },
  classifier: {
    name: "Classifier Features", 
    features: gbOrangeFeatures,
    color: "orange"
  },
  social: {
    name: "EA Social Features",
    features: eaFeatures.filter(f => f.startsWith('EA') && !f.includes('Richness')),
    color: "blue"
  },
  ecological: {
    name: "EA Ecological Features",
    features: eaFeatures.filter(f => f.includes('Richness')),
    color: "green"
  }
};

// 获取特征类型
export const getFeatureType = (featureId) => {
  if (gbFeatures.includes(featureId)) return 'gender';
  if (gbOrangeFeatures.includes(featureId)) return 'classifier';
  if (eaFeatures.filter(f => f.startsWith('EA') && !f.includes('Richness')).includes(featureId)) return 'social';
  if (eaFeatures.filter(f => f.includes('Richness')).includes(featureId)) return 'ecological';
  return 'unknown';
}; 