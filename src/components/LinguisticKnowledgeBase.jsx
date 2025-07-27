import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';

const LinguisticKnowledgeBase = () => {
  const { lang, langs } = useContext(DataContext);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // 语言学知识库
  const knowledgeBase = {
    typology: [
      {
        id: 'grammatical_gender',
        name: lang === 'zh' ? '语法性别' : 'Grammatical Gender',
        description: lang === 'zh' ? '名词被分类为影响一致模式的类别系统' : 'Systems where nouns are classified into categories that affect agreement patterns',
        examples: lang === 'zh' ? ['阳性/阴性', '阳性/阴性/中性', '有生/无生'] : ['Masculine/Feminine', 'Masculine/Feminine/Neuter', 'Animate/Inanimate'],
        theories: ['Corbett (1991)', 'Aikhenvald (2000)'],
        relevance: 'GB030, GB051, GB052, GB053, GB054'
      },
      {
        id: 'numeral_classifiers',
        name: lang === 'zh' ? '数词分类词' : 'Numeral Classifiers',
        description: lang === 'zh' ? '数词需要分类词来分类被计数名词的系统' : 'Systems where numerals require classifiers that categorize the counted noun',
        examples: lang === 'zh' ? ['中文：三本书', '日语：三冊の本'] : ['Chinese: 三本书 (three-CL-book)', 'Japanese: 三冊の本 (three-CL-book)'],
        theories: ['Greenberg (1972)', 'Aikhenvald (2000)'],
        relevance: 'GB038, GB057, GB058'
      },
      {
        id: 'word_order',
        name: lang === 'zh' ? '词序类型学' : 'Word Order Typology',
        description: lang === 'zh' ? '基本陈述句中主语、宾语和动词的顺序' : 'The order of subject, object, and verb in basic declarative sentences',
        examples: lang === 'zh' ? ['SOV（日语）', 'SVO（英语）', 'VSO（阿拉伯语）'] : ['SOV (Japanese)', 'SVO (English)', 'VSO (Arabic)'],
        theories: ['Greenberg (1963)', 'Dryer (1992)'],
        relevance: 'GB193, GB194, GB195'
      },
      {
        id: 'case_marking',
        name: lang === 'zh' ? '格标记' : 'Case Marking',
        description: lang === 'zh' ? '名词或代词上语法关系的形态标记' : 'Morphological marking of grammatical relations on nouns or pronouns',
        examples: lang === 'zh' ? ['主格-宾格', '作格-通格', '三分格'] : ['Nominative-Accusative', 'Ergative-Absolutive', 'Tripartite'],
        theories: ['Comrie (1989)', 'Dixon (1994)'],
        relevance: 'GB020, GB021, GB022'
      }
    ],
    universals: [
      {
        id: 'implicational_universals',
        name: lang === 'zh' ? '蕴含普遍性' : 'Implicational Universals',
        description: lang === 'zh' ? '如果语言有特征X，那么它也有特征Y' : 'If a language has feature X, it also has feature Y',
        examples: lang === 'zh' ? ['如果语言有双数，它就有复数', '如果语言有三数，它就有双数'] : ['If a language has dual, it has plural', 'If a language has trial, it has dual'],
        theories: ['Greenberg (1963)', 'Croft (2003)'],
        relevance: lang === 'zh' ? '跨特征分析' : 'Cross-feature analysis'
      },
      {
        id: 'absolute_universals',
        name: lang === 'zh' ? '绝对普遍性' : 'Absolute Universals',
        description: lang === 'zh' ? '在所有语言中都存在的特征' : 'Features that are found in all languages',
        examples: lang === 'zh' ? ['所有语言都有辅音和元音', '所有语言都有形成问题的方式'] : ['All languages have consonants and vowels', 'All languages have ways to form questions'],
        theories: ['Chomsky (1965)', 'Haspelmath (2001)'],
        relevance: lang === 'zh' ? '基本语言结构' : 'Basic linguistic structure'
      }
    ],
    areal: [
      {
        id: 'sprachbund',
        name: lang === 'zh' ? '语言联盟' : 'Sprachbund (Linguistic Area)',
        description: lang === 'zh' ? '由于接触而非遗传关系而共享特征的地理区域' : 'Geographic regions where languages share features due to contact rather than genetic relationship',
        examples: lang === 'zh' ? ['巴尔干语言联盟', '南亚语言联盟', '中美洲语言联盟'] : ['Balkan Sprachbund', 'South Asian Sprachbund', 'Mesoamerican Sprachbund'],
        theories: ['Thomason & Kaufman (1988)', 'Aikhenvald & Dixon (2001)'],
        relevance: lang === 'zh' ? '地理聚类分析' : 'Geographic clustering analysis'
      },
      {
        id: 'contact_induced_change',
        name: lang === 'zh' ? '接触诱导变化' : 'Contact-Induced Change',
        description: lang === 'zh' ? '由于语言接触而发生的语言变化' : 'Linguistic changes that occur due to language contact',
        examples: lang === 'zh' ? ['借用', '仿译', '趋同'] : ['Borrowing', 'Calquing', 'Convergence'],
        theories: ['Thomason (2001)', 'Winford (2003)'],
        relevance: lang === 'zh' ? 'EA特征，社会因素' : 'EA features, social factors'
      }
    ],
    methods: [
      {
        id: 'distance_metrics',
        name: lang === 'zh' ? '语言学中的距离度量' : 'Distance Metrics in Linguistics',
        description: lang === 'zh' ? '测量语言或特征之间相似性的方法' : 'Methods for measuring similarity between languages or features',
        examples: lang === 'zh' ? ['编辑距离', '汉明距离', '类型学距离'] : ['Levenshtein distance', 'Hamming distance', 'Typological distance'],
        theories: ['Serva & Petroni (2008)', 'Wichmann et al. (2010)'],
        relevance: lang === 'zh' ? '语言分类' : 'Language classification'
      },
      {
        id: 'statistical_methods',
        name: lang === 'zh' ? '类型学中的统计方法' : 'Statistical Methods in Typology',
        description: lang === 'zh' ? '分析跨语言数据的统计方法' : 'Statistical approaches for analyzing cross-linguistic data',
        examples: lang === 'zh' ? ['相关性分析', '主成分分析', '系统发育方法'] : ['Correlation analysis', 'Principal Component Analysis', 'Phylogenetic methods'],
        theories: ['Dunn et al. (2011)', 'Greenhill et al. (2017)'],
        relevance: lang === 'zh' ? '相关性分析，特征演化' : 'Correlation analysis, feature evolution'
      }
    ]
  };

  const handleConceptClick = (concept) => {
    setSelectedConcept(concept);
    
    // 触发AI解释这个概念
    if (window.explainConcept) {
      window.explainConcept(concept);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'typology': '#4CAF50',
      'universals': '#2196F3',
      'areal': '#FF9800',
      'methods': '#9C27B0'
    };
    return colors[category] || '#666';
  };

  const allConcepts = Object.entries(knowledgeBase).flatMap(([category, concepts]) =>
    concepts.map(concept => ({ ...concept, category }))
  );

  const filteredConcepts = activeCategory === 'all' 
    ? allConcepts 
    : allConcepts.filter(concept => concept.category === activeCategory);

  return (
    <div className="linguistic-knowledge-base" style={{
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
        {langs[lang].knowledgeBaseTitle}
      </h3>
      
      {/* Category Filter */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '15px',
        flexWrap: 'wrap'
      }}>
        {['all', 'typology', 'universals', 'areal', 'methods'].map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: activeCategory === category ? getCategoryColor(category) : 'white',
              color: activeCategory === category ? 'white' : '#333',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {langs[lang][category]}
          </button>
        ))}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '10px' 
      }}>
        {filteredConcepts.map((concept) => (
          <div
            key={concept.id}
            onClick={() => handleConceptClick(concept)}
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
            title={lang === 'zh' ? "点击获取AI解释" : "Click to get AI explanation of this concept"}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{ 
                margin: '0', 
                fontSize: '13px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                {concept.name}
              </h4>
              <span style={{
                padding: '2px 6px',
                fontSize: '10px',
                borderRadius: '3px',
                backgroundColor: getCategoryColor(concept.category),
                color: 'white',
                fontWeight: 'bold'
              }}>
                {concept.category}
              </span>
            </div>
            
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              margin: '0 0 8px 0',
              lineHeight: '1.3'
            }}>
              {concept.description}
            </p>
            
            {concept.examples && (
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ fontSize: '10px', color: '#333' }}>{langs[lang].examples}:</strong>
                <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                  {concept.examples.join(', ')}
                </div>
              </div>
            )}
            
            {concept.theories && (
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ fontSize: '10px', color: '#333' }}>{langs[lang].keyTheories}:</strong>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  {concept.theories.join(', ')}
                </div>
              </div>
            )}
            
            {concept.relevance && (
              <div>
                <strong style={{ fontSize: '10px', color: '#333' }}>{langs[lang].relevance}:</strong>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  {concept.relevance}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedConcept && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#e8f5e8',
          border: '1px solid #4CAF50',
          borderRadius: '6px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>
            {langs[lang].selected}: {selectedConcept.name}
          </h4>
          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
            {langs[lang].checkAI}
          </p>
        </div>
      )}
    </div>
  );
};

export default LinguisticKnowledgeBase; 