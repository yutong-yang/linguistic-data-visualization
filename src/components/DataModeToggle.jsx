import React, { useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { downloadCSV, downloadJSON, downloadTSV, downloadSummary, smartDownload } from '../utils/downloadUtils';

const DataModeToggle = () => {
  const { 
    useDynamicData, 
    toggleDataMode, 
    reloadData, 
    loading,
    languageData 
  } = useContext(DataContext);

  // 下载静态数据功能
  const downloadStaticData = () => {
    if (!languageData || languageData.length === 0) {
      alert('没有可下载的数据');
      return;
    }

    try {
      // 准备下载的数据
      const downloadData = languageData.map(lang => {
        const row = { ...lang };
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
      
      console.log(`成功下载 ${downloadData.length} 行静态数据`);
    } catch (error) {
      console.error('下载静态数据时出错:', error);
      alert('下载数据时出错，请检查控制台');
    }
  };

  // 下载特定格式的静态数据
  const downloadStaticDataFormat = (format) => {
    if (!languageData || languageData.length === 0) {
      alert('没有可下载的数据');
      return;
    }

    try {
      const downloadData = languageData.map(lang => ({ ...lang }));
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
      console.error(`下载${format}格式静态数据时出错:`, error);
      alert(`下载${format}格式数据时出错，请检查控制台`);
    }
  };

  return (
    <div className="data-mode-toggle" style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      border: '1px solid #ddd'
    }}>
      <div style={{ marginBottom: '10px' }}>
        <strong>数据模式:</strong>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="radio"
            checked={!useDynamicData}
            onChange={() => !useDynamicData || toggleDataMode()}
            disabled={loading}
          />
          <span style={{ marginLeft: '8px' }}>静态数据 (预处理的CSV)</span>
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="radio"
            checked={useDynamicData}
            onChange={() => useDynamicData || toggleDataMode()}
            disabled={loading}
          />
          <span style={{ marginLeft: '8px' }}>动态数据 (实时查询数据库)</span>
        </label>
      </div>
      
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
        当前数据点: {languageData.length} 个语言
      </div>
      
      <button
        onClick={reloadData}
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        {loading ? '加载中...' : '重新加载数据'}
      </button>

      <button
        onClick={downloadStaticData}
        disabled={loading || !languageData || languageData.length === 0}
        style={{
          padding: '8px 16px',
          backgroundColor: loading || !languageData || languageData.length === 0 ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading || !languageData || languageData.length === 0 ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          marginLeft: '10px'
        }}
      >
        {loading || !languageData || languageData.length === 0 ? '不可下载' : '下载静态数据'}
      </button>

      {/* 下载格式选择器 */}
      {!loading && languageData && languageData.length > 0 && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
            选择下载格式:
          </div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadStaticDataFormat('csv')}
              style={{
                padding: '4px 8px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="CSV格式，兼容Excel"
            >
              CSV
            </button>
            <button
              onClick={() => downloadStaticDataFormat('tsv')}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="TSV格式，Excel友好"
            >
              TSV
            </button>
            <button
              onClick={() => downloadStaticDataFormat('json')}
              style={{
                padding: '4px 8px',
                backgroundColor: '#fd7e14',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="JSON格式，便于程序处理"
            >
              JSON
            </button>
            <button
              onClick={() => downloadStaticDataFormat('summary')}
              style={{
                padding: '4px 8px',
                backgroundColor: '#20c997',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="数据摘要报告"
            >
              摘要
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div style={{ 
          marginTop: '10px', 
          textAlign: 'center', 
          color: '#007bff',
          fontSize: '12px'
        }}>
          ⏳ 正在处理数据...
        </div>
      )}
    </div>
  );
};

export default DataModeToggle;
