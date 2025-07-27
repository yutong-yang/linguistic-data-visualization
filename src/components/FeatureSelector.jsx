import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { featureGroups, gbFeatures, gbOrangeFeatures } from '../utils/featureData';
import RecommendedFeaturesDisplay from './RecommendedFeaturesDisplay';

const FeatureSelector = () => {
  const {
    featureDescriptions,
    selectedGBFeatures,
    setSelectedGBFeatures,
    selectedEAFeatures,
    setSelectedEAFeatures,
    gbWeights,
    setGbWeights,
    eaWeights,
    setEaWeights,
    showFeatureInfo,
    lang,
    langs
  } = useContext(DataContext);

  // 初始化权重
  useEffect(() => {
    const initialGbWeights = {};
    const initialEaWeights = {};

    [...gbFeatures, ...gbOrangeFeatures].forEach(feature => {
      initialGbWeights[feature] = 1;
    });

    [...featureGroups.social.features, ...featureGroups.ecological.features].forEach(feature => {
      initialEaWeights[feature] = '';
    });

    setGbWeights(initialGbWeights);
    setEaWeights(initialEaWeights);
  }, []);

  // 处理 GB 特征选择
  const handleGBFeatureChange = (feature, checked) => {
    const newSelected = new Set(selectedGBFeatures);
    if (checked) {
      newSelected.add(feature);
      setGbWeights(prev => ({ ...prev, [feature]: prev[feature] || 1 }));
    } else {
      newSelected.delete(feature);
      setGbWeights(prev => ({ ...prev, [feature]: '' }));
    }
    setSelectedGBFeatures(Array.from(newSelected));
  };

  // 处理 GB 特征权重变化
  const handleGBWeightChange = (feature, weight) => {
    const numWeight = parseFloat(weight);
    setGbWeights(prev => ({ ...prev, [feature]: weight }));

    if (numWeight > 0) {
      const newSelected = new Set(selectedGBFeatures);
      newSelected.add(feature);
      setSelectedGBFeatures(Array.from(newSelected));
    } else {
      const newSelected = new Set(selectedGBFeatures);
      newSelected.delete(feature);
      setSelectedGBFeatures(Array.from(newSelected));
    }
  };

  // 处理 EA 特征选择
  const handleEAFeatureChange = (feature, checked) => {
    const newSelected = new Set(selectedEAFeatures);
    if (checked) {
      newSelected.add(feature);
      setEaWeights(prev => ({ ...prev, [feature]: prev[feature] || 1 }));
    } else {
      newSelected.delete(feature);
      setEaWeights(prev => ({ ...prev, [feature]: '' }));
    }
    setSelectedEAFeatures(Array.from(newSelected));
  };

  // 处理 EA 特征权重变化
  const handleEAWeightChange = (feature, weight) => {
    const numWeight = parseFloat(weight);
    setEaWeights(prev => ({ ...prev, [feature]: weight }));

    if (numWeight > 0) {
      const newSelected = new Set(selectedEAFeatures);
      newSelected.add(feature);
      setSelectedEAFeatures(Array.from(newSelected));
    } else {
      const newSelected = new Set(selectedEAFeatures);
      newSelected.delete(feature);
      setSelectedEAFeatures(Array.from(newSelected));
    }
  };

  // 全选/全不选 GB 特征
  const handleGBSelectAll = (type, selectAll) => {
    const features = type === 'gender' ? gbFeatures : gbOrangeFeatures;
    const newSelected = new Set(selectedGBFeatures);
    const newWeights = { ...gbWeights };

    features.forEach(feature => {
      if (selectAll) {
        newSelected.add(feature);
        newWeights[feature] = 1;
      } else {
        newSelected.delete(feature);
        newWeights[feature] = '';
      }
    });

    setSelectedGBFeatures(Array.from(newSelected));
    setGbWeights(newWeights);
  };

  // 全选/全不选 EA 特征
  const handleEASelectAll = (type, selectAll) => {
    const features = featureGroups[type].features;
    const newSelected = new Set(selectedEAFeatures);
    const newWeights = { ...eaWeights };

    features.forEach(feature => {
      if (selectAll) {
        newSelected.add(feature);
        newWeights[feature] = 1;
      } else {
        newSelected.delete(feature);
        newWeights[feature] = '';
      }
    });

    setSelectedEAFeatures(Array.from(newSelected));
    setEaWeights(newWeights);
  };

  // 处理特征点击事件
  const handleFeatureClick = (e, feature) => {
    e.preventDefault();
    e.stopPropagation();
    showFeatureInfo(feature);
  };

  // 渲染 GB 特征选择器
  const renderGBFeatureSelector = (type) => {
    const features = type === 'gender' ? gbFeatures : gbOrangeFeatures;
    const selectedCount = features.filter(f => selectedGBFeatures.includes(f)).length;

    return (
      <div className="feature-group">
        <h4>{type === 'gender' ? langs[lang].gbGender : langs[lang].gbClassifier}</h4>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleGBSelectAll(type, true)}
            style={{ padding: '4px 8px', background: '#2c7c6c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
          >
            {langs[lang].selectAll}
          </button>
          <button
            onClick={() => handleGBSelectAll(type, false)}
            style={{ padding: '4px 8px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
          >
            {langs[lang].deselectAll}
          </button>
          <span style={{ fontSize: '11px', color: '#666' }}>{langs[lang].selectedHint}{selectedCount}/{features.length}</span>
        </div>
        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', background: '#f9f9f9' }}>
          {features.map(feature => (
            <div key={feature} className="feature-checkbox" style={{ marginBottom: '4px' }}>
              <input
                type="checkbox"
                id={`gb_${feature}`}
                data-feature={feature}
                data-type={type}
                checked={selectedGBFeatures.includes(feature)}
                onChange={(e) => handleGBFeatureChange(feature, e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              <label
                htmlFor={`gb_${feature}`}
                style={{ cursor: 'help', fontSize: '11px', marginRight: '5px' }}
                data-feature={feature}
                title={featureDescriptions[feature]?.description || feature}
                onClick={(e) => handleFeatureClick(e, feature)}
              >
                {feature}
              </label>
              <input
                type="number"
                className="weight-input"
                data-weight={feature}
                value={gbWeights[feature] || ''}
                onChange={(e) => handleGBWeightChange(feature, e.target.value)}
                min="0"
                max="10"
                step="0.1"
                style={{ width: '50px', marginLeft: '5px', fontSize: '11px' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染 EA 特征选择器
  const renderEAFeatureSelector = (type) => {
    const features = featureGroups[type].features;
    const selectedCount = features.filter(f => selectedEAFeatures.includes(f)).length;

    return (
      <div className="feature-group">
        <h4>{type === 'social' ? langs[lang].eaSocial : langs[lang].eaEcological}</h4>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleEASelectAll(type, true)}
            style={{ padding: '4px 8px', background: '#2c7c6c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
          >
            {langs[lang].selectAll}
          </button>
          <button
            onClick={() => handleEASelectAll(type, false)}
            style={{ padding: '4px 8px', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
          >
            {langs[lang].deselectAll}
          </button>
          <span style={{ fontSize: '11px', color: '#666' }}>{langs[lang].selectedHint}{selectedCount}/{features.length}</span>
        </div>
        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', background: '#f9f9f9' }}>
          {features.map(feature => (
            <div key={feature} className="feature-checkbox" style={{ marginBottom: '4px' }}>
              <input
                type="checkbox"
                id={`ea_${feature}`}
                data-feature={feature}
                data-type={type}
                checked={selectedEAFeatures.includes(feature)}
                onChange={(e) => handleEAFeatureChange(feature, e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              <label
                htmlFor={`ea_${feature}`}
                style={{ cursor: 'help', fontSize: '11px', marginRight: '5px' }}
                data-feature={feature}
                title={featureDescriptions[feature]?.description || feature}
                onClick={(e) => handleFeatureClick(e, feature)}
              >
                {feature}
              </label>
              <input
                type="number"
                className="weight-input"
                data-weight={feature}
                value={eaWeights[feature] || ''}
                onChange={(e) => handleEAWeightChange(feature, e.target.value)}
                min="0"
                max="10"
                step="0.1"
                style={{ width: '50px', marginLeft: '5px', fontSize: '11px' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="chart-container">
      <div className="chart-title">{langs[lang].featureSelection}</div>
      
      {/* 添加状态显示 */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', padding: '4px', background: '#f0f0f0', borderRadius: '4px' }}>
        已选择: GB特征({selectedGBFeatures.length}) EA特征({selectedEAFeatures.length})
        {selectedGBFeatures.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '10px' }}>
            GB: {selectedGBFeatures.slice(0, 5).join(', ')}{selectedGBFeatures.length > 5 ? '...' : ''}
          </div>
        )}
        {selectedEAFeatures.length > 0 && (
          <div style={{ marginTop: '2px', fontSize: '10px' }}>
            EA: {selectedEAFeatures.slice(0, 5).join(', ')}{selectedEAFeatures.length > 5 ? '...' : ''}
          </div>
        )}
      </div>
      <div className="feature-selector">
        {/* EA 特征选择 */}
        {renderEAFeatureSelector('social')}
        {renderEAFeatureSelector('ecological')}

        {/* GB 特征选择 */}
        <div className="feature-group" style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 20 }}>
          <h4>GB Features Selection</h4>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              {renderGBFeatureSelector('gender')}
            </div>
            <div style={{ flex: 1 }}>
              {renderGBFeatureSelector('classifier')}
            </div>
          </div>
          
          {/* 添加图例 */}
          <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid #eee' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>{langs[lang].colorLegend}</h5>
            <div style={{ display: 'flex', gap: '20px', fontSize: '11px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(0, 188, 212, 1)', marginRight: '6px' }}></div>
                  <span>{langs[lang].value1Cyan}</span>
                </div>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(173, 216, 230, 0.4)', marginRight: '6px' }}></div>
                  <span>{langs[lang].value0Blue}</span>
                </div>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(0, 0, 0, 0)', border: '1px solid rgba(200, 200, 200, 0.5)', marginRight: '6px' }}></div>
                  <span>{langs[lang].naGray}</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(255, 140, 0, 1)', marginRight: '6px' }}></div>
                  <span>{langs[lang].value1Orange}</span>
                </div>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(255, 165, 0, 0.2)', marginRight: '6px' }}></div>
                  <span>{langs[lang].value0Orange}</span>
                </div>
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'inline-block', width: '10px', height: '10px', background: 'rgba(0, 0, 0, 0)', border: '1px solid rgba(200, 200, 200, 0.5)', marginRight: '6px' }}></div>
                  <span>{langs[lang].naGray}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 推荐特征显示 */}
      <RecommendedFeaturesDisplay />
    </div>
  );
};

export default FeatureSelector; 