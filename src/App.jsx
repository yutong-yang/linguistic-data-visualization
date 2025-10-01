import React, { useState, useContext } from 'react';
import './assets/style.css';
import FeatureWorkbench from './components/FeatureWorkbench';
import CorrelationAnalysis from './components/CorrelationAnalysis';
import PhyloTree from './components/PhyloTree';
import LanguageFilter from './components/LanguageFilter';
import ChatWidget from './components/ChatWidget';
import FeatureInfoModal from './components/FeatureInfoModal';
import ApiKeyModal from './components/ApiKeyModal';
import MapView from './components/MapView';
import DataModeToggle from './components/DataModeToggle';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import FeatureRecommendation from './components/FeatureRecommendation';
import { DataProvider, DataContext } from './context/DataContext';
import { loadAndParseTree, renderD3Tree } from './utils/treeUtils';

function AppInner() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('map'); // map | correlation
  const [showTreeOverlay, setShowTreeOverlay] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const { lang, setLang, languageFilter, setLanguageFilter } = useContext(DataContext);

  const handleApiKeySet = () => {
    console.log('API Key has been set successfully');
  };

  // 获取上下文数据
  const { languageMapping, setHighlightedLanguages } = useContext(DataContext);

  // 加载树到浮层容器
  const loadTreeToOverlay = async (selectedTree, container) => {
    try {
      // 清除容器
      container.innerHTML = '';
      
      // 加载并解析树文件
      const { treeData } = await loadAndParseTree(selectedTree);
      
      // 处理节点点击
      const handleNodeClick = (node, descendantLanguages) => {
        if (descendantLanguages.length > 0) {
          setHighlightedLanguages(descendantLanguages);
        } else {
          setHighlightedLanguages([]);
        }
      };
      
      // 渲染树到浮层容器
      renderD3Tree(treeData, container, handleNodeClick, languageMapping);
      
    } catch (error) {
      console.error('Error loading tree to overlay:', error);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Error loading tree</div>';
    }
  };

  return (
    <div className="app-root">
      {/* 顶部工具条 */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="app-title">{lang === 'zh' ? '语言学探索' : 'Linguistic Explorer'}</span>
        </div>
        <div className="topbar-center">
          {/* 预留：特征搜索/已选特征 Chips */}
        </div>
        <div className="topbar-right">
          <button
            id="kb-toggle"
            onClick={() => setShowKB(true)}
            className="lang-btn"
            style={{ marginRight: 8 }}
          >
            {lang === 'zh' ? '📚 知识库' : '📚 Knowledge Base'}
          </button>
          <button
            id="lang-toggle"
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="lang-btn"
          >
            中文/English
          </button>
        </div>
      </div>

      <div className="container">
        {/* 左侧面板：顶部为数据模式 + 动态特征选择 */}
        <div className="left-panel">
          <div className="combined-data-panel">
            <DataModeToggle />
          </div>
          <FeatureWorkbench />
        </div>

        {/* 中间主视图：标签页（地图 | 相关性） */}
        <div className="center-panel">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              {lang === 'zh' ? '地图' : 'Map'}
            </button>
            <button
              className={`tab-btn ${activeTab === 'correlation' ? 'active' : ''}`}
              onClick={() => setActiveTab('correlation')}
            >
              {lang === 'zh' ? '相关性' : 'Correlation'}
            </button>
          </div>
          <div className="tabs-content">
            {/* 始终挂载组件，仅切换显示，防止状态丢失 */}
        <div className="tab-panel map-tab" style={{ display: activeTab === 'map' ? 'block' : 'none', position: 'relative', height: '100%' }}>
          {/* 筛选器行 */}
          <div style={{ padding: 8, paddingBottom: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1001, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* 左侧：语言筛选器 */}
            <LanguageFilter />
            
            {/* 右侧：家族筛选器 */}
            <PhyloTree 
              controlOnly 
              onLoad={(selectedTree) => {
                setShowTreeOverlay(true);
                // 触发树数据加载到浮层
                setTimeout(() => {
                  const overlayContainer = document.getElementById('tree-overlay-container');
                  if (overlayContainer) {
                    // 重新渲染树到浮层容器
                    loadTreeToOverlay(selectedTree, overlayContainer);
                  }
                }, 100);
              }} 
            />
          </div>
              {/* 地图容器 */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <MapView />
                {/* 地图右上角树浮层 */}
                {showTreeOverlay && (
                  <div style={{
                    position: 'absolute',
                    top: 60,
                    right: 12,
                    width: 400,
                    height: 400,
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(233,236,239,0.5)',
                    borderRadius: 8,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: 1000,
                    pointerEvents: 'auto'
                  }}>
                    <div style={{ padding: 8, borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: '#2c7c6c' }}>{lang === 'zh' ? '系统发育树' : 'Phylogenetic Tree'}</span>
                      <button
                        onClick={() => setShowTreeOverlay(false)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#666' }}
                      >
                        ×
                      </button>
                    </div>
                    <div id="tree-overlay-container" style={{ padding: 8, height: 350, overflow: 'hidden' }}>
                      {/* 树将渲染到这里 */}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="tab-panel" style={{ display: activeTab === 'correlation' ? 'block' : 'none' }}>
              <CorrelationAnalysis />
            </div>
          </div>
        </div>

        {/* 聊天助手（浮动不变） */}
        <ChatWidget onShowApiKeyModal={() => setShowApiKeyModal(true)} />

        {/* 特征信息弹窗 */}
        <FeatureInfoModal />

        {/* API Key 设置弹窗 */}
        <ApiKeyModal
          isVisible={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
          onApiKeySet={handleApiKeySet}
        />
      </div>

      {/* 右侧抽屉：知识库 */}
      {showKB && (
        <div style={{
          position: 'fixed', top: 48, right: 0, bottom: 0, width: 420,
          background: 'rgba(255,255,255,0.98)', borderLeft: '1px solid #e9ecef',
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)', zIndex: 1200, overflow: 'auto'
        }}>
          <div style={{
            position: 'sticky', top: 0, background: 'rgba(255,255,255,0.98)',
            borderBottom: '1px solid #e9ecef', padding: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 'bold', color: '#2c7c6c' }}>
              {lang === 'zh' ? '📚 知识库' : '📚 Knowledge Base'}
            </span>
            <button onClick={() => setShowKB(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: 12 }}>
            <KnowledgeBaseManager />
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}

export default App;
