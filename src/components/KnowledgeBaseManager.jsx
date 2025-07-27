import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { 
  initKnowledgeBase, 
  getKnowledgeBaseInfo, 
  addDocumentsBatch, 
  clearKnowledgeBase,
  checkKnowledgeBaseStatus 
} from '../utils/knowledgeBaseUtils';

const KnowledgeBaseManager = () => {
  const { lang, langs } = useContext(DataContext);
  const [isLoading, setIsLoading] = useState(false);
  const [kbInfo, setKbInfo] = useState(null);
  const [status, setStatus] = useState('unknown');
  const [message, setMessage] = useState('');

  // 检查知识库状态
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const isAvailable = await checkKnowledgeBaseStatus();
      setStatus(isAvailable ? 'available' : 'unavailable');
      
      if (isAvailable) {
        const info = await getKnowledgeBaseInfo();
        setKbInfo(info);
      }
    } catch (error) {
      setStatus('error');
      console.error('检查知识库状态失败:', error);
    }
  };

  const handleInit = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const openaiApiKey = localStorage.getItem('GEMINI_API_KEY');
      await initKnowledgeBase(openaiApiKey);
      setMessage(lang === 'zh' ? '知识库初始化成功！' : 'Knowledge base initialized successfully!');
      await checkStatus();
    } catch (error) {
      setMessage(lang === 'zh' ? `初始化失败: ${error.message}` : `Initialization failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDocuments = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await addDocumentsBatch();
      setMessage(lang === 'zh' ? '批量文档处理已启动，请稍后查看结果' : 'Batch document processing started, please check results later');
      await checkStatus();
    } catch (error) {
      setMessage(lang === 'zh' ? `批量添加失败: ${error.message}` : `Batch addition failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm(lang === 'zh' ? '确定要清空知识库吗？此操作不可撤销。' : 'Are you sure you want to clear the knowledge base? This action cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    
    try {
      await clearKnowledgeBase();
      setMessage(lang === 'zh' ? '知识库已清空' : 'Knowledge base cleared');
      await checkStatus();
    } catch (error) {
      setMessage(lang === 'zh' ? `清空失败: ${error.message}` : `Clear failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'available': return '#4CAF50';
      case 'unavailable': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'available': return lang === 'zh' ? '可用' : 'Available';
      case 'unavailable': return lang === 'zh' ? '不可用' : 'Unavailable';
      case 'error': return lang === 'zh' ? '错误' : 'Error';
      default: return lang === 'zh' ? '未知' : 'Unknown';
    }
  };

  return (
    <div className="knowledge-base-manager" style={{
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0', 
        color: '#2c7c6c',
        fontSize: '16px',
        fontWeight: 'bold'
      }}>
        📚 {lang === 'zh' ? '知识库管理' : 'Knowledge Base Manager'}
      </h3>

      {/* 状态显示 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '16px',
        padding: '8px 12px',
        background: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: getStatusColor(),
          marginRight: '8px'
        }} />
        <span style={{ fontSize: '12px', color: '#666' }}>
          {lang === 'zh' ? '状态' : 'Status'}: {getStatusText()}
        </span>
      </div>

      {/* 知识库信息 */}
      {kbInfo && (
        <div style={{ 
          marginBottom: '16px',
          padding: '8px 12px',
          background: '#f0f8ff',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div><strong>{lang === 'zh' ? '总文档数' : 'Total Documents'}:</strong> {kbInfo.total_documents}</div>
          <div><strong>{lang === 'zh' ? '集合名称' : 'Collection'}:</strong> {kbInfo.collection_name}</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleInit}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            background: '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? (lang === 'zh' ? '处理中...' : 'Processing...') : (lang === 'zh' ? '初始化' : 'Initialize')}
        </button>

        <button
          onClick={handleAddDocuments}
          disabled={isLoading || status !== 'available'}
          style={{
            padding: '6px 12px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isLoading || status !== 'available') ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: (isLoading || status !== 'available') ? 0.6 : 1
          }}
        >
          {isLoading ? (lang === 'zh' ? '处理中...' : 'Processing...') : (lang === 'zh' ? '添加文档' : 'Add Documents')}
        </button>

        <button
          onClick={handleClear}
          disabled={isLoading || status !== 'available'}
          style={{
            padding: '6px 12px',
            background: '#F44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isLoading || status !== 'available') ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: (isLoading || status !== 'available') ? 0.6 : 1
          }}
        >
          {isLoading ? (lang === 'zh' ? '处理中...' : 'Processing...') : (lang === 'zh' ? '清空' : 'Clear')}
        </button>

        <button
          onClick={checkStatus}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            background: '#9E9E9E',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {lang === 'zh' ? '刷新' : 'Refresh'}
        </button>
      </div>

      {/* 消息显示 */}
      {message && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: message.includes('失败') || message.includes('failed') ? '#ffebee' : '#e8f5e8',
          color: message.includes('失败') || message.includes('failed') ? '#c62828' : '#2e7d32',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          {message}
        </div>
      )}

      {/* 说明 */}
      <div style={{
        marginTop: '12px',
        fontSize: '10px',
        color: '#666',
        lineHeight: '1.4'
      }}>
        <div><strong>{lang === 'zh' ? '功能说明' : 'Features'}:</strong></div>
        <div>• {lang === 'zh' ? '初始化：设置向量数据库和embedding模型' : 'Initialize: Set up vector database and embedding model'}</div>
        <div>• {lang === 'zh' ? '添加文档：批量处理public目录下的PDF和CSV文件' : 'Add Documents: Batch process PDF and CSV files in public directory'}</div>
        <div>• {lang === 'zh' ? '清空：删除所有已存储的文档' : 'Clear: Delete all stored documents'}</div>
        <div>• {lang === 'zh' ? 'AI回答时会自动检索相关知识库内容' : 'AI responses will automatically retrieve relevant knowledge base content'}</div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager; 