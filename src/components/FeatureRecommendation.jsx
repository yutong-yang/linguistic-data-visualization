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

  // 语言配置
  const t = langs[lang];

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
      console.error(t.generateRecommendationsError || '生成推荐失败:', error);
    } finally {
      setIsLoading(false);
      setIsExploring(false);
    }
  };

  // 添加特征到选择（避免重复）
  const addFeaturesToSelection = (features, type = 'gb') => {
    
    if (type === 'gb') {
      // 过滤掉已经存在的特征
      const newFeatures = features.filter(f => !selectedGBFeatures.includes(f));
      if (newFeatures.length === 0) {
        return;
      }
      const updatedFeatures = [...selectedGBFeatures, ...newFeatures];
      setSelectedGBFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } else {
      // 过滤掉已经存在的特征
      const newFeatures = features.filter(f => !selectedEAFeatures.includes(f));
      if (newFeatures.length === 0) {
        return;
      }
      const updatedFeatures = [...selectedEAFeatures, ...newFeatures];
      setSelectedEAFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    }
  };

  // AI解释特征功能
  const explainFeatureWithAI = (feature) => {
    
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
    <div className="feature-recommendation" style={{
      backgroundColor: '#f9f9f9',
      padding: '12px',
      borderRadius: '4px',
      marginBottom: '20px',
      border: '1px solid #ddd',
      fontSize: '11px'
    }}>
      {/* 调试信息 */}
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
        {t.currentSelection}: GB({selectedGBFeatures.length}) EA({selectedEAFeatures.length})
      </div>
      
      {/* 成功消息 */}
      {showSuccessMessage && (
        <div style={{ 
          background: '#d4edda', 
          color: '#155724', 
          padding: '6px 10px', 
          borderRadius: '3px', 
          marginBottom: '10px',
          border: '1px solid #c3e6cb',
          fontSize: '11px'
        }}>
          ✅ {t.successfullyAddedFeatures?.replace('{count}', addedFeaturesCount)}
        </div>
      )}
      
      {/* 数据库概览 */}
      {databaseOverview && (
        <div style={{ 
          background: '#f8f9fa', 
          border: '1px solid #ddd', 
          borderRadius: '3px', 
          padding: '8px', 
          marginBottom: '12px',
          fontSize: '10px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#666' }}>
            🗄️ {t.databaseOverviewTitle}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '9px' }}>
            <span>📊 Grambank: {databaseOverview.grambankFeatures} {t.grammarFeatures}</span>
            <span>🌍 D-PLACE: {databaseOverview.dplaceFeatures} {t.socialCulturalFeatures}</span>
            <span>📈 {t.total}: {databaseOverview.totalFeatures} {t.features}</span>
          </div>
        </div>
      )}
      
      <div className="recommendation-header" style={{ marginBottom: '12px' }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: '#666', 
          fontSize: '13px', 
          fontWeight: 'normal' 
        }}>
          {t.smartFeatureRecommendationsTitle}
        </h4>
        
        {/* AI推荐生成 */}
        <div className="ai-recommendation-container">
          <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#666' }}>
            🤖 {t.aiSmartRecommendations}
          </h5>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              placeholder={t.enterResearchQuestionOrKeywords}
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="feature-search-input"
              style={{ 
                flex: 1, 
                padding: '6px', 
                border: '1px solid #ddd', 
                borderRadius: '3px', 
                fontSize: '10px' 
              }}
            />
            <button
              onClick={() => generateRecommendations(aiQuery)}
              disabled={isLoading}
              style={{
                padding: '6px 8px',
                backgroundColor: isLoading ? '#ccc' : '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '10px',
                fontWeight: 'normal'
              }}
            >
              {isLoading ? '🔍' : '💡'} {t.generateRecommendations}
            </button>
          </div>
        </div>
      </div>





      {/* 研究想法 */}
      {researchIdeas.length > 0 && (
        <div className="research-ideas-section">
          <h4>{t.researchIdeasTitle}</h4>
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
                  🚀 {t.exploreThisIdea}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 发现的新特征 */}
      {discoveredFeatures.length > 0 && (
        <div className="discovered-features-section">
          <h4>{t.discoveredFeaturesTitle} ({discoveredFeatures.length})</h4>
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
                      explainFeatureWithAI(feature);
                    }}
                    className="ai-explain-btn"
                    title={t.getAIExplanation}
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
            <h4>{t.recommendedFeaturesTitle}</h4>
            <button
              onClick={() => setShowAllFeatures(!showAllFeatures)}
              className="toggle-btn"
            >
              {showAllFeatures ? '👁️' : '🔍'} {showAllFeatures ? (t.hide) : (t.browse)}
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
                          title={t.getAIExplanation}
                        >
                          🤖 AI
                        </button>
                        <button
                          onClick={() => {
                            if (isSelected) {
                              if (selectedGBFeatures.includes(feature)) {
                                setSelectedGBFeatures(selectedGBFeatures.filter(f => f !== feature));
                              } else {
                                setSelectedEAFeatures(selectedEAFeatures.filter(f => f !== feature));
                              }
                            } else {
                              const type = feature.startsWith('EA') || feature.includes('Richness') ? 'ea' : 'gb';
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
                    {t.showingRecommendedFeatures?.replace('{count}', recommendedFeatures.length) || `显示${recommendedFeatures.length}个推荐特征`}
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