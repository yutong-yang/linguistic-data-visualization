import React, { useContext, useState, useEffect } from 'react';
import { DataContext } from '../context/DataContext';

const RecommendedFeaturesDisplay = () => {
  const {
    selectedGBFeatures,
    selectedEAFeatures,
    setSelectedGBFeatures,
    setSelectedEAFeatures,
    featureDescriptions,
    lang,
    langs
  } = useContext(DataContext);

  const [recommendedFeatures, setRecommendedFeatures] = useState({
    gb: [],
    ea: []
  });

  // 监听特征变化，更新推荐特征列表
  useEffect(() => {
    // 这里可以添加逻辑来跟踪哪些是通过推荐添加的特征
    // 暂时显示所有选中的特征
    setRecommendedFeatures({
      gb: selectedGBFeatures,
      ea: selectedEAFeatures
    });
  }, [selectedGBFeatures, selectedEAFeatures]);

  // 移除推荐特征
  const removeFeature = (feature, type) => {
    if (type === 'gb') {
      setSelectedGBFeatures(prev => prev.filter(f => f !== feature));
    } else {
      setSelectedEAFeatures(prev => prev.filter(f => f !== feature));
    }
  };

  // 清空所有推荐特征
  const clearAllRecommended = (type) => {
    if (type === 'gb') {
      setSelectedGBFeatures([]);
    } else {
      setSelectedEAFeatures([]);
    }
  };

  // 获取特征描述
  const getFeatureDescription = (featureId) => {
    const desc = featureDescriptions[featureId];
    if (desc?.description) {
      // 清理描述文本，移除markdown格式
      let cleanDesc = desc.description
        .replace(/^#+\s*/gm, '') // 移除标题
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体
        .replace(/\*(.*?)\*/g, '$1') // 移除斜体
        .replace(/`(.*?)`/g, '$1') // 移除代码
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接
        .replace(/\n+/g, ' ') // 将换行替换为空格
        .trim();
      
      return cleanDesc;
    }
    
    // 如果没有描述，根据特征类型提供默认描述
    if (featureId.startsWith('GB')) {
      return 'Grambank grammatical feature';
    } else if (featureId.startsWith('EA')) {
      return 'D-PLACE social/cultural feature';
    } else if (featureId.includes('Richness')) {
      const richnessTypes = {
        'AmphibianRichness': 'Amphibian species richness in the region',
        'BirdRichness': 'Bird species richness in the region',
        'MammalRichness': 'Mammal species richness in the region',
        'VascularPlantsRichness': 'Vascular plant species richness in the region'
      };
      return richnessTypes[featureId] || 'Environmental biodiversity feature';
    }
    
    return 'Feature description not available';
  };

  // 获取特征名称
  const getFeatureName = (featureId) => {
    const desc = featureDescriptions[featureId];
    if (desc?.name) {
      return desc.name;
    }
    
    // 如果没有名称，根据特征类型提供默认名称
    if (featureId.startsWith('GB')) {
      return `Grambank Feature ${featureId}`;
    } else if (featureId.startsWith('EA')) {
      return `D-PLACE Feature ${featureId}`;
    } else if (featureId.includes('Richness')) {
      const richnessTypes = {
        'AmphibianRichness': 'Amphibian Richness',
        'BirdRichness': 'Bird Richness',
        'MammalRichness': 'Mammal Richness',
        'VascularPlantsRichness': 'Vascular Plant Richness'
      };
      return richnessTypes[featureId] || featureId;
    }
    
    return featureId;
  };

  if (recommendedFeatures.gb.length === 0 && recommendedFeatures.ea.length === 0) {
    return null; // 如果没有推荐特征，不显示组件
  }

  return (
    <div className="recommended-features-display">
      <div className="recommended-header">
        <h4>🎯 {lang === 'zh' ? '推荐特征' : 'Recommended Features'}</h4>
        <div className="recommended-stats">
          <span className="stat-item">
            GB: {recommendedFeatures.gb.length}
          </span>
          <span className="stat-item">
            EA: {recommendedFeatures.ea.length}
          </span>
        </div>
      </div>

      {/* GB推荐特征 */}
      {recommendedFeatures.gb.length > 0 && (
        <div className="feature-section">
          <div className="section-header">
            <h5>📊 Grambank Features ({recommendedFeatures.gb.length})</h5>
            <button
              onClick={() => clearAllRecommended('gb')}
              className="clear-btn"
              title={lang === 'zh' ? '清空所有GB特征' : 'Clear all GB features'}
            >
              🗑️ {lang === 'zh' ? '清空' : 'Clear'}
            </button>
          </div>
          <div className="features-grid">
            {recommendedFeatures.gb.map(feature => (
              <div key={feature} className="feature-card gb-feature">
                <div className="feature-header">
                  <span className="feature-id">{feature}</span>
                  <button
                    onClick={() => removeFeature(feature, 'gb')}
                    className="remove-btn"
                    title={lang === 'zh' ? '移除特征' : 'Remove feature'}
                  >
                    ✕
                  </button>
                </div>
                <div className="feature-name">{getFeatureName(feature)}</div>
                <div className="feature-description">
                  {(() => {
                    const desc = getFeatureDescription(feature);
                    return desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
                  })()}
                </div>
                <div className="feature-category">
                  {feature.startsWith('GB03') || feature.startsWith('GB17') || feature.startsWith('GB19') || feature.startsWith('GB31') ? 'Gender' : 
                   feature.startsWith('GB05') ? 'Classifier' : 'Grambank'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EA推荐特征 */}
      {recommendedFeatures.ea.length > 0 && (
        <div className="feature-section">
          <div className="section-header">
            <h5>🌍 D-PLACE Features ({recommendedFeatures.ea.length})</h5>
            <button
              onClick={() => clearAllRecommended('ea')}
              className="clear-btn"
              title={lang === 'zh' ? '清空所有EA特征' : 'Clear all EA features'}
            >
              🗑️ {lang === 'zh' ? '清空' : 'Clear'}
            </button>
          </div>
          <div className="features-grid">
            {recommendedFeatures.ea.map(feature => (
              <div key={feature} className="feature-card ea-feature">
                <div className="feature-header">
                  <span className="feature-id">{feature}</span>
                  <button
                    onClick={() => removeFeature(feature, 'ea')}
                    className="remove-btn"
                    title={lang === 'zh' ? '移除特征' : 'Remove feature'}
                  >
                    ✕
                  </button>
                </div>
                <div className="feature-name">{getFeatureName(feature)}</div>
                <div className="feature-description">
                  {(() => {
                    const desc = getFeatureDescription(feature);
                    return desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
                  })()}
                </div>
                <div className="feature-category">
                  {feature.includes('Richness') ? 'Environmental' : 
                   feature.startsWith('EA04') ? 'Social Gender' : 
                   feature.startsWith('EA06') || feature.startsWith('EA03') ? 'Social Structure' : 'D-PLACE'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="recommended-actions">
        <button
          onClick={() => {
            // 这里可以添加"应用推荐"的逻辑
            console.log('应用推荐特征到分析');
          }}
          className="apply-btn"
        >
          🚀 {lang === 'zh' ? '应用推荐到分析' : 'Apply to Analysis'}
        </button>
        <button
          onClick={() => {
            clearAllRecommended('gb');
            clearAllRecommended('ea');
          }}
          className="clear-all-btn"
        >
          🗑️ {lang === 'zh' ? '清空所有推荐' : 'Clear All'}
        </button>
      </div>
    </div>
  );
};

export default RecommendedFeaturesDisplay; 