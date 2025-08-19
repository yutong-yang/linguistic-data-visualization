import React, { createContext, useState, useEffect } from 'react';
import * as d3 from 'd3';
import en from '../langs/en';
import zh from '../langs/zh';
import { gbFeatures, gbOrangeFeatures } from '../utils/featureData';
import { buildDynamicData, getFeatureDescriptions, clearCache } from '../utils/dynamicDataService';

export const DataContext = createContext();

const langs = { en, zh };

export const DataProvider = ({ children }) => {
  const [languageData, setLanguageData] = useState([]);
  const [languageMapping, setLanguageMapping] = useState({}); // 存储语言名称到Glottocode的映射
  const [featureDescriptions, setFeatureDescriptions] = useState({});
  const [selectedGBFeatures, setSelectedGBFeatures] = useState([...gbFeatures, ...gbOrangeFeatures]); // 默认全选
  const [selectedEAFeatures, setSelectedEAFeatures] = useState([]);
  const [gbWeights, setGbWeights] = useState({});
  const [eaWeights, setEaWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('en');
  const [useDynamicData, setUseDynamicData] = useState(false); // 是否使用动态数据

  // 特征信息弹窗状态
  const [featureInfoModal, setFeatureInfoModal] = useState({
    visible: false,
    featureId: null
  });

  // 高亮语言状态
  const [highlightedLanguages, setHighlightedLanguages] = useState([]);

  // 初始化默认权重
  useEffect(() => {
    const defaultGbWeights = {};
    [...gbFeatures, ...gbOrangeFeatures].forEach(feature => {
      defaultGbWeights[feature] = 1;
    });
    setGbWeights(defaultGbWeights);
  }, []);

  // 当选择的EA特征改变时，自动初始化权重
  useEffect(() => {
    const defaultEaWeights = {};
    selectedEAFeatures.forEach(feature => {
      if (!eaWeights[feature]) {
        defaultEaWeights[feature] = 1;
      }
    });
    
    if (Object.keys(defaultEaWeights).length > 0) {
      setEaWeights(prev => ({
        ...prev,
        ...defaultEaWeights
      }));
    }
  }, [selectedEAFeatures, eaWeights]);

  // 动态数据加载函数
  const loadDynamicData = async () => {
    setLoading(true);
    try {
      console.log('Loading dynamic data...');
      const dynamicData = await buildDynamicData(selectedGBFeatures, selectedEAFeatures);
      
      // 构建语言名称到Glottocode的映射
      const nameToCodeMapping = {};
      dynamicData.forEach(d => {
        if (d.Name && d.Language_ID) {
          nameToCodeMapping[d.Name] = d.Language_ID;
        }
      });
      
      setLanguageData(dynamicData);
      setLanguageMapping(nameToCodeMapping);
      console.log('Dynamic data loaded:', dynamicData.length, 'language points');
    } catch (error) {
      console.error('Error loading dynamic data:', error);
      setLanguageData([]);
      setLanguageMapping({});
    } finally {
      setLoading(false);
    }
  };

  // 静态数据加载函数（保持原有逻辑）
  const loadStaticData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data_gb_dplace_edge.csv');
      const csvText = await response.text();
      const data = d3.csvParse(csvText);
      
      // 加载语言名称映射
      let languageNames = {};
      try {
        // 首先从languages.csv加载
        const langResponse = await fetch('/grambank-grambank-7ae000c/cldf/languages.csv');
        const langText = await langResponse.text();
        const langData = d3.csvParse(langText);
        
        langData.forEach(lang => {
          if (lang.Glottocode && lang.Name) {
            languageNames[lang.Glottocode] = lang.Name;
          }
        });
        
        // 然后从societies.csv加载（补充缺失的语言）
        const socResponse = await fetch('/dplace-cldf/cldf/societies.csv');
        const socText = await socResponse.text();
        const socData = d3.csvParse(socText);
        
        socData.forEach(soc => {
          if (soc.Glottocode && soc.Name && !languageNames[soc.Glottocode]) {
            languageNames[soc.Glottocode] = soc.Name;
          }
        });
        
        console.log('Loaded language names from both sources:', Object.keys(languageNames).length);
      } catch (error) {
        console.warn('Could not load language names, using Language_ID as fallback');
      }
      
      // 构建语言名称到Glottocode的映射（与原始HTML版本一致）
      const nameToCodeMapping = {};
      
      data.forEach(d => {
        d.Latitude = parseFloat(d.Latitude);
        d.Longitude = parseFloat(d.Longitude);
        
        // 设置语言名称
        if (d.Language_ID) {
          // 尝试从languages.csv和societies.csv获取语言名称
          if (languageNames[d.Language_ID]) {
            d.Name = languageNames[d.Language_ID];
          } else {
            // 如果没有找到，使用Language_ID作为名称
            d.Name = d.Language_ID;
          }
          
          // 创建语言名称到Glottocode的映射（与原始HTML版本一致）
          if (d.Name && d.Language_ID) {
            nameToCodeMapping[d.Name] = d.Language_ID;
          }
        }
      });
      
      setLanguageData(data);
      setLanguageMapping(nameToCodeMapping);
      console.log('Static data loaded:', data.length, 'language points');
    } catch (error) {
      setLanguageData([]);
      setLanguageMapping({});
    } finally {
      setLoading(false);
    }
  };

  // 初始数据加载
  useEffect(() => {
    if (useDynamicData) {
      loadDynamicData();
    } else {
      loadStaticData();
    }
  }, [useDynamicData]);

  // 当选择的特征改变时，如果使用动态数据则重新加载
  useEffect(() => {
    if (useDynamicData) {
      loadDynamicData();
    }
  }, [selectedGBFeatures, selectedEAFeatures, useDynamicData]);

  // 加载特征描述
  useEffect(() => {
    async function loadDescriptions() {
      if (useDynamicData) {
        // 使用动态数据服务
        const desc = await getFeatureDescriptions();
        setFeatureDescriptions(desc);
      } else {
        // 使用原有逻辑
        const desc = {};
        try {
          // GB
          const gbResponse = await fetch('/grambank-grambank-7ae000c/cldf/parameters.csv');
          const gbText = await gbResponse.text();
          const gbData = d3.csvParse(gbText);
          gbData.forEach(row => {
            if (row.ID && row.Name && row.Description) {
              desc[row.ID] = {
                name: row.Name,
                description: row.Description
              };
            }
          });
          // EA
          const eaResponse = await fetch('/dplace-cldf/cldf/variables.csv');
          const eaText = await eaResponse.text();
          const eaData = d3.csvParse(eaText);
          eaData.forEach(row => {
            if (row.ID && row.Name && row.Description) {
              if (!desc[row.ID]) {
                desc[row.ID] = {
                  name: row.Name,
                  description: row.Description
                };
              }
            }
          });
          setFeatureDescriptions(desc);
        } catch (error) {
          setFeatureDescriptions({});
        }
      }
    }
    loadDescriptions();
  }, [useDynamicData]);

  // 切换数据模式
  const toggleDataMode = () => {
    setUseDynamicData(!useDynamicData);
    if (useDynamicData) {
      // 切换到静态数据，清除动态数据缓存
      clearCache();
    }
  };

  // 重新加载数据
  const reloadData = () => {
    if (useDynamicData) {
      clearCache();
      loadDynamicData();
    } else {
      loadStaticData();
    }
  };

  // 显示特征信息
  const showFeatureInfo = (featureId) => {
    setFeatureInfoModal({
      visible: true,
      featureId
    });
  };

  // 隐藏特征信息
  const hideFeatureInfo = () => {
    setFeatureInfoModal({
      visible: false,
      featureId: null
    });
  };

  const contextValue = {
    languageData,
    languageMapping,
    featureDescriptions,
    selectedGBFeatures,
    setSelectedGBFeatures,
    selectedEAFeatures,
    setSelectedEAFeatures,
    gbWeights,
    setGbWeights,
    eaWeights,
    setEaWeights,
    loading,
    lang,
    setLang,
    langs, // 添加langs对象
    useDynamicData,
    toggleDataMode,
    reloadData,
    featureInfoModal,
    showFeatureInfo,
    hideFeatureInfo,
    highlightedLanguages,
    setHighlightedLanguages
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}; 