import React, { useState, useEffect, useContext } from 'react';
import * as d3 from 'd3';
import { DataContext } from '../context/DataContext';
import { downloadCSV, downloadJSON, downloadTSV, downloadSummary, smartDownload } from '../utils/downloadUtils';

const DynamicFeatureSelector = () => {
  const { 
    useDynamicData, 
    selectedGBFeatures, 
    setSelectedGBFeatures, 
    selectedEAFeatures, 
    setSelectedEAFeatures,
    reloadData,
    loading
  } = useContext(DataContext);

  const [availableGbFeatures, setAvailableGbFeatures] = useState([]);
  const [availableEaFeatures, setAvailableEaFeatures] = useState([]);
  const [searchGb, setSearchGb] = useState('');
  const [searchEa, setSearchEa] = useState('');
  const [showGbSelector, setShowGbSelector] = useState(false);
  const [showEaSelector, setShowEaSelector] = useState(false);

  // 加载可用特征列表
  useEffect(() => {
    if (useDynamicData) {
      loadAvailableFeatures();
    }
  }, [useDynamicData]);

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
      alert('请先选择至少一个特征');
      return;
    }

    try {
      // 获取当前语言数据
      const { languageData } = useContext(DataContext);
      
      if (!languageData || languageData.length === 0) {
        alert('没有可下载的数据，请先应用特征选择');
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
      console.error('下载数据时出错:', error);
      alert('下载数据时出错，请检查控制台');
    }
  };

  // 下载特定格式
  const downloadSpecificFormat = (format) => {
    if (!selectedGBFeatures.length && !selectedEAFeatures.length) {
      alert('请先选择至少一个特征');
      return;
    }

    try {
      const { languageData } = useContext(DataContext);
      
      if (!languageData || languageData.length === 0) {
        alert('没有可下载的数据，请先应用特征选择');
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
      console.error(`下载${format}格式数据时出错:`, error);
      alert(`下载${format}格式数据时出错，请检查控制台`);
    }
  };

  if (!useDynamicData) {
    return null; // 只在动态数据模式下显示
  }

  return (
    <div className="dynamic-feature-selector" style={{
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #dee2e6'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#495057' }}>
        动态特征选择器
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={clearAllFeatures}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            清除所有特征
          </button>
          
          <button
            onClick={selectAllGbFeatures}
            style={{
              padding: '6px 12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            选择所有GB特征
          </button>
          
          <button
            onClick={selectAllEaFeatures}
            style={{
              padding: '6px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            选择所有EA特征
          </button>
        </div>
        
        <div style={{ fontSize: '12px', color: '#6c757d' }}>
          已选择: {selectedGBFeatures.length} 个GB特征, {selectedEAFeatures.length} 个EA特征
        </div>
      </div>

      {/* Grambank特征选择器 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h4 style={{ margin: 0, color: '#17a2b8' }}>Grambank特征 (GB)</h4>
          <button
            onClick={() => setShowGbSelector(!showGbSelector)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showGbSelector ? '隐藏' : '显示'} 选择器
          </button>
        </div>
        
        {showGbSelector && (
          <div>
            <input
              type="text"
              placeholder="搜索GB特征..."
              value={searchGb}
              onChange={(e) => setSearchGb(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                marginBottom: '10px'
              }}
            />
            
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '10px'
            }}>
              {filteredGbFeatures.map(feature => (
                <label key={feature.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedGBFeatures.includes(feature.id)}
                    onChange={() => toggleGbFeature(feature.id)}
                  />
                  <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                    <strong>{feature.id}</strong>: {feature.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* D-PLACE特征选择器 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h4 style={{ margin: 0, color: '#28a745' }}>D-PLACE特征 (EA)</h4>
          <button
            onClick={() => setShowEaSelector(!showEaSelector)}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showEaSelector ? '隐藏' : '显示'} 选择器
          </button>
        </div>
        
        {showEaSelector && (
          <div>
            <input
              type="text"
              placeholder="搜索EA特征..."
              value={searchEa}
              onChange={(e) => setSearchEa(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                marginBottom: '10px'
              }}
            />
            
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '10px'
            }}>
              {filteredEaFeatures.map(feature => (
                <label key={feature.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedEAFeatures.includes(feature.id)}
                    onChange={() => toggleEaFeature(feature.id)}
                  />
                  <span style={{ marginLeft: '8px', fontSize: '12px' }}>
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
          padding: '12px',
          backgroundColor: loading ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {loading ? '正在加载数据...' : '应用特征选择'}
      </button>

      {/* 下载按钮 */}
      <button
        onClick={() => downloadSpecificFormat('csv')}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        下载CSV格式数据
      </button>
      <button
        onClick={() => downloadSpecificFormat('json')}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        下载JSON格式数据
      </button>
      <button
        onClick={() => downloadSpecificFormat('tsv')}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        下载TSV格式数据
      </button>
      <button
        onClick={() => downloadSpecificFormat('summary')}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        下载数据摘要
      </button>
      <button
        onClick={downloadData}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        下载智能格式数据
      </button>
    </div>
  );
};

export default DynamicFeatureSelector;
