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
  const [recommendedFeatures, setRecommendedFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
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
      
      // 提取推荐中提到的特征
      const features = extractFeaturesFromRecommendations(recs);
      setRecommendedFeatures(features);
      
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

  // AI解释特征功能
  const explainFeatureWithAI = (feature) => {
    console.log('explainFeatureWithAI called with:', feature);
    console.log('feature type:', typeof feature);
    console.log('window.explainFeature exists:', !!window.explainFeature);
    
    if (!feature) {
      console.error('Feature is undefined or null');
      return;
    }
    
    if (window.explainFeature) {
      window.explainFeature(feature);
    } else {
      console.warn('window.explainFeature function not found');
      // 可以在这里添加一个fallback或者显示错误消息
      alert(`AI解释功能暂时不可用。特征ID: ${feature}`);
    }
  };

  // 解释推荐结果
  const explainRecommendation = (recommendation) => {
    if (window.explainRecommendation) {
      window.explainRecommendation(recommendation);
    }
  };

  // 从推荐结果中提取特征
  const extractFeaturesFromRecommendations = (recs) => {
    const features = new Set();
    
    recs.forEach(rec => {
      if (rec.features && Array.isArray(rec.features)) {
        rec.features.forEach(feature => {
          if (typeof feature === 'string') {
            features.add(feature);
          } else if (feature.id) {
            features.add(feature.id);
          }
        });
      }
    });
    
    return Array.from(features);
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
        
        {/* AI推荐生成 */}
        <div className="ai-recommendation-container">
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#495057' }}>
            🤖 {lang === 'zh' ? 'AI智能推荐' : 'AI Smart Recommendations'}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder={lang === 'zh' ? '输入研究问题或关键词...' : 'Enter research question or keywords...'}
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="feature-search-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => generateRecommendations(aiQuery)}
              disabled={isLoading}
              className="recommend-btn"
            >
              {isLoading ? '🔍' : '💡'} {lang === 'zh' ? '生成推荐' : 'Generate'}
            </button>
          </div>
        </div>
      </div>





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
                </div>
                <div className="feature-actions">
                  <button
                    onClick={() => {
                      console.log('AI button clicked for feature:', feature);
                      console.log('feature.id:', feature.id);
                      console.log('feature object:', feature);
                      explainFeatureWithAI(feature);
                    }}
                    className="ai-explain-btn"
                    title={lang === 'zh' ? '获取AI解释' : 'Get AI Explanation'}
                  >
                    🤖 AI
                  </button>
                  <button
                    onClick={() => {
                      const isSelected = selectedGBFeatures.includes(feature.id) || selectedEAFeatures.includes(feature.id);
                      if (isSelected) {
                        // 如果已选择，则删除
                        if (selectedGBFeatures.includes(feature.id)) {
                          setSelectedGBFeatures(selectedGBFeatures.filter(f => f !== feature.id));
                        } else {
                          setSelectedEAFeatures(selectedEAFeatures.filter(f => f !== feature.id));
                        }
                      } else {
                        // 如果未选择，则添加
                        const type = feature.type === 'EA' ? 'ea' : 'gb';
                        addFeaturesToSelection([feature.id], type);
                      }
                    }}
                    className={`feature-toggle-btn ${(selectedGBFeatures.includes(feature.id) || selectedEAFeatures.includes(feature.id)) ? 'remove' : 'add'}`}
                  >
                    {(selectedGBFeatures.includes(feature.id) || selectedEAFeatures.includes(feature.id)) ? '❌' : '➕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 推荐特征浏览器 */}
      {recommendedFeatures.length > 0 && (
        <div className="recommended-features-section">
          <div className="section-header">
            <h4>🔍 {lang === 'zh' ? '推荐特征' : 'Recommended Features'}</h4>
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
                {recommendedFeatures.map(feature => {
                  const details = getFeatureDetails(feature, featureDescriptions);
                  const isSelected = selectedGBFeatures.includes(feature) || selectedEAFeatures.includes(feature);
                  
                  return (
                    <div key={feature} className={`feature-item ${isSelected ? 'selected' : ''}`}>
                      <div className="feature-id">{feature}</div>
                      <div className="feature-name">{details.name}</div>
                      <div className="feature-category">{details.category}</div>
                      <div className="feature-actions">
                        <button
                          onClick={() => {
                            // 从featureDescriptions中获取完整的特征信息
                            const featureInfo = featureDescriptions[feature];
                            if (featureInfo) {
                              const fullFeature = {
                                id: feature,
                                name: featureInfo.name,
                                description: featureInfo.description,
                                category: featureInfo.category
                              };
                              explainFeatureWithAI(fullFeature);
                            } else {
                              // 如果没有找到特征信息，创建一个基本的特征对象
                              const basicFeature = {
                                id: feature,
                                name: feature,
                                description: '特征描述不可用',
                                category: feature.startsWith('GB') ? 'Grambank' : 
                                         feature.startsWith('EA') ? 'D-PLACE' : 'Unknown'
                              };
                              explainFeatureWithAI(basicFeature);
                            }
                          }}
                          className="ai-explain-btn"
                          title={lang === 'zh' ? '获取AI解释' : 'Get AI Explanation'}
                        >
                          🤖 AI
                        </button>
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
                    </div>
                  );
                })}
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '16px', color: '#666' }}>
                  {lang === 'zh' ? `显示${recommendedFeatures.length}个推荐特征` : `Showing ${recommendedFeatures.length} recommended features`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeatureRecommendation; 