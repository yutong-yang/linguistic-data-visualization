// 数据下载工具
import * as d3 from 'd3';

// 下载CSV格式数据
export const downloadCSV = (data, filename = 'linguistic_data.csv') => {
  if (!data || data.length === 0) {
    throw new Error('没有可下载的数据');
  }

  try {
    // 准备下载的数据
    const downloadData = data.map(row => ({ ...row }));

    // 转换为CSV格式
    const headers = Object.keys(downloadData[0]);
    const csvContent = [
      headers.join(','),
      ...downloadData.map(row => 
        headers.map(header => {
          const value = row[header];
          // 如果值包含逗号、引号或换行符，需要用引号包围
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
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
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理URL对象
    URL.revokeObjectURL(url);
    
    console.log(`成功下载 ${downloadData.length} 行数据到 ${filename}`);
    return true;
  } catch (error) {
    console.error('下载CSV数据时出错:', error);
    throw error;
  }
};

// 下载JSON格式数据
export const downloadJSON = (data, filename = 'linguistic_data.json') => {
  if (!data || data.length === 0) {
    throw new Error('没有可下载的数据');
  }

  try {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`成功下载 ${data.length} 行JSON数据到 ${filename}`);
    return true;
  } catch (error) {
    console.error('下载JSON数据时出错:', error);
    throw error;
  }
};

// 下载Excel格式数据（TSV格式，可以用Excel打开）
export const downloadTSV = (data, filename = 'linguistic_data.tsv') => {
  if (!data || data.length === 0) {
    throw new Error('没有可下载的数据');
  }

  try {
    const downloadData = data.map(row => ({ ...row }));
    const headers = Object.keys(downloadData[0]);
    const tsvContent = [
      headers.join('\t'),
      ...downloadData.map(row => 
        headers.map(header => {
          const value = row[header];
          // TSV不需要处理逗号，但需要处理制表符和换行符
          if (typeof value === 'string' && (value.includes('\t') || value.includes('\n'))) {
            return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
          }
          return value;
        }).join('\t')
      )
    ].join('\n');

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`成功下载 ${downloadData.length} 行TSV数据到 ${filename}`);
    return true;
  } catch (error) {
    console.error('下载TSV数据时出错:', error);
    throw error;
  }
};

// 智能下载（根据数据量选择最佳格式）
export const smartDownload = (data, baseFilename = 'linguistic_data') => {
  if (!data || data.length === 0) {
    throw new Error('没有可下载的数据');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  
  // 根据数据量选择格式
  if (data.length > 10000) {
    // 大数据量使用CSV
    return downloadCSV(data, `${baseFilename}_${timestamp}.csv`);
  } else if (data.length > 1000) {
    // 中等数据量使用TSV（Excel友好）
    return downloadTSV(data, `${baseFilename}_${timestamp}.tsv`);
  } else {
    // 小数据量使用JSON（便于查看）
    return downloadJSON(data, `${baseFilename}_${timestamp}.json`);
  }
};

// 生成数据摘要
export const generateDataSummary = (data) => {
  if (!data || data.length === 0) {
    return null;
  }

  const summary = {
    totalLanguages: data.length,
    features: {},
    regions: {},
    families: {},
    macroareas: {}
  };

  // 统计特征
  data.forEach(lang => {
    Object.keys(lang).forEach(key => {
      if (key.startsWith('GB') || key.startsWith('EA')) {
        if (!summary.features[key]) {
          summary.features[key] = { values: {}, total: 0 };
        }
        const value = lang[key];
        if (value !== undefined && value !== null && value !== 'NA') {
          summary.features[key].values[value] = (summary.features[key].values[value] || 0) + 1;
          summary.features[key].total += 1;
        }
      }
    });

    // 统计地理信息
    if (lang.region) {
      summary.regions[lang.region] = (summary.regions[lang.region] || 0) + 1;
    }
    if (lang.Family_level_ID) {
      summary.families[lang.Family_level_ID] = (summary.families[lang.Family_level_ID] || 0) + 1;
    }
    if (lang.Macroarea) {
      summary.macroareas[lang.Macroarea] = (summary.macroareas[lang.Macroarea] || 0) + 1;
    }
  });

  return summary;
};

// 下载数据摘要报告
export const downloadSummary = (data, filename = 'data_summary.txt') => {
  const summary = generateDataSummary(data);
  if (!summary) {
    throw new Error('无法生成数据摘要');
  }

  try {
    let report = `语言数据摘要报告\n`;
    report += `生成时间: ${new Date().toLocaleString()}\n`;
    report += `总语言数量: ${summary.totalLanguages}\n\n`;

    // 地理分布
    report += `地理分布:\n`;
    report += `区域分布:\n`;
    Object.entries(summary.regions)
      .sort(([,a], [,b]) => b - a)
      .forEach(([region, count]) => {
        report += `  ${region}: ${count} 个语言\n`;
      });

    report += `\n语系分布:\n`;
    Object.entries(summary.families)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20) // 只显示前20个
      .forEach(([family, count]) => {
        report += `  ${family}: ${count} 个语言\n`;
      });

    report += `\n大区域分布:\n`;
    Object.entries(summary.macroareas)
      .sort(([,a], [,b]) => b - a)
      .forEach(([macroarea, count]) => {
        report += `  ${macroarea}: ${count} 个语言\n`;
      });

    // 特征统计
    report += `\n特征统计:\n`;
    Object.entries(summary.features).forEach(([feature, stats]) => {
      report += `\n${feature}:\n`;
      report += `  有效值数量: ${stats.total}\n`;
      report += `  值分布:\n`;
      Object.entries(stats.values)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // 只显示前10个值
        .forEach(([value, count]) => {
          report += `    ${value}: ${count} 个语言\n`;
        });
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`成功下载数据摘要到 ${filename}`);
    return true;
  } catch (error) {
    console.error('下载数据摘要时出错:', error);
    throw error;
  }
};

