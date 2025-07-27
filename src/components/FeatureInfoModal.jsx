import React, { useContext } from 'react';
import { marked } from 'marked';
import { DataContext } from '../context/DataContext';

const FeatureInfoModal = () => {
  const { featureInfoModal, hideFeatureInfo, featureDescriptions, lang, langs } = useContext(DataContext);

  if (!featureInfoModal.visible || !featureInfoModal.featureId) {
    return null;
  }

  const featureId = featureInfoModal.featureId;
  const featureInfo = featureDescriptions[featureId];

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      hideFeatureInfo();
    }
  };

  const handleClose = () => {
    hideFeatureInfo();
  };

  // 格式化描述文本 - 使用marked渲染器，完全按照原始HTML的方式
  const formatDescription = (text) => {
    if (!text) return '';
    
    try {
      // 配置marked选项，与原始HTML保持一致
      marked.setOptions({
        breaks: true,  // 允许换行符转换为<br>
        gfm: true,     // 启用GitHub风格的Markdown
        sanitize: false, // 允许HTML标签
        smartLists: true, // 智能列表
        smartypants: true // 智能标点符号
      });
      
      // 使用marked渲染Markdown
      let formatted = marked.parse(text);
      
      // 清理一些不需要的标签，与原始HTML保持一致
      formatted = formatted
        .replace(/<p><\/p>/g, '')  // 移除空段落
        .replace(/<p>(<ul>.*?<\/ul>)<\/p>/g, '$1')  // 修复列表包装
        .replace(/<p>(<ol>.*?<\/ol>)<\/p>/g, '$1'); // 修复有序列表包装
      
      return formatted;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // 如果Markdown解析失败，回退到简单的文本处理
      return text.replace(/\n/g, '<br>');
    }
  };

  // 获取特征详细信息 - 完全按照原始HTML的方式
  const getFeatureDetailedInfo = (feature) => {
    let info = '';
    
    // 检查是否是GB特征
    if (feature.startsWith('GB')) {
      const gbInfo = featureDescriptions[feature];
      if (gbInfo) {
        info = `
          <div class="feature-info-section">
            <div class="description-content">${formatDescription(gbInfo.description)}</div>
          </div>
          <div class="feature-info-section">
            <h4>Feature Type</h4>
            <p>Grambank (GB) Feature</p>
          </div>
        `;
      } else {
        info = `
          <div class="feature-info-section">
            <h4>Feature ID</h4>
            <p><strong>${feature}</strong></p>
          </div>
          <div class="feature-info-section">
            <h4>Description</h4>
            <p>This is a Grambank (GB) feature. Detailed description not available.</p>
          </div>
        `;
      }
    }
    // 检查是否是EA特征
    else if (feature.startsWith('EA')) {
      const eaInfo = featureDescriptions[feature];
      if (eaInfo) {
        info = `
          <div class="feature-info-section">
            <h4>Name</h4>
            <p><strong>${eaInfo.name}</strong></p>
          </div>
          <div class="feature-info-section">
            <h4>Description</h4>
            <div class="description-content">${formatDescription(eaInfo.description)}</div>
          </div>
          <div class="feature-info-section">
            <h4>Feature Type</h4>
            <p>D-PLACE (EA) Feature</p>
          </div>
        `;
      } else {
        info = `
          <div class="feature-info-section">
            <h4>Feature ID</h4>
            <p><strong>${feature}</strong></p>
          </div>
          <div class="feature-info-section">
            <h4>Description</h4>
            <p>This is a D-PLACE (EA) feature. Detailed description not available.</p>
          </div>
        `;
      }
    }
    // 检查是否是自然丰富度特征
    else if (feature.includes('Richness')) {
      const richnessInfo = featureDescriptions[feature];
      if (richnessInfo) {
        info = `
          <div class="feature-info-section">
            <h4>Name</h4>
            <p><strong>${richnessInfo.name}</strong></p>
          </div>
          <div class="feature-info-section">
            <h4>Description</h4>
            <div class="description-content">${formatDescription(richnessInfo.description)}</div>
          </div>
          <div class="feature-info-section">
            <h4>Feature Type</h4>
            <p>Environmental/Biodiversity Feature</p>
          </div>
        `;
      } else {
        const richnessTypes = {
          'AmphibianRichness': 'Amphibian Species Richness',
          'BirdRichness': 'Bird Species Richness',
          'MammalRichness': 'Mammal Species Richness',
          'VascularPlantsRichness': 'Vascular Plant Species Richness'
        };
        
        info = `
          <div class="feature-info-section">
            <h4>Description</h4>
            <p>This feature measures the biodiversity of ${richnessTypes[feature]?.toLowerCase() || feature.toLowerCase()} in the region where the language is spoken.</p>
          </div>
          <div class="feature-info-section">
            <h4>Feature Type</h4>
            <p>Environmental/Biodiversity Feature</p>
          </div>
        `;
      }
    }
    else {
      info = `
        <div class="feature-info-section">
          <h4>Feature ID</h4>
          <p><strong>${feature}</strong></p>
        </div>
        <div class="feature-info-section">
          <h4>Description</h4>
          <p>This is an unknown feature type. Detailed description not available.</p>
        </div>
      `;
    }
    
    return info;
  };

  const featureInfoHTML = getFeatureDetailedInfo(featureId);

  return (
    <div className="feature-info-modal" onClick={handleBackgroundClick}>
      <div className="feature-info-content">
        <div className="feature-info-header">
          <h3 id="feature-info-title">
            Feature: {featureId}
          </h3>
          <button
            id="close-feature-info"
            className="close-btn"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>
        
        <div 
          id="feature-info-body" 
          className="feature-info-body"
          dangerouslySetInnerHTML={{ __html: featureInfoHTML }}
        />
      </div>
    </div>
  );
};

export default FeatureInfoModal; 