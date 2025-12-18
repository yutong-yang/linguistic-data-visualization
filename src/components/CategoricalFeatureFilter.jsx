import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import * as d3 from 'd3';

const CategoricalFeatureFilter = () => {
  const { 
    lang, 
    langs, 
    selectedEAFeatures, 
    featureDescriptions,
    categoricalFilters,
    setCategoricalFilters
  } = useContext(DataContext);
  
  // 定义颜色池（与MapView保持一致）
  const categoricalColorPalette = [
    '#e41a1c', // 红色
    '#377eb8', // 蓝色
    '#4daf4a', // 绿色
    '#984ea3', // 紫色
    '#ff7f00', // 橙色
    '#ffff33', // 黄色
    '#a65628', // 棕色
    '#f781bf', // 粉色
    '#999999', // 灰色
    '#66c2a5', // 青绿色
    '#fc8d62', // 浅橙色
    '#8da0cb'  // 浅蓝色
  ];
  
  const [categoricalFeatures, setCategoricalFeatures] = useState([]);
  const [availableCodes, setAvailableCodes] = useState({});
  const [selectedFeature, setSelectedFeature] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [featureGroups, setFeatureGroups] = useState([]); // 存储具有相同代码集合的特征组
  
  // 获取特征对应的颜色（基于特征ID的哈希，与MapView保持一致）
  const getFeatureColor = (featureId) => {
    let hash = 0;
    for (let i = 0; i < featureId.length; i++) {
      hash = ((hash << 5) - hash) + featureId.charCodeAt(i);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % categoricalColorPalette.length;
    return categoricalColorPalette[index];
  };

  // 识别具有相同代码集合的特征组
  const identifyFeatureGroups = (features, codesByVar) => {
    // 创建一个映射：代码集合签名 -> 特征列表
    const groupsMap = {};
    
    features.forEach(featureId => {
      const codes = codesByVar[featureId];
      if (!codes || codes.length === 0) return;
      
      // 创建代码集合的签名（基于代码名称和描述排序后的字符串）
      // 使用名称和描述的组合来确保更准确的匹配
      const codeSignature = codes
        .map(c => `${c.name}|${c.description}`)
        .sort()
        .join('||');
      
      if (!groupsMap[codeSignature]) {
        // 保存排序后的代码列表（按名称排序）
        groupsMap[codeSignature] = {
          features: [],
          codes: [...codes].sort((a, b) => a.name.localeCompare(b.name))
        };
      }
      groupsMap[codeSignature].features.push(featureId);
    });
    
    // 只返回包含多个特征的分组，并按特征数量排序（多的在前）
    return Object.values(groupsMap)
      .filter(group => group.features.length > 1)
      .map(group => ({
        ...group,
        features: group.features.sort() // 排序特征ID
      }))
      .sort((a, b) => b.features.length - a.features.length); // 按特征数量降序排列
  };

  // 一键选择/取消选择某个类别在所有相关特征中
  const handleBulkSelectCategory = (categoryName, featureIds) => {
    setCategoricalFilters(prev => {
      const newFilters = { ...prev };
      
      // 检查是否所有特征都已选择该类别
      const allSelected = featureIds.every(featureId => {
        const codes = availableCodes[featureId] || [];
        const matchingCode = codes.find(c => c.name === categoryName);
        return matchingCode && prev[featureId]?.includes(matchingCode.id);
      });
      
      // 如果全部已选中，则取消选择；否则添加选择
      featureIds.forEach(featureId => {
        const codes = availableCodes[featureId] || [];
        const matchingCode = codes.find(code => code.name === categoryName);
        
        if (matchingCode) {
          if (!newFilters[featureId]) {
            newFilters[featureId] = [];
          }
          
          if (allSelected) {
            // 取消选择
            newFilters[featureId] = newFilters[featureId].filter(id => id !== matchingCode.id);
            if (newFilters[featureId].length === 0) {
              delete newFilters[featureId];
            }
          } else {
            // 添加选择
            if (!newFilters[featureId].includes(matchingCode.id)) {
              newFilters[featureId] = [...newFilters[featureId], matchingCode.id];
            }
          }
        }
      });
      
      return newFilters;
    });
  };

  // 加载分类变量和它们的codes
  useEffect(() => {
    const loadCategoricalData = async () => {
      try {
        // 加载codes.csv
        const codesResponse = await fetch('/dplace-cldf/cldf/codes.csv');
        const codesText = await codesResponse.text();
        const codesData = d3.csvParse(codesText);
        
        // 按变量ID分组codes
        const codesByVar = {};
        codesData.forEach(row => {
          if (row.Var_ID && row.ID) {
            if (!codesByVar[row.Var_ID]) {
              codesByVar[row.Var_ID] = [];
            }
            codesByVar[row.Var_ID].push({
              id: row.ID,
              name: row.Name,
              description: row.Description || row.Name,
              number: row.Number
            });
          }
        });
        
        setAvailableCodes(codesByVar);
        
        // 筛选出Categorical类型的已选特征
        const categoricalList = selectedEAFeatures.filter(featureId => {
          const info = featureDescriptions[featureId];
          return info && info.type === 'Categorical' && codesByVar[featureId];
        });
        
        setCategoricalFeatures(categoricalList);
        
        // 识别具有相同代码集合的特征组
        const groups = identifyFeatureGroups(categoricalList, codesByVar);
        setFeatureGroups(groups);
        
      } catch (error) {
        console.error('Failed to load categorical data:', error);
      }
    };
    
    if (selectedEAFeatures.length > 0) {
      loadCategoricalData();
    }
  }, [selectedEAFeatures, featureDescriptions]);

  // 处理类别选择
  const handleCategoryToggle = (featureId, categoryId) => {
    setCategoricalFilters(prev => {
      const newFilters = { ...prev };
      if (!newFilters[featureId]) {
        newFilters[featureId] = [];
      }
      
      const index = newFilters[featureId].indexOf(categoryId);
      if (index > -1) {
        // 已选中，取消选择
        newFilters[featureId] = newFilters[featureId].filter(id => id !== categoryId);
        if (newFilters[featureId].length === 0) {
          delete newFilters[featureId];
        }
      } else {
        // 未选中，添加选择
        newFilters[featureId] = [...newFilters[featureId], categoryId];
      }
      
      return newFilters;
    });
  };

  // 全选/全不选某个特征的所有类别
  const handleSelectAll = (featureId, selectAll) => {
    setCategoricalFilters(prev => {
      const newFilters = { ...prev };
      if (selectAll) {
        newFilters[featureId] = availableCodes[featureId].map(code => code.id);
      } else {
        delete newFilters[featureId];
      }
      return newFilters;
    });
  };

  if (categoricalFeatures.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      marginBottom: '12px',
      padding: '12px',
      background: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #dee2e6'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '10px' : '0'
      }}>
        <h4 style={{ 
          margin: 0,
          fontSize: '13px',
          color: '#495057'
        }}>
          {lang === 'zh' ? '分类特征筛选' : 'Categorical Feature Filter'}
          {Object.keys(categoricalFilters).length > 0 && (
            <span style={{ 
              marginLeft: '6px',
              fontSize: '10px',
              color: '#666',
              fontWeight: 'normal'
            }}>
              ({Object.keys(categoricalFilters).length} {lang === 'zh' ? '个激活' : 'active'})
            </span>
          )}
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '4px 8px',
            background: '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          {isExpanded ? (lang === 'zh' ? '收起' : 'Collapse') : (lang === 'zh' ? '展开' : 'Expand')}
        </button>
      </div>
      
      {isExpanded && (
        <div>
      
      {/* 显示具有相同代码集合的特征组 */}
      {featureGroups.length > 0 && (
        <div style={{
          marginBottom: '12px',
          padding: '8px',
          background: '#e7f3ff',
          borderRadius: '4px',
          border: '1px solid #b3d9ff',
          fontSize: '10px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>
            {lang === 'zh' ? '相同类别特征组 (一键选择):' : 'Identical Category Groups (Bulk Select):'}
          </div>
          {featureGroups.map((group, groupIndex) => (
            <div key={groupIndex} style={{
              marginBottom: '8px',
              padding: '6px',
              background: 'white',
              borderRadius: '3px',
              border: '1px solid #ddd'
            }}>
              <div style={{ 
                marginBottom: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#2c7c6c'
              }}>
                {group.features.join(', ')}
                <span style={{ 
                  marginLeft: '6px',
                  fontSize: '9px',
                  color: '#666',
                  fontWeight: 'normal'
                }}>
                  ({group.features.length} {lang === 'zh' ? '个特征' : 'features'})
                </span>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                marginTop: '4px'
              }}>
                {group.codes.map((code, codeIndex) => {
                  // 检查是否所有特征都已选择该类别
                  const allSelected = group.features.every(featureId => {
                    const codes = availableCodes[featureId] || [];
                    const matchingCode = codes.find(c => c.name === code.name);
                    return matchingCode && categoricalFilters[featureId]?.includes(matchingCode.id);
                  });
                  
                  return (
                    <button
                      key={`${groupIndex}-${codeIndex}-${code.name}`}
                      onClick={() => handleBulkSelectCategory(code.name, group.features)}
                      style={{
                        padding: '3px 8px',
                        background: allSelected ? '#2c7c6c' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '9px',
                        whiteSpace: 'nowrap'
                      }}
                      title={code.description !== code.name ? code.description : ''}
                    >
                      {code.name}
                      {allSelected && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 特征选择下拉框 */}
      <select
        value={selectedFeature}
        onChange={(e) => setSelectedFeature(e.target.value)}
        style={{
          width: '100%',
          padding: '6px',
          marginBottom: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '11px'
        }}
      >
        <option value="">
          {lang === 'zh' ? '选择一个分类特征...' : 'Select a categorical feature...'}
        </option>
        {categoricalFeatures.map(featureId => {
          const info = featureDescriptions[featureId];
          const selectedCount = categoricalFilters[featureId]?.length || 0;
          const totalCount = availableCodes[featureId]?.length || 0;
          return (
            <option key={featureId} value={featureId}>
              {featureId} - {info?.name?.substring(0, 40) || featureId} 
              {selectedCount > 0 ? ` (${selectedCount}/${totalCount})` : ''}
            </option>
          );
        })}
      </select>
      
      {/* 显示选中特征的类别列表 */}
      {selectedFeature && availableCodes[selectedFeature] && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'white',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
              {featureDescriptions[selectedFeature]?.name || selectedFeature}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => handleSelectAll(selectedFeature, true)}
                style={{
                  padding: '2px 6px',
                  background: '#2c7c6c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '9px'
                }}
              >
                {lang === 'zh' ? '全选' : 'All'}
              </button>
              <button
                onClick={() => handleSelectAll(selectedFeature, false)}
                style={{
                  padding: '2px 6px',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '9px'
                }}
              >
                {lang === 'zh' ? '清除' : 'Clear'}
              </button>
            </div>
          </div>
          
          <div style={{
            maxHeight: '150px',
            overflowY: 'auto',
            fontSize: '10px'
          }}>
            {availableCodes[selectedFeature].map(code => {
              const isSelected = categoricalFilters[selectedFeature]?.includes(code.id) || false;
              return (
                <label
                  key={code.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    background: isSelected ? '#e3f2fd' : 'transparent',
                    borderRadius: '3px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleCategoryToggle(selectedFeature, code.id)}
                    style={{ marginRight: '6px' }}
                  />
                  <span style={{ flex: 1 }}>
                    <strong>{code.name}</strong>
                    {code.description !== code.name && (
                      <span style={{ color: '#666', fontSize: '9px', marginLeft: '4px' }}>
                        - {code.description.substring(0, 50)}
                        {code.description.length > 50 ? '...' : ''}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          
          <div style={{ 
            marginTop: '8px',
            fontSize: '9px',
            color: '#666'
          }}>
            {lang === 'zh' 
              ? `已选择 ${categoricalFilters[selectedFeature]?.length || 0} 个类别` 
              : `Selected ${categoricalFilters[selectedFeature]?.length || 0} categories`}
          </div>
        </div>
      )}
      
      {/* 显示所有已激活的筛选 */}
      {Object.keys(categoricalFilters).length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#fff3cd',
          borderRadius: '4px',
          border: '1px solid #ffc107',
          fontSize: '10px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {lang === 'zh' ? '激活的筛选 (地图边框颜色):' : 'Active Filters (Map Border Colors):'}
          </div>
          {Object.keys(categoricalFilters).sort().map((featureId) => {
            const categories = categoricalFilters[featureId];
            const borderColor = getFeatureColor(featureId);
            return (
              <div key={featureId} style={{ 
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `3px solid ${borderColor}`,
                  background: 'white',
                  flexShrink: 0
                }} />
                <span style={{ flex: 1 }}>
                  <strong>{featureId}</strong>: {categories.length} {lang === 'zh' ? '个类别' : 'categories'}
                </span>
                <button
                  onClick={() => {
                    setCategoricalFilters(prev => {
                      const newFilters = { ...prev };
                      delete newFilters[featureId];
                      return newFilters;
                    });
                  }}
                  style={{
                    padding: '1px 4px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '9px'
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}
    </div>
  );
};

export default CategoricalFeatureFilter;

