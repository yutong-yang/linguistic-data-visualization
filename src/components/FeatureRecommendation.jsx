import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { 
  recommendFeatures, 
  generateResearchIdeas, 
  getAllAvailableFeatures, 
  getFeatureDetails,
  discoverNewFeatures,
  getDatabaseOverview
} from '../utils/featureRecommendation';

const FeatureRecommendation = () => {
  const {
    languageData,
    featureDescriptions,
    selectedEAFeatures,
    selectedGBFeatures,
    setSelectedEAFeatures,
    setSelectedGBFeatures,
    lang,
    langs
  } = useContext(DataContext);

  const [recommendations, setRecommendations] = useState([]);
  const [researchIdeas, setResearchIdeas] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [addedFeaturesCount, setAddedFeaturesCount] = useState(0);
  const [databaseOverview, setDatabaseOverview] = useState(null);
  const [discoveredFeatures, setDiscoveredFeatures] = useState([]);
  const [isExploring, setIsExploring] = useState(false);

  // 获取所有可用特征和数据库概览
  useEffect(() => {
    if (languageData && languageData.length > 0) {
      const features = getAllAvailableFeatures(languageData);
      setAllFeatures(features);
    }
    
    // 获取数据库概览
    getDatabaseOverview().then(overview => {
      setDatabaseOverview(overview);
    });
  }, [languageData]);

  // 生成推荐
  const generateRecommendations = async (query = '') => {
    if (!languageData || languageData.length === 0) return;
    
    setIsLoading(true);
    setIsExploring(true);
    try {
      // 同时进行推荐和特征发现
      const [recs, discovered] = await Promise.all([
        recommendFeatures(query, languageData, featureDescriptions),
        discoverNewFeatures(query, 15)
      ]);
      
      setRecommendations(recs);
      setDiscoveredFeatures(discovered);
      
      // 生成研究想法
      const ideas = generateResearchIdeas(query, recs, languageData);
      setResearchIdeas(ideas);
    } catch (error) {
      console.error('生成推荐失败:', error);
    } finally {
      setIsLoading(false);
      setIsExploring(false);
    }
  };

  // 添加特征到选择（避免重复）
  const addFeaturesToSelection = (features, type = 'gb') => {
    console.log('Adding features:', features, 'type:', type);
    console.log('Current selectedGBFeatures:', selectedGBFeatures);
    console.log('Current selectedEAFeatures:', selectedEAFeatures);
    
    if (type === 'gb') {
      // 过滤掉已经存在的特征
      const newFeatures = features.filter(f => !selectedGBFeatures.includes(f));
      if (newFeatures.length === 0) {
        console.log('所有GB特征都已存在');
        return;
      }
      const updatedFeatures = [...selectedGBFeatures, ...newFeatures];
      console.log('New GB features:', updatedFeatures);
      setSelectedGBFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } else {
      // 过滤掉已经存在的特征
      const newFeatures = features.filter(f => !selectedEAFeatures.includes(f));
      if (newFeatures.length === 0) {
        console.log('所有EA特征都已存在');
        return;
      }
      const updatedFeatures = [...selectedEAFeatures, ...newFeatures];
      console.log('New EA features:', updatedFeatures);
      setSelectedEAFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    }
  };

  // 搜索特征
  const searchFeatures = (query) => {
    if (!query.trim()) return allFeatures;
    
    return allFeatures.filter(feature => {
      const details = getFeatureDetails(feature, featureDescriptions);
      return feature.toLowerCase().includes(query.toLowerCase()) ||
             details.name.toLowerCase().includes(query.toLowerCase()) ||
             details.description.toLowerCase().includes(query.toLowerCase());
    });
  };

  const filteredFeatures = searchFeatures(searchQuery);

  return (
    <div className="feature-recommendation">
      {/* 调试信息 */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        当前选择: GB({selectedGBFeatures.length}) EA({selectedEAFeatures.length})
      </div>
      
      {/* 成功消息 */}
      {showSuccessMessage && (
        <div style={{ 
          background: '#d4edda', 
          color: '#155724', 
          padding: '8px 12px', 
          borderRadius: '4px', 
          marginBottom: '12px',
          border: '1px solid #c3e6cb',
          fontSize: '14px'
        }}>
          ✅ 成功添加了 {addedFeaturesCount} 个新特征到选择中！
        </div>
      )}
      
      {/* 数据库概览 */}
      {databaseOverview && (
        <div style={{ 
          background: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '6px', 
          padding: '12px', 
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#495057' }}>
            🗄️ 数据库概览
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>📊 Grambank: {databaseOverview.grambankFeatures} 个语法特征</span>
            <span>🌍 D-PLACE: {databaseOverview.dplaceFeatures} 个社会文化特征</span>
            <span>📈 总计: {databaseOverview.totalFeatures} 个特征</span>
          </div>
        </div>
      )}
      
      <div className="recommendation-header">
        <h3>🎯 {lang === 'zh' ? '智能特征推荐' : 'Smart Feature Recommendations'}</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder={lang === 'zh' ? '输入研究问题或关键词...' : 'Enter research question or keywords...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="feature-search-input"
          />
          <button
            onClick={() => generateRecommendations(searchQuery)}
            disabled={isLoading}
            className="recommend-btn"
          >
            {isLoading ? '🔍' : '💡'} {lang === 'zh' ? '生成推荐' : 'Generate'}
          </button>
        </div>
      </div>

      {/* 推荐结果 */}
      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h4>📊 {lang === 'zh' ? '推荐特征' : 'Recommended Features'}</h4>
          <div className="recommendations-grid">
            {recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card">
                <div className="rec-header">
                  <h5>{rec.name}</h5>
                  <span className="rec-score">⭐ {rec.score}</span>
                </div>
                <p className="rec-description">{rec.description}</p>
                <p className="rec-reason">{rec.reason}</p>
                <div className="rec-features">
                  <strong>{lang === 'zh' ? '相关特征:' : 'Related Features:'}</strong>
                  <div className="feature-tags">
                    {rec.features.slice(0, 5).map(feature => (
                      <span key={feature} className="feature-tag">
                        {feature}
                      </span>
                    ))}
                    {rec.features.length > 5 && (
                      <span className="feature-tag more">+{rec.features.length - 5}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const type = rec.category === 'social' || rec.category === 'environmental' ? 'ea' : 'gb';
                    addFeaturesToSelection(rec.features, type);
                  }}
                  className="add-features-btn"
                >
                  ➕ {lang === 'zh' ? '添加到选择' : 'Add to Selection'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 研究想法 */}
      {researchIdeas.length > 0 && (
        <div className="research-ideas-section">
          <h4>🔬 {lang === 'zh' ? '研究建议' : 'Research Ideas'}</h4>
          <div className="ideas-grid">
            {researchIdeas.map((idea, index) => (
              <div key={index} className="idea-card">
                <h5>{idea.title}</h5>
                <p>{idea.description}</p>
                <div className="idea-meta">
                  <span className="analysis-type">{idea.analysis}</span>
                  <span className="visualization-type">{idea.visualization}</span>
                </div>
                <button
                  onClick={() => addFeaturesToSelection(idea.features)}
                  className="explore-idea-btn"
                >
                  🚀 {lang === 'zh' ? '探索这个想法' : 'Explore This Idea'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 发现的新特征 */}
      {discoveredFeatures.length > 0 && (
        <div className="discovered-features-section">
          <h4>🔍 {lang === 'zh' ? '从数据库中发现的特征' : 'Discovered Features'} ({discoveredFeatures.length})</h4>
          <div className="discovered-features-grid">
            {discoveredFeatures.map((feature, index) => (
              <div key={index} className="discovered-feature-card">
                <div className="feature-header">
                  <h5>{feature.name}</h5>
                  <span className="feature-source">{feature.source}</span>
                </div>
                <p className="feature-description">{feature.description.substring(0, 100)}...</p>
                <div className="feature-meta">
                  <span className="feature-id">{feature.id}</span>
                  <span className="feature-category">{feature.category}</span>
                </div>
                <button
                  onClick={() => {
                    const type = feature.type === 'EA' ? 'ea' : 'gb';
                    addFeaturesToSelection([feature.id], type);
                  }}
                  className="add-features-btn"
                >
                  ➕ {lang === 'zh' ? '添加到选择' : 'Add to Selection'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 所有特征浏览器 */}
      <div className="all-features-section">
        <div className="section-header">
          <h4>🔍 {lang === 'zh' ? '所有可用特征' : 'All Available Features'}</h4>
          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="toggle-btn"
          >
            {showAllFeatures ? '👁️' : '🔍'} {showAllFeatures ? (lang === 'zh' ? '隐藏' : 'Hide') : (lang === 'zh' ? '浏览' : 'Browse')}
          </button>
        </div>
        
        {showAllFeatures && (
          <div className="features-browser">
            <div className="features-grid">
              {filteredFeatures.map(feature => {
                const details = getFeatureDetails(feature, featureDescriptions);
                const isSelected = selectedGBFeatures.includes(feature) || selectedEAFeatures.includes(feature);
                
                return (
                  <div key={feature} className={`feature-item ${isSelected ? 'selected' : ''}`}>
                    <div className="feature-id">{feature}</div>
                    <div className="feature-name">{details.name}</div>
                    <div className="feature-category">{details.category}</div>
                    <button
                                           onClick={() => {
                       console.log('Feature clicked:', feature, 'isSelected:', isSelected);
                       if (isSelected) {
                         if (selectedGBFeatures.includes(feature)) {
                           console.log('Removing from GB:', feature);
                           setSelectedGBFeatures(selectedGBFeatures.filter(f => f !== feature));
                         } else {
                           console.log('Removing from EA:', feature);
                           setSelectedEAFeatures(selectedEAFeatures.filter(f => f !== feature));
                         }
                       } else {
                         const type = feature.startsWith('EA') || feature.includes('Richness') ? 'ea' : 'gb';
                         console.log('Adding to', type, ':', feature);
                         addFeaturesToSelection([feature], type);
                       }
                     }}
                      className={`feature-toggle-btn ${isSelected ? 'remove' : 'add'}`}
                    >
                      {isSelected ? '❌' : '➕'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureRecommendation; 