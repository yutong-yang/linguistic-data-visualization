import React, { useState, useContext } from 'react';
import './assets/style.css';
import FeatureSelector from './components/FeatureSelector';
import CorrelationAnalysis from './components/CorrelationAnalysis';
import PhyloTree from './components/PhyloTree';
import ChatWidget from './components/ChatWidget';
import FeatureInfoModal from './components/FeatureInfoModal';
import ApiKeyModal from './components/ApiKeyModal';
import MapView from './components/MapView';
import MethodSuggestion from './components/MethodSuggestion';
import LinguisticKnowledgeBase from './components/LinguisticKnowledgeBase';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import FeatureRecommendation from './components/FeatureRecommendation';
import { DataProvider, DataContext } from './context/DataContext';

function AppInner() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const { lang, setLang, langs } = useContext(DataContext);

  const handleApiKeySet = () => {
    console.log('API Key has been set successfully');
  };

  return (
    <div className="container">
      {/* 语言切换按钮 */}
      <button
        id="lang-toggle"
        onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 2000,
          background: '#2c7c6c',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s'
        }}
      >
        中文/English
      </button>
      
      {/* 左侧面板 */}
      <div className="left-panel">
        <FeatureSelector />
        <CorrelationAnalysis />
        <KnowledgeBaseManager />
        <FeatureRecommendation />
        <LinguisticKnowledgeBase />
        <MethodSuggestion />
        <PhyloTree />
      </div>
      
      {/* 右侧地图面板 */}
      <MapView />
      
      {/* 聊天助手 */}
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
