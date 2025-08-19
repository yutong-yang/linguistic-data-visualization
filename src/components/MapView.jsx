import React, { useEffect, useRef, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { gbFeatures, gbOrangeFeatures } from '../utils/featureData';

const MapView = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const { languageData, loading, selectedGBFeatures, selectedEAFeatures, gbWeights, eaWeights, showFeatureInfo, highlightedLanguages, featureDescriptions } = useContext(DataContext);
  const markersRef = useRef([]);
  const currentZoomRef = useRef(2);

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

  // 创建标记的函数
  const createMarker = (lang, sizeValue, featureData, isHighlighted) => {
    // 地图缩放自适应 - 按照gender_analysis.html的方式
    const zoom = mapInstanceRef.current.getZoom();
    currentZoomRef.current = zoom;
    const zoomFactor = Math.max(0.7, Math.min(2, zoom / 3));
    const baseRadius = Math.max(8, Math.min(14, 8 + sizeValue * 0.5));
    const radius = baseRadius * zoomFactor;
    const svgSize = Math.ceil(radius * 2.2);

    // 弹窗内容，特征名可点击
    const popupContent = `
      <b>${lang.Name || lang.Language_ID}</b><br/>
      Language ID: ${lang.Language_ID}<br/>
      Size Value: ${sizeValue.toFixed(2)}<br/>
      ${featureData.map(f =>
        `<span style='cursor:pointer;color:#2c7c6c;text-decoration:underline' data-feature='${f.feature}'>${f.feature}</span>: ${lang[f.feature] !== undefined ? lang[f.feature] : 'N/A'}<br/>`
      ).join('')}
    `;

    if (featureData.length === 1) {
      // 单个特征时显示完整圆形
      const f = featureData[0];
      const color = getPetalColor(f.feature, f.value);
      const strokeColor = f.value === null || f.value === undefined ? 'rgba(200, 200, 200, 0.3)' : '#fff';
      const strokeWidth = f.value === null || f.value === undefined ? '0.5' : '0.5';
      
      const svg = `
        <svg width="${svgSize}" height="${svgSize}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">
          <g class="${isHighlighted ? 'highlighted' : ''}">
            <circle cx="${svgSize/2}" cy="${svgSize/2}" r="${radius}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
          </g>
        </svg>
      `;
      
      // 创建标记
      const marker = L.marker([lang.Latitude, lang.Longitude], {
        icon: L.divIcon({
          html: svg,
          className: `custom-icon${isHighlighted ? ' highlighted' : ''}`,
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
            popup.querySelectorAll('[data-feature]').forEach(el => {
              const fid = el.getAttribute('data-feature');
              
              el.onclick = (evt) => {
                if (fid) showFeatureInfo(fid);
              };
              el.ondblclick = (evt) => {
                evt.preventDefault();
                if (fid && window.explainFeature) {
                  const featureInfo = featureDescriptions[fid];
                  const feature = {
                    id: fid,
                    name: featureInfo?.name || fid,
                    description: featureInfo?.description || `Feature ${fid} from map view`,
                    database: fid.startsWith('GB') ? 'Grambank' : 'D-PLACE',
                    type: 'map_feature'
                  };
                  window.explainFeature(feature);
                }
              };
              el.title = `${el.title || fid}\n\n点击查看详情，双击获取AI解释`;
            });
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
    const svg = `
      <svg width="${svgSize}" height="${svgSize}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">
        <g class="${isHighlighted ? 'highlighted' : ''}">${paths.join('')}</g>
      </svg>
    `;

    // 创建标记
    const marker = L.marker([lang.Latitude, lang.Longitude], {
      icon: L.divIcon({
        html: svg,
        className: `custom-icon${isHighlighted ? ' highlighted' : ''}`,
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
          popup.querySelectorAll('[data-feature]').forEach(el => {
            const fid = el.getAttribute('data-feature');
            
            el.onclick = (evt) => {
              if (fid) showFeatureInfo(fid);
            };
            el.ondblclick = (evt) => {
              evt.preventDefault();
              if (fid && window.explainFeature) {
                const featureInfo = featureDescriptions[fid];
                const feature = {
                  id: fid,
                  name: featureInfo?.name || fid,
                  description: featureInfo?.description || `Feature ${fid} from map view`,
                  database: fid.startsWith('GB') ? 'Grambank' : 'D-PLACE',
                  type: 'map_feature'
                };
                window.explainFeature(feature);
              }
            };
            el.title = `${el.title || fid}\n\n点击查看详情，双击获取AI解释`;
          });
        }
      }, 100);
    });

    return marker;
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
  }, [languageData, selectedGBFeatures, selectedEAFeatures, gbWeights, eaWeights, highlightedLanguages]);

  // 渲染标记的函数
  const renderMarkers = () => {
    if (!mapInstanceRef.current || loading || !languageData || languageData.length === 0) {
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

    languageData.forEach(lang => {
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
            // 调试信息：显示被过滤掉的语言点
            if (highlightedLanguages.includes(lang.Name)) {
              console.log(`Filtered out ${lang.Name} - some EA features are NA:`, 
                allEA.map(f => ({ feature: f, value: lang[f], isValid: lang[f] !== 'NA' && lang[f] !== null && lang[f] !== undefined && lang[f] !== '' }))
              );
            }
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

        // 调试信息：显示EA特征计算过程
        if (allEA.length > 0 && highlightedLanguages.includes(lang.Name)) {
          console.log(`EA Features calculation for ${lang.Name}:`, {
            selectedEAFeatures: allEA,
            eaWeights: eaWeights,
            featureValues: allEA.map(f => ({ feature: f, value: lang[f], weight: eaWeights[f] || 1 })),
            finalSizeValue: sizeValue
          });
        }

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
        const isHighlighted = highlightedLanguages.includes(lang.Name);
        
        // 调试信息
        if (highlightedLanguages.length > 0) {
          console.log('Checking highlight for:', lang.Name, 'Highlighted languages:', highlightedLanguages, 'Is highlighted:', isHighlighted);
        }

        // 创建标记
        const marker = createMarker(lang, sizeValue, featureData, isHighlighted);
        markersRef.current.push(marker);
        
        displayedLanguages++;

      } catch (error) {
        console.warn('Error creating marker for language:', lang.Name, error);
      }
    });

    // 显示过滤统计信息
    if (allEA.length > 0) {
      console.log(`EA Features filtering: ${totalLanguages} total languages, ${filteredLanguages} filtered out (some NA), ${displayedLanguages} displayed`);
    }
  };

  // 渲染标记
  useEffect(() => {
    renderMarkers();
  }, [languageData, loading, selectedGBFeatures, selectedEAFeatures, gbWeights, eaWeights, showFeatureInfo, highlightedLanguages]);

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
    <div className="right-panel">
      <div id="map" style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

export default MapView; 