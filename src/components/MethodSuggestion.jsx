import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';

const MethodSuggestion = () => {
  const { lang, langs } = useContext(DataContext);
  const [selectedMethod, setSelectedMethod] = useState(null);

  // 重要的语言学分析方法
  const linguisticMethods = [
    {
      id: 'typological_distance',
      name: lang === 'zh' ? '类型学距离分析' : 'Typological Distance Analysis',
      description: lang === 'zh' ? '基于特征相似性计算语言间的类型学距离' : 'Calculate typological distances between languages based on feature similarities',
      category: 'Typology',
      complexity: 'Medium',
      useCase: lang === 'zh' ? '语言分类，系统发育分析' : 'Language classification, phylogenetic analysis'
    },
    {
      id: 'areal_analysis',
      name: lang === 'zh' ? '区域语言学分析' : 'Areal Linguistics Analysis',
      description: lang === 'zh' ? '分析地理模式和语言接触效应' : 'Analyze geographical patterns and language contact effects',
      category: 'Areal',
      complexity: 'Medium',
      useCase: lang === 'zh' ? '语言接触，扩散模式' : 'Language contact, diffusion patterns'
    },
    {
      id: 'feature_cooccurrence',
      name: lang === 'zh' ? '特征共现分析' : 'Feature Co-occurrence Analysis',
      description: lang === 'zh' ? '识别哪些语言特征倾向于一起出现' : 'Identify which linguistic features tend to occur together',
      category: 'Correlation',
      complexity: 'Low',
      useCase: lang === 'zh' ? '语言普遍性，特征依赖关系' : 'Language universals, feature dependencies'
    },
    {
      id: 'family_comparison',
      name: lang === 'zh' ? '语言家族比较' : 'Language Family Comparison',
      description: lang === 'zh' ? '比较不同语言家族的特征' : 'Compare features across different language families',
      category: 'Phylogenetic',
      complexity: 'Medium',
      useCase: lang === 'zh' ? '遗传关系，家族特定模式' : 'Genetic relationships, family-specific patterns'
    },
    {
      id: 'geographic_clustering',
      name: lang === 'zh' ? '地理聚类分析' : 'Geographic Clustering Analysis',
      description: lang === 'zh' ? '基于地理邻近性和特征相似性聚类语言' : 'Cluster languages based on geographical proximity and feature similarity',
      category: 'Spatial',
      complexity: 'High',
      useCase: lang === 'zh' ? '方言连续体，地理变异' : 'Dialect continua, geographical variation'
    },
    {
      id: 'social_correlation',
      name: lang === 'zh' ? '社会文化相关性' : 'Social-Cultural Correlation',
      description: lang === 'zh' ? '分析语言特征与社会文化因素的关系' : 'Analyze relationships between linguistic features and social/cultural factors',
      category: 'Sociolinguistics',
      complexity: 'Medium',
      useCase: lang === 'zh' ? '语言-文化关系，社会因素' : 'Language-culture relationships, social factors'
    },
    {
      id: 'environmental_correlation',
      name: lang === 'zh' ? '环境相关性分析' : 'Environmental Correlation Analysis',
      description: lang === 'zh' ? '检查语言特征与环境因素的关系' : 'Examine relationships between linguistic features and environmental factors',
      category: 'Ecolinguistics',
      complexity: 'Medium',
      useCase: lang === 'zh' ? '语言-环境关系' : 'Language-environment relationships'
    },
    {
      id: 'feature_evolution',
      name: lang === 'zh' ? '特征演化分析' : 'Feature Evolution Analysis',
      description: lang === 'zh' ? '分析语言特征如何随时间和空间变化' : 'Analyze how linguistic features change over time and space',
      category: 'Historical',
      complexity: 'High',
      useCase: lang === 'zh' ? '语言变化，历时模式' : 'Language change, diachronic patterns'
    }
  ];

  const handleMethodClick = (method) => {
    setSelectedMethod(method);
    
    // 触发AI解释这个方法
    if (window.explainMethod) {
      window.explainMethod(method);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Typology': '#4CAF50',
      'Areal': '#2196F3',
      'Correlation': '#FF9800',
      'Phylogenetic': '#9C27B0',
      'Spatial': '#607D8B',
      'Sociolinguistics': '#E91E63',
      'Ecolinguistics': '#795548',
      'Historical': '#FF5722'
    };
    return colors[category] || '#666';
  };

  const getComplexityColor = (complexity) => {
    const colors = {
      'Low': '#4CAF50',
      'Medium': '#FF9800',
      'High': '#F44336'
    };
    return colors[complexity] || '#666';
  };

  return (
    <div className="method-suggestion-container" style={{
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '15px'
    }}>
      <h3 style={{ 
        marginBottom: '15px', 
        color: '#2c7c6c',
        fontSize: '16px',
        fontWeight: 'bold'
      }}>
        {langs[lang].methodSuggestionTitle}
      </h3>
      
      <p style={{ 
        fontSize: '12px', 
        color: '#666', 
        marginBottom: '15px',
        lineHeight: '1.4'
      }}>
        {langs[lang].methodSuggestionDesc}
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '10px' 
      }}>
        {linguisticMethods.map((method) => (
          <div
            key={method.id}
            onClick={() => handleMethodClick(method)}
            style={{
              padding: '12px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
            title={lang === 'zh' ? "点击获取AI解释和实施建议" : "Click to get AI explanation and implementation suggestions"}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{ 
                margin: '0', 
                fontSize: '13px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                {method.name}
              </h4>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  borderRadius: '3px',
                  backgroundColor: getCategoryColor(method.category),
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {langs[lang][method.category.toLowerCase()] || method.category}
                </span>
                <span style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  borderRadius: '3px',
                  backgroundColor: getComplexityColor(method.complexity),
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {langs[lang][method.complexity.toLowerCase()] || method.complexity}
                </span>
              </div>
            </div>
            
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              margin: '0 0 8px 0',
              lineHeight: '1.3'
            }}>
              {method.description}
            </p>
            
            <div style={{ 
              fontSize: '10px', 
              color: '#888',
              fontStyle: 'italic'
            }}>
              {langs[lang].useCase}: {method.useCase}
            </div>
          </div>
        ))}
      </div>

      {selectedMethod && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196F3',
          borderRadius: '6px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1976d2', fontSize: '14px' }}>
            {langs[lang].selected}: {selectedMethod.name}
          </h4>
          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
            {langs[lang].checkAI}
          </p>
        </div>
      )}
    </div>
  );
};

export default MethodSuggestion; 