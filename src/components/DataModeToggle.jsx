import React, { useContext, useState, useEffect } from 'react';
import { DataContext } from '../context/DataContext';
import { downloadCSV, downloadJSON, downloadTSV, downloadSummary, smartDownload } from '../utils/downloadUtils';
import { getFamilyName, loadCombinedFamilyMapping } from '../utils/familyMapping';

const DataModeToggle = () => {
  const { 
    useDynamicData, 
    toggleDataMode, 
    reloadData, 
    loading,
    languageData,
    lang,
    langs
  } = useContext(DataContext);
  
  const [familyMapping, setFamilyMapping] = useState({});

  // 语言配置
  const t = langs[lang];

  // 加载语系映射
  useEffect(() => {
    const loadFamilyMapping = async () => {
      try {
        const mapping = await loadCombinedFamilyMapping();
        setFamilyMapping(mapping);
      } catch (error) {
        console.error(t.loadFamilyMappingError || '加载语系映射失败:', error);
      }
    };
    
    loadFamilyMapping();
  }, [t.loadFamilyMappingError]);

  // 下载静态数据功能
  const downloadStaticData = () => {
    if (!languageData || languageData.length === 0) {
      alert(t.noDataToDownload || '没有可下载的数据');
      return;
    }

    try {
      // 准备下载的数据
      const downloadData = languageData.map(lang => {
        const row = { ...lang };
        // 添加语系名称
        if (lang.Family_level_ID) {
          row.Family_Name = getFamilyName(lang.Family_level_ID, familyMapping);
        }
        return row;
      });

      // 转换为CSV格式
      const headers = Object.keys(downloadData[0]);
      const csvContent = [
        headers.join(','),
        ...downloadData.map(row => 
          headers.map(header => {
            const value = row[header];
            // 如果值包含逗号、引号或换行符，需要用引号包围
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return value.replace(/"/g, '""');
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // 创建下载链接
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `static_linguistic_data_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      URL.revokeObjectURL(url);
      
      console.log(t.downloadSuccess?.replace('{count}', downloadData.length) || `成功下载 ${downloadData.length} 行静态数据`);
    } catch (error) {
      console.error(t.downloadDataError || '下载静态数据时出错:', error);
      alert(t.downloadDataError || '下载数据时出错，请检查控制台');
    }
  };

  // 下载特定格式的静态数据
  const downloadStaticDataFormat = (format) => {
    if (!languageData || languageData.length === 0) {
      alert(t.noDataToDownload || '没有可下载的数据');
      return;
    }

    try {
      const downloadData = languageData.map(lang => {
        const row = { ...lang };
        // 添加语系名称
        if (lang.Family_level_ID) {
          row.Family_Name = getFamilyName(lang.Family_level_ID, familyMapping);
        }
        return row;
      });
      const timestamp = new Date().toISOString().slice(0, 10);
      
      switch (format) {
        case 'csv':
          downloadCSV(downloadData, `static_linguistic_data_${timestamp}.csv`);
          break;
        case 'json':
          downloadJSON(downloadData, `static_linguistic_data_${timestamp}.json`);
          break;
        case 'tsv':
          downloadTSV(downloadData, `static_linguistic_data_${timestamp}.tsv`);
          break;
        case 'summary':
          downloadSummary(downloadData, `static_data_summary_${timestamp}.txt`);
          break;
        default:
          smartDownload(downloadData, `static_linguistic_data_${timestamp}`);
      }
      
    } catch (error) {
      console.error(t.downloadFormatError?.replace('{format}', format) || `下载${format}格式静态数据时出错:`, error);
      alert(t.downloadFormatError?.replace('{format}', format) || `下载${format}格式数据时出错，请检查控制台`);
    }
  };

  return (
    <div className="data-mode-toggle" style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      backgroundColor: 'rgba(249, 249, 249, 0.95)',
      padding: '12px',
      borderRadius: '4px',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
      border: '1px solid #ddd',
      fontSize: '11px',
      minWidth: '200px'
    }}>
      <div style={{ marginBottom: '8px' }}>
        <strong style={{ color: '#666', fontSize: '12px', fontWeight: 'normal' }}>
          {t.dataModeTitle || '数据模式'}:
        </strong>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', fontSize: '10px' }}>
          <input
            type="radio"
            checked={!useDynamicData}
            onChange={() => !useDynamicData || toggleDataMode()}
            disabled={loading}
            style={{ marginRight: '6px' }}
          />
          <span style={{ color: '#666' }}>{t.staticDataLabel || '静态数据 (预处理的CSV)'}</span>
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '10px' }}>
          <input
            type="radio"
            checked={useDynamicData}
            onChange={() => useDynamicData || toggleDataMode()}
            disabled={loading}
            style={{ marginRight: '6px' }}
          />
          <span style={{ color: '#666' }}>{t.dynamicDataLabel || '动态数据 (实时查询数据库)'}</span>
        </label>
      </div>
      
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '12px' }}>
        {t.currentDataPoints?.replace('{count}', languageData.length) || `当前数据点: ${languageData.length} 个语言`}
      </div>
      
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button
          onClick={reloadData}
          disabled={loading}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: loading ? '#ccc' : '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            fontWeight: 'normal'
          }}
        >
          {loading ? t.loadingData || '加载中...' : t.reloadData || '重新加载数据'}
        </button>

        <button
          onClick={downloadStaticData}
          disabled={loading || !languageData || languageData.length === 0}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: loading || !languageData || languageData.length === 0 ? '#ccc' : '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading || !languageData || languageData.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            fontWeight: 'normal'
          }}
        >
          {loading || !languageData || languageData.length === 0 ? t.unavailableDownload || '不可下载' : t.downloadStaticData || '下载静态数据'}
        </button>
      </div>

      {/* 下载格式选择器 */}
      {!loading && languageData && languageData.length > 0 && (
        <div style={{ marginTop: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
            {t.chooseDownloadFormat || '选择下载格式'}:
          </div>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadStaticDataFormat('csv')}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
              title={t.csvFormatDescription || "CSV格式，兼容Excel"}
            >
              {t.csvFormat || 'CSV'}
            </button>
            <button
              onClick={() => downloadStaticDataFormat('tsv')}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
              title={t.tsvFormatDescription || "TSV格式，Excel友好"}
            >
              {t.tsvFormat || 'TSV'}
            </button>
            <button
              onClick={() => downloadStaticDataFormat('json')}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
              title={t.jsonFormatDescription || "JSON格式，便于程序处理"}
            >
              {t.jsonFormat || 'JSON'}
            </button>
            <button
              onClick={() => downloadStaticDataFormat('summary')}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
              title={t.summaryFormatDescription || "数据摘要报告"}
            >
              {t.summaryFormat || '摘要'}
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div style={{ 
          marginTop: '8px', 
          textAlign: 'center', 
          color: '#2c7c6c',
          fontSize: '10px'
        }}>
          {t.loadingDataMessage || '⏳ 正在处理数据...'}
        </div>
      )}
    </div>
  );
};

export default DataModeToggle;
