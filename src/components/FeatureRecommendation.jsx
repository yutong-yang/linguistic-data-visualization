import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { 
  recommendFeatures, 
  generateResearchIdeas, 
  getAllAvailableFeatures, 
  getFeatureDetails,
  getDatabaseOverview
} from '../utils/featureRecommendation';
import { cleanDescription } from '../utils/databaseExplorer';

const FeatureRecommendation = () => {
  const {
    languageData,
    featureDescriptions,
    selectedEAFeatures,
    selectedGBFeatures,
    selectedWALSFeatures,
    setSelectedEAFeatures,
    setSelectedGBFeatures,
    setSelectedWALSFeatures,
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
  const [isExploring, setIsExploring] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

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
    setErrorMessage(null); // 清除之前的错误
    
    try {
      // 获取推荐
      const recs = await recommendFeatures(query, languageData, featureDescriptions, lang);
      
      setRecommendations(recs);
      
      // 提取推荐中提到的特征
      const features = extractFeaturesFromRecommendations(recs);
      setRecommendedFeatures(features);
      
      // 生成研究想法
      const ideas = generateResearchIdeas(query, recs, languageData);
      setResearchIdeas(ideas);
    } catch (error) {
      console.error(t.generateRecommendationsError || '生成推荐失败:', error);
      const errorMsg = error.message || (t.generateRecommendationsError || '生成推荐失败，请稍后重试');
      setErrorMessage(errorMsg);
      // 3秒后自动清除错误消息
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsLoading(false);
      setIsExploring(false);
    }
  };

  // 添加特征到选择（避免重复）
  const addFeaturesToSelection = (features, type = null) => {
    if (!features || features.length === 0) return;
    
    // 如果type未指定，自动判断特征类型
    if (!type) {
      // 处理特征对象或字符串
      const featureIds = features
        .map(f => {
          if (typeof f === 'object' && f !== null) {
            return f.id || f.feature || f;
          }
          return f;
        })
        .filter(f => f && (typeof f === 'string' || typeof f === 'number')); // 过滤掉无效值
      
      if (featureIds.length === 0) {
        console.warn('没有找到有效的特征ID:', features);
        return;
      }
      
      console.log('处理特征列表:', featureIds);
      
      // 分类特征
      const gbFeatures = [];
      const eaFeatures = [];
      const walsFeatures = [];
      
      featureIds.forEach(featureId => {
        if (typeof featureId === 'string') {
          // WALS特征：数字+字母格式，如1A, 2A等
          if (/^\d+[A-Z]$/.test(featureId)) {
            walsFeatures.push(featureId);
          } 
          // D-PLACE特征
          else if (featureId.startsWith('EA') || 
                   featureId.startsWith('CARNEIRO_') || 
                   featureId.startsWith('SCCS') ||
                   (featureId.startsWith('B') && !featureId.startsWith('GB') && /^B\d{1,4}$/.test(featureId)) ||
                   featureId.includes('Richness') ||
                   /^(Annual|Monthly|Net|Precipitation|Temperature|Biome|EcoRegion|Elevation|Slope|DistToCoast)/.test(featureId)) {
            eaFeatures.push(featureId);
          }
          // Grambank特征
          else if (featureId.startsWith('GB')) {
            gbFeatures.push(featureId);
          }
        }
      });
      
      // 分别添加到对应的特征列表
      let totalAdded = 0;
      let totalAlreadySelected = 0;
      
      if (gbFeatures.length > 0) {
        const newGBFeatures = gbFeatures.filter(f => !selectedGBFeatures.includes(f));
        if (newGBFeatures.length > 0) {
          setSelectedGBFeatures([...selectedGBFeatures, ...newGBFeatures]);
          totalAdded += newGBFeatures.length;
        }
        totalAlreadySelected += (gbFeatures.length - newGBFeatures.length);
      }
      
      if (eaFeatures.length > 0) {
        const newEAFeatures = eaFeatures.filter(f => !selectedEAFeatures.includes(f));
        if (newEAFeatures.length > 0) {
          setSelectedEAFeatures([...selectedEAFeatures, ...newEAFeatures]);
          totalAdded += newEAFeatures.length;
        }
        totalAlreadySelected += (eaFeatures.length - newEAFeatures.length);
      }
      
      if (walsFeatures.length > 0) {
        const newWALSFeatures = walsFeatures.filter(f => !selectedWALSFeatures.includes(f));
        if (newWALSFeatures.length > 0) {
          setSelectedWALSFeatures([...selectedWALSFeatures, ...newWALSFeatures]);
          totalAdded += newWALSFeatures.length;
        }
        totalAlreadySelected += (walsFeatures.length - newWALSFeatures.length);
      }
      
      if (totalAdded > 0) {
        setAddedFeaturesCount(totalAdded);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else if (totalAlreadySelected > 0) {
        // 所有特征都已选中，显示提示
        const message = lang === 'zh' 
          ? `这些特征已经全部选中了（共${totalAlreadySelected}个）`
          : `All features are already selected (${totalAlreadySelected} features)`;
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 3000);
      } else {
        // 没有找到任何有效特征
        const message = lang === 'zh' 
          ? '没有找到有效的特征'
          : 'No valid features found';
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 3000);
      }
      return;
    }
    
    // 如果指定了type，使用原来的逻辑
    if (type === 'gb') {
      // 处理特征对象或字符串
      const featureIds = features.map(f => typeof f === 'object' ? f.id : f);
      const newFeatures = featureIds.filter(f => !selectedGBFeatures.includes(f));
      if (newFeatures.length === 0) {
        return;
      }
      const updatedFeatures = [...selectedGBFeatures, ...newFeatures];
      setSelectedGBFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } else if (type === 'ea') {
      // 处理特征对象或字符串
      const featureIds = features.map(f => typeof f === 'object' ? f.id : f);
      const newFeatures = featureIds.filter(f => !selectedEAFeatures.includes(f));
      if (newFeatures.length === 0) {
        return;
      }
      const updatedFeatures = [...selectedEAFeatures, ...newFeatures];
      setSelectedEAFeatures(updatedFeatures);
      
      // 显示成功消息
      setAddedFeaturesCount(newFeatures.length);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } else if (type === 'wals') {
      // 处理特征对象或字符串
      const featureIds = features.map(f => typeof f === 'object' ? f.id : f);
      const newFeatures = featureIds.filter(f => !selectedWALSFeatures.includes(f));
      if (newFeatures.length === 0) {
        return;
      }
      const updatedFeatures = [...selectedWALSFeatures, ...newFeatures];
      setSelectedWALSFeatures(updatedFeatures);
      
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

  // 从推荐结果中提取特征（保留source信息）
  const extractFeaturesFromRecommendations = (recs) => {
    const featuresMap = new Map(); // 使用Map保存特征对象，key是featureId
    
    recs.forEach(rec => {
      if (rec.features && Array.isArray(rec.features)) {
        rec.features.forEach(feature => {
          if (typeof feature === 'object' && feature.id) {
            // 如果后端提供了source信息，保存它
            featuresMap.set(feature.id, {id: feature.id, source: feature.source});
          } else if (typeof feature === 'string') {
            // 如果是字符串，只保存ID（source会在前端判断）
            if (!featuresMap.has(feature)) {
              featuresMap.set(feature, {id: feature, source: null});
            }
          } else {
            const featureId = String(feature);
            if (!featuresMap.has(featureId)) {
              featuresMap.set(featureId, {id: featureId, source: null});
            }
          }
        });
      }
    });
    
    // 返回特征对象数组，按ID排序
    return Array.from(featuresMap.values()).sort((a, b) => a.id.localeCompare(b.id));
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
      
      {/* 错误消息 */}
      {errorMessage && (
        <div style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '8px 12px', 
          borderRadius: '3px', 
          marginBottom: '10px',
          border: '1px solid #f5c6cb',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>❌</span>
          <span>{errorMessage}</span>
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
            {t.databaseOverviewTitle}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '9px' }}>
            <span>Grambank: {databaseOverview.grambankFeatures} {t.grammarFeatures}</span>
            <span>D-PLACE: {databaseOverview.dplaceFeatures} {t.socialCulturalFeatures}</span>
            <span>{t.total}: {databaseOverview.totalFeatures} {t.features}</span>
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
            {t.aiSmartRecommendations}
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
              {t.generateRecommendations}
            </button>
          </div>
        </div>
      </div>





      {/* 推荐特征浏览器 */}
      {recommendedFeatures.length > 0 && (
        <div className="recommended-features-section" style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '12px' }}>{t.recommendedFeaturesTitle} ({recommendedFeatures.length})</h4>
          <div className="discovered-features-grid">
            {recommendedFeatures.map(featureObj => {
              // 处理特征对象或字符串
              const featureId = typeof featureObj === 'object' ? featureObj.id : featureObj;
              const featureSource = typeof featureObj === 'object' ? featureObj.source : null;
              
              const details = getFeatureDetails(featureId, featureDescriptions);
              const isSelected = selectedGBFeatures.includes(featureId) || selectedEAFeatures.includes(featureId) || selectedWALSFeatures.includes(featureId);
              
              // 确定数据库名称：优先使用后端返回的source信息
              let databaseName = 'Unknown';
              if (featureSource) {
                databaseName = featureSource;
              } else {
                // 如果没有source信息，根据特征ID格式判断（fallback）
                // WALS特征：数字+字母格式，如1A, 2A等
                const isWals = /^\d+[A-Z]$/.test(featureId);
                const isDPlace = !isWals && (
                  featureId.startsWith('EA') || 
                  featureId.startsWith('CARNEIRO_') || 
                  featureId.startsWith('SCCS') ||
                  (featureId.startsWith('B') && !featureId.startsWith('GB') && /^B\d{1,4}$/.test(featureId)) ||
                  featureId.includes('Richness') ||
                  /^(Annual|Monthly|Net|Precipitation|Temperature|Biome|EcoRegion|Elevation|Slope|DistToCoast)/.test(featureId)
                );
                databaseName = featureId.startsWith('GB') ? 'Grambank' : 
                             isWals ? 'WALS' :
                             isDPlace ? 'D-PLACE' : 'Unknown';
              }
              // 提取子分类（如果有category且不是数据库名称）
              const subCategory = details.category && details.category !== databaseName ? details.category : null;
              
              return (
                <div key={featureId} className="discovered-feature-card">
                  <div className="feature-header">
                    <h5>{details.name}</h5>
                    <span className="feature-source">{databaseName}</span>
                  </div>
                  <p className="feature-description">{cleanDescription(details.description).substring(0, 100)}...</p>
                  <div className="feature-meta">
                    <span className="feature-id">{featureId}</span>
                    {subCategory && (
                      <span className="feature-category" style={{ 
                        marginLeft: '8px', 
                        fontSize: '10px', 
                        backgroundColor: '#e3f2fd', 
                        color: '#1565c0',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>
                        {subCategory}
                      </span>
                    )}
                  </div>
                  <div className="feature-actions">
                    <button
                      onClick={() => {
                        const featureInfo = featureDescriptions[featureId];
                        if (featureInfo) {
                          const fullFeature = {
                            id: featureId,
                            name: featureInfo.name,
                            description: featureInfo.description,
                            category: featureInfo.category
                          };
                          explainFeatureWithAI(fullFeature);
                        } else {
                          const basicFeature = {
                            id: featureId,
                            name: featureId,
                            description: '特征描述不可用',
                            category: databaseName
                          };
                          explainFeatureWithAI(basicFeature);
                        }
                      }}
                      className="ai-explain-btn"
                      title={t.getAIExplanation}
                    >
                      AI
                    </button>
                    <button
                      onClick={() => {
                        if (isSelected) {
                          if (selectedGBFeatures.includes(featureId)) {
                            setSelectedGBFeatures(selectedGBFeatures.filter(f => f !== featureId));
                          } else if (selectedEAFeatures.includes(featureId)) {
                            setSelectedEAFeatures(selectedEAFeatures.filter(f => f !== featureId));
                          } else if (selectedWALSFeatures.includes(featureId)) {
                            setSelectedWALSFeatures(selectedWALSFeatures.filter(f => f !== featureId));
                          }
                        } else {
                          if (databaseName === 'D-PLACE') {
                            addFeaturesToSelection([featureId], 'ea');
                          } else if (databaseName === 'WALS') {
                            setSelectedWALSFeatures([...selectedWALSFeatures, featureId]);
                          } else {
                            addFeaturesToSelection([featureId], 'gb');
                          }
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
          </div>
        </div>
      )}

      {/* 研究想法 */}
      {researchIdeas.length > 0 && (
        <div className="research-ideas-section">
          <h4>{t.researchIdeasTitle}</h4>
          <div className="ideas-grid">
            {researchIdeas.map((idea, index) => {
              // 提取特征ID（处理对象或字符串）
              const featureIds = (idea.features || []).map(f => typeof f === 'object' ? f.id : f);
              
              return (
                <div key={index} className="idea-card">
                  <h5>{idea.title}</h5>
                  <p>{idea.description}</p>
                  {idea.reason && (
                    <div className="idea-meta">
                      <span className="idea-reason">{idea.reason}</span>
                    </div>
                  )}
                  
                  {/* 显示将要选择的特征 */}
                  {featureIds.length > 0 && (
                    <div style={{
                      marginTop: '10px',
                      marginBottom: '10px',
                      padding: '8px',
                      background: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#666',
                        marginBottom: '6px'
                      }}>
                        {lang === 'zh' ? '将选择的特征' : 'Features to be selected'} ({featureIds.length}):
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        fontSize: '9px'
                      }}>
                        {featureIds.slice(0, 10).map((featureId, idx) => {
                          // 判断特征类型以显示不同颜色
                          let bgColor = '#e3f2fd';
                          let textColor = '#1565c0';
                          
                          if (/^\d+[A-Z]$/.test(featureId)) {
                            // WALS特征
                            bgColor = '#fff3e0';
                            textColor = '#e65100';
                          } else if (featureId.startsWith('EA') || 
                                   featureId.startsWith('CARNEIRO_') || 
                                   featureId.startsWith('SCCS') ||
                                   (featureId.startsWith('B') && !featureId.startsWith('GB') && /^B\d{1,4}$/.test(featureId)) ||
                                   featureId.includes('Richness') ||
                                   /^(Annual|Monthly|Net|Precipitation|Temperature|Biome|EcoRegion|Elevation|Slope|DistToCoast)/.test(featureId)) {
                            // D-PLACE特征
                            bgColor = '#f3e5f5';
                            textColor = '#6a1b9a';
                          }
                          
                          return (
                            <span
                              key={idx}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                backgroundColor: bgColor,
                                color: textColor,
                                fontWeight: '500',
                                border: `1px solid ${textColor}20`
                              }}
                            >
                              {featureId}
                            </span>
                          );
                        })}
                        {featureIds.length > 10 && (
                          <span style={{
                            padding: '2px 6px',
                            color: '#999',
                            fontSize: '9px'
                          }}>
                            +{featureIds.length - 10} {lang === 'zh' ? '更多' : 'more'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        console.log('点击Explore This Idea，特征列表:', idea.features);
                        if (!idea.features || idea.features.length === 0) {
                          const message = lang === 'zh' 
                            ? '该研究想法没有关联的特征'
                            : 'This research idea has no associated features';
                          setErrorMessage(message);
                          setTimeout(() => setErrorMessage(null), 3000);
                          return;
                        }
                        addFeaturesToSelection(idea.features || []);
                      } catch (error) {
                        console.error('添加特征失败:', error);
                        const message = lang === 'zh' 
                          ? `添加特征失败: ${error.message || '未知错误'}`
                          : `Failed to add features: ${error.message || 'Unknown error'}`;
                        setErrorMessage(message);
                        setTimeout(() => setErrorMessage(null), 5000);
                      }
                    }}
                    className="explore-idea-btn"
                    style={{ cursor: 'pointer' }}
                  >
                    {t.exploreThisIdea}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default FeatureRecommendation; 