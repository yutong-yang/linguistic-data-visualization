import React, { useState, useEffect, useContext } from 'react';
import * as d3 from 'd3';
import { DataContext } from '../context/DataContext';
import { downloadCSV, downloadJSON, downloadTSV, downloadSummary, smartDownload } from '../utils/downloadUtils';
import { getFamilyName, loadCombinedFamilyMapping } from '../utils/familyMapping';

const DynamicFeatureSelector = () => {
  const { 
    useDynamicData, 
    selectedGBFeatures, 
    setSelectedGBFeatures, 
    selectedEAFeatures, 
    setSelectedEAFeatures,
    reloadData,
    loading,
    lang,
    langs
  } = useContext(DataContext);
  
  const [familyMapping, setFamilyMapping] = useState({});

  const [availableGbFeatures, setAvailableGbFeatures] = useState([]);
  const [availableEaFeatures, setAvailableEaFeatures] = useState([]);
  const [searchGb, setSearchGb] = useState('');
  const [searchEa, setSearchEa] = useState('');
  const [showGbSelector, setShowGbSelector] = useState(false);
  const [showEaSelector, setShowEaSelector] = useState(false);

  // 语言配置
  const t = langs[lang];

  // 加载可用特征列表和语系映射
  useEffect(() => {
    if (useDynamicData) {
      loadAvailableFeatures();
    }
    
    // 加载语系映射
    const loadFamilyMapping = async () => {
      try {
        const mapping = await loadCombinedFamilyMapping();
        setFamilyMapping(mapping);
      } catch (error) {
        console.error(t.loadFamilyMappingError || '加载语系映射失败:', error);
      }
    };
    
    loadFamilyMapping();
  }, [useDynamicData, t.loadFamilyMappingError]);

  const loadAvailableFeatures = async () => {
    try {
      // 加载Grambank参数
      const gbResponse = await fetch('/grambank-grambank-7ae000c/cldf/parameters.csv');
      const gbText = await gbResponse.text();
      const gbData = d3.csvParse(gbText);
      
      const gbFeatures = gbData
        .filter(row => row.ID && row.Name)
        .map(row => ({
          id: row.ID,
          name: row.Name,
          description: row.Description || ''
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      // 加载D-PLACE变量
      const eaResponse = await fetch('/dplace-cldf/cldf/variables.csv');
      const eaText = await eaResponse.text();
      const eaData = d3.csvParse(eaText);
      
      const eaFeatures = eaData
        .filter(row => row.ID && row.Name)
        .map(row => ({
          id: row.ID,
          name: row.Name,
          description: row.Description || ''
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      setAvailableGbFeatures(gbFeatures);
      setAvailableEaFeatures(eaFeatures);
    } catch (error) {
      console.error('Error loading available features:', error);
    }
  };

  const filteredGbFeatures = availableGbFeatures.filter(feature =>
    feature.id.toLowerCase().includes(searchGb.toLowerCase()) ||
    feature.name.toLowerCase().includes(searchGb.toLowerCase())
  );

  const filteredEaFeatures = availableEaFeatures.filter(feature =>
    feature.id.toLowerCase().includes(searchEa.toLowerCase()) ||
    feature.name.toLowerCase().includes(searchEa.toLowerCase())
  );

  const toggleGbFeature = (featureId) => {
    if (selectedGBFeatures.includes(featureId)) {
      setSelectedGBFeatures(selectedGBFeatures.filter(id => id !== featureId));
    } else {
      setSelectedGBFeatures([...selectedGBFeatures, featureId]);
    }
  };

  const toggleEaFeature = (featureId) => {
    if (selectedEAFeatures.includes(featureId)) {
      setSelectedEAFeatures(selectedEAFeatures.filter(id => id !== featureId));
    } else {
      setSelectedEAFeatures([...selectedEAFeatures, featureId]);
    }
  };

  const clearAllFeatures = () => {
    setSelectedGBFeatures([]);
    setSelectedEAFeatures([]);
  };

  const selectAllGbFeatures = () => {
    setSelectedGBFeatures(availableGbFeatures.map(f => f.id));
  };

  const selectAllEaFeatures = () => {
    setSelectedEAFeatures(availableEaFeatures.map(f => f.id));
  };

  // 下载数据功能
  const downloadData = () => {
    if (!selectedGBFeatures.length && !selectedEAFeatures.length) {
      alert(t.selectAtLeastOneFeature || '请先选择至少一个特征');
      return;
    }

    try {
      // 获取当前语言数据
      const { languageData } = useContext(DataContext);
      
      if (!languageData || languageData.length === 0) {
        alert(t.noDataToDownload || '没有可下载的数据，请先应用特征选择');
        return;
      }

      // 准备下载的数据
      const downloadData = languageData.map(lang => {
        const row = {
          Language_ID: lang.Language_ID,
          Name: lang.Name,
          Latitude: lang.Latitude,
          Longitude: lang.Longitude,
          Family_level_ID: lang.Family_level_ID,
          Family_Name: getFamilyName(lang.Family_level_ID, familyMapping),
          Macroarea: lang.Macroarea,
          region: lang.region,
          Soc_ID: lang.Soc_ID
        };

        // 添加GB特征
        selectedGBFeatures.forEach(feature => {
          row[feature] = lang[feature] || 'NA';
        });

        // 添加EA特征
        selectedEAFeatures.forEach(feature => {
          row[feature] = lang[feature] || 'NA';
        });

        return row;
      });

      // 使用智能下载
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `dynamic_linguistic_data_${timestamp}`;
      smartDownload(downloadData, filename);
      
          } catch (error) {
        console.error(t.downloadDataError || '下载数据时出错:', error);
        alert(t.downloadDataError || '下载数据时出错，请检查控制台');
      }
  };

  // 下载特定格式
  const downloadSpecificFormat = (format) => {
    if (!selectedGBFeatures.length && !selectedEAFeatures.length) {
      alert(t.selectAtLeastOneFeature || '请先选择至少一个特征');
      return;
    }

    try {
      const { languageData } = useContext(DataContext);
      
      if (!languageData || languageData.length === 0) {
        alert(t.noDataToDownload || '没有可下载的数据，请先应用特征选择');
        return;
      }

      // 准备下载的数据
      const downloadData = languageData.map(lang => {
        const row = {
          Language_ID: lang.Language_ID,
          Name: lang.Name,
          Latitude: lang.Latitude,
          Longitude: lang.Longitude,
          Family_level_ID: lang.Family_level_ID,
          Family_Name: getFamilyName(lang.Family_level_ID, familyMapping),
          Macroarea: lang.Macroarea,
          region: lang.region,
          Soc_ID: lang.Soc_ID
        };

        // 添加GB特征
        selectedGBFeatures.forEach(feature => {
          row[feature] = lang[feature] || 'NA';
        });

        // 添加EA特征
        selectedEAFeatures.forEach(feature => {
          row[feature] = lang[feature] || 'NA';
        });

        return row;
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      
      switch (format) {
        case 'csv':
          downloadCSV(downloadData, `dynamic_linguistic_data_${timestamp}.csv`);
          break;
        case 'json':
          downloadJSON(downloadData, `dynamic_linguistic_data_${timestamp}.json`);
          break;
        case 'tsv':
          downloadTSV(downloadData, `dynamic_linguistic_data_${timestamp}.tsv`);
          break;
        case 'summary':
          downloadSummary(downloadData, `dynamic_data_summary_${timestamp}.txt`);
          break;
        default:
          smartDownload(downloadData, `dynamic_linguistic_data_${timestamp}`);
      }
      
    } catch (error) {
      console.error(t.downloadFormatError?.replace('{format}', format) || `下载${format}格式数据时出错:`, error);
      alert(t.downloadFormatError?.replace('{format}', format) || `下载${format}格式数据时出错，请检查控制台`);
    }
  };

  if (!useDynamicData) {
    return null; // 只在动态数据模式下显示
  }

  return (
    <div className="dynamic-feature-selector" style={{
      backgroundColor: '#f9f9f9',
      padding: '12px',
      borderRadius: '4px',
      marginTop: '20px',
      marginBottom: '10px',
      border: '1px solid #ddd',
      fontSize: '11px'
    }}>
      <h4 style={{ 
        marginTop: 0, 
        marginBottom: '10px', 
        color: '#666',
        fontSize: '13px',
        fontWeight: 'normal'
      }}>
        {t.dynamicFeatureSelectorTitle}
      </h4>
      
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={clearAllFeatures}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {t.clearAllFeatures}
          </button>
          
          <button
            onClick={selectAllGbFeatures}
            style={{
              padding: '4px 8px',
              backgroundColor: '#2c7c6c',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {t.selectAllGbFeatures}
          </button>
          
          <button
            onClick={selectAllEaFeatures}
            style={{
              padding: '4px 8px',
              backgroundColor: '#2c7c6c',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {t.selectAllEaFeatures}
          </button>
        </div>
        
        <div style={{ fontSize: '10px', color: '#666' }}>
          {t.selectedFeaturesCount}: {selectedGBFeatures.length} {t.gbFeatures}, {selectedEAFeatures.length} {t.eaFeatures}
        </div>
      </div>

      {/* Grambank特征选择器 */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>{t.gbFeatures}</span>
          <button
            onClick={() => setShowGbSelector(!showGbSelector)}
            style={{
              padding: '3px 6px',
              backgroundColor: '#2c7c6c',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '9px'
            }}
          >
            {showGbSelector ? t.hideSelector : t.showSelector}
          </button>
        </div>
        
        {showGbSelector && (
          <div>
            <input
              type="text"
              placeholder={t.searchGbPlaceholder}
              value={searchGb}
              onChange={(e) => setSearchGb(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                marginBottom: '8px',
                fontSize: '10px'
              }}
            />
            
            <div style={{ 
              maxHeight: '150px', 
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '3px',
              padding: '6px',
              backgroundColor: '#fff'
            }}>
              {filteredGbFeatures.map(feature => (
                <label key={feature.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '6px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedGBFeatures.includes(feature.id)}
                    onChange={() => toggleGbFeature(feature.id)}
                    style={{ marginRight: '6px' }}
                  />
                  <span>
                    <strong>{feature.id}</strong>: {feature.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* D-PLACE特征选择器 */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>{t.eaFeatures}</span>
          <button
            onClick={() => setShowEaSelector(!showEaSelector)}
            style={{
              padding: '3px 6px',
              backgroundColor: '#2c7c6c',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '9px'
            }}
          >
            {showEaSelector ? t.hideSelector : t.showSelector}
          </button>
        </div>
        
        {showEaSelector && (
          <div>
            <input
              type="text"
              placeholder={t.searchEaPlaceholder}
              value={searchEa}
              onChange={(e) => setSearchEa(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                marginBottom: '8px',
                fontSize: '10px'
              }}
            />
            
            <div style={{ 
              maxHeight: '150px', 
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '3px',
              padding: '6px',
              backgroundColor: '#fff'
            }}>
              {filteredEaFeatures.map(feature => (
                <label key={feature.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '6px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedEAFeatures.includes(feature.id)}
                    onChange={() => toggleEaFeature(feature.id)}
                    style={{ marginRight: '6px' }}
                  />
                  <span>
                    <strong>{feature.id}</strong>: {feature.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 应用按钮 */}
      <button
        onClick={reloadData}
        disabled={loading}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: loading ? '#ccc' : '#2c7c6c',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 'normal'
        }}
      >
        {loading ? t.loadingData : t.applyFeatures}
      </button>
    </div>
  );
};

export default DynamicFeatureSelector;
