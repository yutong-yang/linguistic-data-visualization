import React, { createContext, useState, useEffect } from 'react';
import * as d3 from 'd3';
import en from '../langs/en';
import zh from '../langs/zh';
import { gbFeatures, gbOrangeFeatures } from '../utils/featureData';

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

  // 加载语言数据
  useEffect(() => {
    async function loadData() {
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
        console.log('Language mapping built:', nameToCodeMapping);
      } catch (error) {
        setLanguageData([]);
        setLanguageMapping({});
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 加载特征描述
  useEffect(() => {
    async function loadDescriptions() {
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
    loadDescriptions();
  }, []);

  // 获取合并的权重对象
  const getAllWeights = () => {
    return { ...gbWeights, ...eaWeights };
  };

  // 弹窗操作方法
  const showFeatureInfo = (featureId) => {
    setFeatureInfoModal({ visible: true, featureId });
  };
  const hideFeatureInfo = () => {
    setFeatureInfoModal({ visible: false, featureId: null });
  };

  return (
    <DataContext.Provider value={{
      languageData,
      languageMapping, // 添加语言映射到context
      featureDescriptions,
      selectedGBFeatures,
      setSelectedGBFeatures,
      selectedEAFeatures,
      setSelectedEAFeatures,
      gbWeights,
      setGbWeights,
      eaWeights,
      setEaWeights,
      getAllWeights,
      loading,
      // 弹窗相关
      featureInfoModal,
      showFeatureInfo,
      hideFeatureInfo,
      // 高亮相关
      highlightedLanguages,
      setHighlightedLanguages,
      // 语言相关
      lang,
      setLang,
      langs,
    }}>
      {children}
    </DataContext.Provider>
  );
}; 