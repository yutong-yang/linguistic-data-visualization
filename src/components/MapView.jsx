import React, { useEffect, useRef, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import { gbFeatures, gbOrangeFeatures } from '../utils/featureData';
import { parseNexusTree, parseNewickTree, getPhylogeneticInfo } from '../utils/phylogeneticTree';
import { loadCombinedFamilyMapping, getFamilyName } from '../utils/familyMapping';





const MapView = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const { languageData, filteredLanguageData, loading, selectedGBFeatures, selectedEAFeatures, selectedWALSFeatures, gbWeights, eaWeights, walsWeights, showFeatureInfo, highlightedLanguages, dorecoHighlightedLanguages, featureDescriptions, categoricalFilters } = useContext(DataContext);
  const markersRef = useRef([]);
  const currentZoomRef = useRef(2);
  const phylogeneticTreeRef = useRef(null);
  const familyMappingRef = useRef({});
  const walsCodesRef = useRef({});
  const eaCodesRef = useRef({});
  
  // 定义分类特征的颜色池（使用ColorBrewer的Qualitative色板）
  const categoricalColorPalette = [
    '#e41a1c', // 红色
    '#377eb8', // 蓝色
    '#4daf4a', // 绿色
    '#984ea3', // 紫色
    '#ff7f00', // 橙色
    '#ffff33', // 黄色
    '#a65628', // 棕色
    '#f781bf', // 粉色
    '#999999', // 灰色
    '#66c2a5', // 青绿色
    '#fc8d62', // 浅橙色
    '#8da0cb'  // 浅蓝色
  ];

  // 加载系统发育树数据和语系映射
  useEffect(() => {
    const loadData = async () => {
      try {
        // 并行加载系统发育树和语系映射
        const [phylogeneticResult, familyMapping] = await Promise.all([
          (async () => {
            try {
              const response = await fetch('/EDGE_tree.nex');
              const nexusContent = await response.text();
              
              // 解析NEXUS文件
              const nexusResult = parseNexusTree(nexusContent);
              if (nexusResult.success) {
                // 解析Newick树
                const newickResult = parseNewickTree(nexusResult.treeData.newick);
                if (newickResult.success) {
                  phylogeneticTreeRef.current = newickResult.tree;
                  return { success: true };
                } else {
                  console.error('解析Newick树失败:', newickResult.error);
                  return { success: false, error: newickResult.error };
                }
              } else {
                console.error('解析NEXUS文件失败:', nexusResult.error);
                return { success: false, error: nexusResult.error };
              }
            } catch (error) {
              console.error('加载系统发育树失败:', error);
              return { success: false, error: error.message };
            }
          })(),
          loadCombinedFamilyMapping()
        ]);
        
        // 保存语系映射
        familyMappingRef.current = familyMapping;
        
        // 加载D-PLACE codes
        try {
          const response = await fetch('/dplace-cldf/cldf/codes.csv');
          const text = await response.text();
          const data = d3.csvParse(text);
          const codes = {};
          
          data.forEach(row => {
            if (row.ID) {
              codes[row.ID] = {
                name: row.Name,
                description: row.Description || row.Name
              };
            }
          });
          
          eaCodesRef.current = codes;
        } catch (error) {
          console.error('加载EA codes失败:', error);
        }
        
        // 加载WALS codes
        try {
          const response = await fetch('/cldf-datasets-wals-014143f/cldf/codes.csv');
          const text = await response.text();
          const data = d3.csvParse(text);
          const codes = {};
          
          data.forEach(row => {
            if (row.ID) {
              codes[row.ID] = {
                name: row.Name,
                description: row.Description || row.Name
              };
            }
          });
          
          walsCodesRef.current = codes;
        } catch (error) {
          console.error('加载WALS codes失败:', error);
        }
        
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    
    loadData();
  }, []);

  // 计算标记颜色 - 修复颜色逻辑
  const getPetalColor = (feature, value) => {
    const isOrange = gbOrangeFeatures.includes(feature);
    
    if (isOrange) {
      // 橙色特征
      if (value == 1) return 'rgba(255, 140, 0, 1)';
      if (value == 0) return 'rgba(255, 166, 0, 0.04)';
      return 'rgba(0, 0, 0, 0)'; // NA值透明
    } else {
      // 青色特征
      if (value == 1) return 'rgba(0, 188, 212, 1)';
      if (value == 0) return 'rgba(173, 216, 230, 0.08)';
      return 'rgba(0, 0, 0, 0)'; // NA值透明
    }
  };

  // 获取特征对应的颜色（基于特征ID的哈希，保持稳定）
  const getFeatureColor = (featureId) => {
    // 使用简单的字符串哈希函数
    let hash = 0;
    for (let i = 0; i < featureId.length; i++) {
      hash = ((hash << 5) - hash) + featureId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % categoricalColorPalette.length;
    return categoricalColorPalette[index];
  };

  // 创建标记的函数
  const createMarker = (lang, sizeValue, featureData, isTreeHighlighted, isDorecoHighlighted, matchedCategoricalFeatures) => {
    // 地图缩放自适应 - 按照gender_analysis.html的方式
    const zoom = mapInstanceRef.current.getZoom();
    currentZoomRef.current = zoom;
    const zoomFactor = Math.max(0.7, Math.min(2, zoom / 3));
    const baseRadius = Math.max(8, Math.min(14, 8 + sizeValue * 0.5));
    const radius = baseRadius * zoomFactor;
    // 计算需要的额外空间（如果有分类筛选边框）
    const maxBorderLayers = matchedCategoricalFeatures?.length || 0;
    const extraSpace = maxBorderLayers > 0 ? maxBorderLayers * 2 + 4 : 0;
    const svgSize = Math.ceil(radius * 2.2 + extraSpace * 2);

    // 构建EA特征显示内容
    const eaFeaturesHtml = selectedEAFeatures && selectedEAFeatures.length > 0 
      ? selectedEAFeatures.map((feature, idx) => {
          const value = lang[feature];
          let displayValue = value !== undefined && value !== null ? value : 'N/A';
          const featureInfo = featureDescriptions[feature];
          const featureType = featureInfo?.type ? `[${featureInfo.type}]` : '';
          
          // 对于EA特征，尝试查找code描述
          if (value !== undefined && value !== null && value !== 'N/A' && value !== '') {
            const codeId = `${feature}-${value}`;
            const codeInfo = eaCodesRef.current[codeId];
            if (codeInfo) {
              displayValue = `${value} (${codeInfo.name})`;
            }
          }
          return `<span style='cursor:pointer;color:#ff6b35;text-decoration:underline' data-feature='${feature}'>${feature}</span> ${featureType}: ${displayValue}<br/>`;
        }).join('')
      : '';
    
    // 构建WALS特征显示内容
    const walsFeaturesHtml = selectedWALSFeatures && selectedWALSFeatures.length > 0
      ? selectedWALSFeatures.map(feature => {
          const value = lang[feature];
          let displayValue = value !== undefined ? value : 'N/A';
          // 如果有codes描述，添加到显示中
          if (value && walsCodesRef.current[value]) {
            displayValue = `${value} (${walsCodesRef.current[value].name})`;
          }
          return `<span style='cursor:pointer;color:#4ecdc4;text-decoration:underline' data-feature='${feature}'>${feature}</span>: ${displayValue}<br/>`;
        }).join('')
      : '';
    
    // 弹窗内容，特征名可点击
    const popupContent = `
      <b>${lang.Name || lang.Language_ID}</b><br/>
      Language ID: ${lang.Language_ID}<br/>
      ${lang.Family_level_ID ? `Language Family: ${getFamilyName(lang.Family_level_ID, familyMappingRef.current)}<br/>` : 'Language Family: none<br/>'}
      ${lang.region ? `Region: ${lang.region}<br/>` : 'Region: none<br/>'}
      ${lang.Macroarea ? `Macro Area: ${lang.Macroarea}<br/>` : 'Macro Area: none<br/>'}
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
      
      ${featureData.length > 0 ? '<b>GB Features:</b><br/>' : ''}
      ${featureData.map(f => {
        const value = lang[f.feature];
        let displayValue = value !== undefined && value !== null ? value : 'N/A';
        // GB特征值：0=absent, 1=present
        if (value === 0 || value === '0') {
          displayValue = '0 (absent)';
        } else if (value === 1 || value === '1') {
          displayValue = '1 (present)';
        } else if (value !== 'N/A' && value !== undefined && value !== null && value !== '') {
          displayValue = value; // 其他值直接显示
        }
        return `<span style='cursor:pointer;color:#2c7c6c;text-decoration:underline' data-feature='${f.feature}'>${f.feature}</span>: ${displayValue}<br/>`;
      }).join('')}
      
      ${eaFeaturesHtml ? '<b>D-PLACE Features:</b><br/>' + eaFeaturesHtml : ''}
      
      ${walsFeaturesHtml ? '<b>WALS Features:</b><br/>' + walsFeaturesHtml : ''}
      
      <hr style="margin: 5px 0; border: none; border-top: 1px solid #ccc;">
      <button id="explain-language-btn" style="
        background: #2c7c6c; 
        color: white; 
        border: none; 
        padding: 8px 12px; 
        border-radius: 4px; 
        cursor: pointer; 
        font-size: 12px;
        width: 100%;
        margin-top: 5px;
      ">💬 获取AI讲解</button>
    `;

    if (featureData.length === 1) {
      // 单个特征时显示完整圆形
      const f = featureData[0];
      const color = getPetalColor(f.feature, f.value);
      
      // 确定边框颜色和宽度
      let strokeColor = '#fff';
      let strokeWidth = '0.5';
      
      if (f.value === null || f.value === undefined) {
        strokeColor = 'rgba(200, 200, 200, 0.3)';
        strokeWidth = '0.5';
      }
      
      const highlightClass = isTreeHighlighted ? 'tree-highlighted' : (isDorecoHighlighted ? 'doreco-highlighted' : '');
      
      // 生成多层边框圆（每个匹配的分类特征一层）
      const borderCircles = (matchedCategoricalFeatures && matchedCategoricalFeatures.length > 0)
        ? matchedCategoricalFeatures.map((featureId, idx) => {
            const borderColor = getFeatureColor(featureId);
            const borderRadius = radius + 1.5 + (idx * 2); // 每层间隔2px
            return `<circle cx="${svgSize/2}" cy="${svgSize/2}" r="${borderRadius}" fill="none" stroke="${borderColor}" stroke-width="2" opacity="0.8" />`;
          }).join('')
        : '';
      
      const svg = `
        <svg width="${svgSize}" height="${svgSize}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">
          <g class="${highlightClass}">
            <circle cx="${svgSize/2}" cy="${svgSize/2}" r="${radius}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
            ${borderCircles}
          </g>
        </svg>
      `;
      
      // 创建标记
      const marker = L.marker([lang.Latitude, lang.Longitude], {
        icon: L.divIcon({
          html: svg,
          className: `custom-icon${highlightClass ? ` ${highlightClass}` : ''}`,
          iconSize: [svgSize, svgSize],
          iconAnchor: [svgSize/2, svgSize/2]
        })
      }).addTo(mapInstanceRef.current);

      marker.bindPopup(popupContent, { autoPan: true });
      marker.on('popupopen', (e) => {
        // 绑定特征名点击事件
        setTimeout(() => {
          const popup = e.popup.getElement();
          if (popup) {
            // 绑定特征名点击事件
            popup.querySelectorAll('[data-feature]').forEach(el => {
              const fid = el.getAttribute('data-feature');
              
              el.onclick = (evt) => {
                if (fid) showFeatureInfo(fid);
              };
              el.ondblclick = (evt) => {
                evt.preventDefault();
                if (fid && window.explainFeature) {
                  const featureInfo = featureDescriptions[fid];
                  let database = 'Unknown';
                  if (fid.startsWith('GB')) database = 'Grambank';
                  else if (fid.startsWith('EA') || fid.includes('Richness')) database = 'D-PLACE';
                  else database = 'WALS';
                  
                  const feature = {
                    id: fid,
                    name: featureInfo?.name || fid,
                    description: featureInfo?.description || `Feature ${fid} from map view`,
                    database: database,
                    type: 'map_feature'
                  };
                  window.explainFeature(feature);
                }
              };
              el.title = `${el.title || fid}\n\n点击查看详情，双击获取AI解释`;
            });

            // 绑定语言讲解按钮点击事件
            const explainBtn = popup.querySelector('#explain-language-btn');
            if (explainBtn) {
              explainBtn.onclick = () => {
                // 发送语言信息给chatbox
                sendLanguageToChat(lang, featureData);
              };
            }
          }
        }, 100);
      });

      return marker;
    }
    
    // 多个特征时显示饼图
    const total = featureData.reduce((sum, f) => sum + f.weight, 0) || 1;
    let startAngle = 0;
    
    const paths = featureData.map(f => {
      const angle = (f.weight / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      
      // 极坐标转笛卡尔
      const x1 = svgSize/2 + radius * Math.cos(startAngle - Math.PI/2);
      const y1 = svgSize/2 + radius * Math.sin(startAngle - Math.PI/2);
      const x2 = svgSize/2 + radius * Math.cos(endAngle - Math.PI/2);
      const y2 = svgSize/2 + radius * Math.sin(endAngle - Math.PI/2);
      
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = [
        `M${svgSize/2},${svgSize/2}`,
        `L${x1},${y1}`,
        `A${radius},${radius},0,${largeArc},1,${x2},${y2}`,
        'Z'
      ].join(' ');
      
      const color = getPetalColor(f.feature, f.value);
      const strokeColor = f.value === null || f.value === undefined ? 'rgba(200, 200, 200, 0.3)' : '#fff';
      const strokeWidth = f.value === null || f.value === undefined ? '0.5' : '0.5';
      
      const path = `<path d="${d}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
      startAngle = endAngle;
      return path;
    });

    // SVG 图标
    const highlightClass = isTreeHighlighted ? 'tree-highlighted' : (isDorecoHighlighted ? 'doreco-highlighted' : '');
    
    // 生成多层边框圆（每个匹配的分类特征一层）
    const borderCircles = (matchedCategoricalFeatures && matchedCategoricalFeatures.length > 0)
      ? matchedCategoricalFeatures.map((featureId, idx) => {
          const borderColor = getFeatureColor(featureId);
          const borderRadius = radius + 1.5 + (idx * 2); // 每层间隔2px
          return `<circle cx="${svgSize/2}" cy="${svgSize/2}" r="${borderRadius}" fill="none" stroke="${borderColor}" stroke-width="2" opacity="0.8" />`;
        }).join('')
      : '';
    
    const svg = `
      <svg width="${svgSize}" height="${svgSize}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">
        <g class="${highlightClass}">
          ${paths.join('')}
          ${borderCircles}
        </g>
      </svg>
    `;

    // 创建标记
    const marker = L.marker([lang.Latitude, lang.Longitude], {
      icon: L.divIcon({
        html: svg,
        className: `custom-icon${highlightClass ? ` ${highlightClass}` : ''}`,
        iconSize: [svgSize, svgSize],
        iconAnchor: [svgSize/2, svgSize/2]
      })
    }).addTo(mapInstanceRef.current);

    marker.bindPopup(popupContent, { autoPan: true });
    marker.on('popupopen', (e) => {
      // 绑定特征名点击事件
      setTimeout(() => {
        const popup = e.popup.getElement();
        if (popup) {
          // 绑定特征名点击事件
          popup.querySelectorAll('[data-feature]').forEach(el => {
            const fid = el.getAttribute('data-feature');
            
            el.onclick = (evt) => {
              if (fid) showFeatureInfo(fid);
            };
            el.ondblclick = (evt) => {
              evt.preventDefault();
              if (fid && window.explainFeature) {
                const featureInfo = featureDescriptions[fid];
                let database = 'Unknown';
                if (fid.startsWith('GB')) database = 'Grambank';
                else if (fid.startsWith('EA') || fid.includes('Richness')) database = 'D-PLACE';
                else database = 'WALS';
                
                const feature = {
                  id: fid,
                  name: featureInfo?.name || fid,
                  description: featureInfo?.description || `Feature ${fid} from map view`,
                  database: database,
                  type: 'map_feature'
                };
                window.explainFeature(feature);
              }
            };
            el.title = `${el.title || fid}\n\n点击查看详情，双击获取AI解释`;
          });

          // 绑定语言讲解按钮点击事件
          const explainBtn = popup.querySelector('#explain-language-btn');
          if (explainBtn) {
            explainBtn.onclick = () => {
              // 发送语言信息给chatbox
              sendLanguageToChat(lang, featureData);
            };
          }
        }
      }, 100);
    });

    return marker;
  };

  // 发送语言信息给chatbox的函数
  const sendLanguageToChat = (lang, featureData) => {
    if (window.explainLanguage) {
      // 构造语言信息对象
      const languageInfo = {
        id: lang.Language_ID,
        name: lang.Name,
        family: getFamilyName(lang.Family_level_ID, familyMappingRef.current),
        region: lang.region,
        macroarea: lang.Macroarea,
        features: featureData.map(f => ({
          id: f.feature,
          value: lang[f.feature],
          weight: f.weight,
          isOrange: f.isOrange
        })),
        coordinates: {
          latitude: lang.Latitude,
          longitude: lang.Longitude
        }
      };
      
      window.explainLanguage(languageInfo);
    } else {
      console.warn('window.explainLanguage function not found');
    }
  };

  // 自动缩放到高亮语言区域
  const zoomToHighlightedLanguages = () => {
    if (!mapInstanceRef.current || highlightedLanguages.length === 0) return;

    // 找到所有高亮语言的坐标
    const highlightedCoords = languageData
      .filter(lang => highlightedLanguages.includes(lang.Name))
      .map(lang => [lang.Latitude, lang.Longitude])
      .filter(coord => coord[0] && coord[1]);

    if (highlightedCoords.length === 0) return;

    if (highlightedCoords.length === 1) {
      // 单个语言，缩放到该点
      mapInstanceRef.current.setView(highlightedCoords[0], 8);
    } else {
      // 多个语言，创建边界并缩放到包含所有语言的区域
      const bounds = L.latLngBounds(highlightedCoords);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [20, 20], // 添加一些内边距
        maxZoom: 10 // 限制最大缩放级别
      });
    }
  };

  // 初始化地图
  useEffect(() => {
    // 确保 DOM 元素存在
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.warn('Map container not found');
      return;
    }

    // 如果地图实例已存在，先清理
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 创建新的地图实例
    try {
      mapInstanceRef.current = L.map('map').setView([10, 0], 2);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(mapInstanceRef.current);

      // 确保地图正确渲染
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // 清理函数
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (error) {
          console.warn('Error removing map:', error);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []); // 只在组件挂载时运行一次

  // 缩放时重新渲染标记（修复圆的大小缩放问题）
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleZoom = () => {
      const newZoom = mapInstanceRef.current.getZoom();
      if (newZoom !== currentZoomRef.current) {
        currentZoomRef.current = newZoom;
        // 重新渲染所有标记
        renderMarkers();
      }
    };

    mapInstanceRef.current.on('zoomend', handleZoom);
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('zoomend', handleZoom);
      }
    };
  }, [filteredLanguageData, selectedGBFeatures, selectedEAFeatures, selectedWALSFeatures, gbWeights, eaWeights, walsWeights, highlightedLanguages, dorecoHighlightedLanguages, categoricalFilters]);

  // 渲染标记的函数
  const renderMarkers = () => {
    if (!mapInstanceRef.current || loading || !filteredLanguageData || filteredLanguageData.length === 0) {
      return;
    }

    // 清除旧标记
    markersRef.current.forEach(marker => {
      try {
        if (marker && marker.remove) {
          marker.remove();
        }
      } catch (error) {
        console.warn('Error removing marker:', error);
      }
    });
    markersRef.current = [];

    // 选中特征
    const allGB = selectedGBFeatures.length > 0 ? selectedGBFeatures : [...gbFeatures, ...gbOrangeFeatures];
    const allEA = selectedEAFeatures;

    let totalLanguages = 0;
    let filteredLanguages = 0;
    let displayedLanguages = 0;

    filteredLanguageData.forEach(lang => {
      if (!lang.Latitude || !lang.Longitude) return;

      totalLanguages++;

      try {
        // 检查EA特征：如果任何选中的EA特征是NA，则跳过这个语言点
        if (allEA.length > 0) {
          const allEaFeaturesValid = allEA.every(feature => {
            const value = lang[feature];
            return value !== 'NA' && value !== null && value !== undefined && value !== '';
          });
          
          // 如果任何EA特征是NA，跳过这个语言点
          if (!allEaFeaturesValid) {
            filteredLanguages++;
            return; // 跳过，不显示圆圈
          }
        }

        // 计算大小值（EA特征加权平均）- 按照gender_analysis.html的方式
        let sizeValue = 0, totalWeight = 0;
        allEA.forEach(f => {
          const w = parseFloat(eaWeights[f] || 1);
          const v = lang[f];
          if (v !== null && !isNaN(v) && v !== 'NA') {
            sizeValue += v * w;
            totalWeight += w;
          }
        });
        sizeValue = totalWeight > 0 ? sizeValue / totalWeight : 0;

        // 构造饼图数据
        const featureData = allGB.map(feature => {
          const w = parseFloat(gbWeights[feature] || 1);
          return {
            feature,
            value: lang[feature],
            isOrange: gbOrangeFeatures.includes(feature),
            weight: w > 0 ? w : 0
          };
        }).filter(f => f.weight > 0);

        // 检查是否高亮
        const isTreeHighlighted = highlightedLanguages.includes(lang.Name);
        const isDorecoHighlighted = dorecoHighlightedLanguages.includes(lang.Name);

        // 检查是否匹配分类筛选
        const matchedCategoricalFeatures = [];
        if (categoricalFilters && Object.keys(categoricalFilters).length > 0) {
          Object.entries(categoricalFilters).forEach(([featureId, selectedCategories]) => {
            if (selectedCategories && selectedCategories.length > 0) {
              const langValue = lang[featureId];
              // 检查语言的特征值是否在选中的类别中
              if (langValue && selectedCategories.includes(`${featureId}-${langValue}`)) {
                matchedCategoricalFeatures.push(featureId);
              }
            }
          });
        }

        // 创建标记
        const marker = createMarker(lang, sizeValue, featureData, isTreeHighlighted, isDorecoHighlighted, matchedCategoricalFeatures);
        markersRef.current.push(marker);
        
        displayedLanguages++;

      } catch (error) {
        console.warn('Error creating marker for language:', lang.Name, error);
      }
    });
  };

  // 渲染标记
  useEffect(() => {
    renderMarkers();
  }, [languageData, loading, selectedGBFeatures, selectedEAFeatures, selectedWALSFeatures, gbWeights, eaWeights, walsWeights, showFeatureInfo, highlightedLanguages, dorecoHighlightedLanguages, categoricalFilters]);

  // 监听高亮语言变化，自动缩放到高亮区域
  useEffect(() => {
    if (highlightedLanguages.length > 0) {
      // 延迟执行，确保标记已经渲染完成
      setTimeout(() => {
        zoomToHighlightedLanguages();
      }, 100);
    }
  }, [highlightedLanguages]);

  return (
    <div id="map" style={{ height: '100%', width: '100%' }}></div>
  );
};

export default MapView; 