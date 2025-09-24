import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { 
  initKnowledgeBase, 
  getKnowledgeBaseInfo, 
  addDocumentsBatch, 
  clearKnowledgeBase,
  checkKnowledgeBaseStatus,
  getSystemStatus,
  cancelCurrentTask,
  getTaskStatus
} from '../utils/knowledgeBaseUtils';
import PaperUpload from './PaperUpload';

const KnowledgeBaseManager = () => {
  const { lang, langs } = useContext(DataContext);
  const [isLoading, setIsLoading] = useState(false);
  const [kbInfo, setKbInfo] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [status, setStatus] = useState('unknown');
  const [message, setMessage] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [taskStatus, setTaskStatus] = useState(null);
  const [taskId, setTaskId] = useState(null);

  // 检查知识库状态
  useEffect(() => {
    checkStatus();
  }, []);

  // 定期检查任务状态
  useEffect(() => {
    let interval;
    if (taskId && taskStatus?.status === 'running') {
      interval = setInterval(async () => {
        try {
          const status = await getTaskStatus();
          setTaskStatus(status);
          
          // 任务完成后的处理
          if (status.status !== 'running') {
            // 任务完成，清理任务状态
            setTaskStatus(null);
            setTaskId(null);
            
            // 自动刷新知识库状态
            await checkStatus();
            
            // 根据任务结果设置消息
            if (status.status === 'completed') {
              setMessage(lang === 'zh' ? '批量处理完成' : 'Batch processing completed');
            } else if (status.status === 'cancelled') {
              setMessage(lang === 'zh' ? '任务已取消' : 'Task cancelled');
            } else if (status.status === 'error') {
              setMessage(lang === 'zh' ? `处理出错: ${status.message}` : `Processing error: ${status.message}`);
            }
            
            // 3秒后自动清除消息
            setTimeout(() => {
              setMessage('');
            }, 3000);
          }
        } catch (error) {
          console.error('检查任务状态失败:', error);
        }
      }, 2000); // 每2秒检查一次
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [taskId, taskStatus?.status, lang]);

  const checkStatus = async () => {
    try {
      console.log('开始检查知识库状态...');
      
      // 获取系统状态
      const status = await getSystemStatus();
      console.log('获取到的系统状态:', status);
      setSystemStatus(status);
      
      if (status.knowledge_base_initialized) {
        console.log('知识库已初始化，状态设为 available');
        setStatus('available');
        // 获取详细知识库信息
        try {
          const info = await getKnowledgeBaseInfo();
          console.log('获取到的知识库信息:', info);
          setKbInfo(info);
        } catch (error) {
          console.error('获取知识库信息失败:', error);
          // 即使获取详细信息失败，也设置基本信息
          setKbInfo({
            total_documents: 0,
            collection_name: 'unknown',
            embedding_method: 'unknown'
          });
        }
      } else {
        console.log('知识库未初始化，状态设为 unavailable');
        setStatus('unavailable');
        // 清空知识库信息
        setKbInfo(null);
      }
    } catch (error) {
      console.error('检查知识库状态失败:', error);
      console.error('错误详情:', error.message, error.stack);
      setStatus('error');
      setMessage(`状态检查失败: ${error.message}`);
      // 清空状态信息
      setSystemStatus(null);
      setKbInfo(null);
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
      if (result.status === 'processing') {
        setTaskId(result.task_id);
        setTaskStatus({
          status: 'running',
          message: result.message,
          task_id: result.task_id
        });
        setMessage(lang === 'zh' ? '批量处理已启动' : 'Batch processing started');
      } else {
        setMessage(result.message || '操作失败');
      }
    } catch (error) {
      setMessage(lang === 'zh' ? `批量添加失败: ${error.message}` : `Batch addition failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTask = async () => {
    if (!confirm(lang === 'zh' ? '确定要取消当前任务吗？' : 'Are you sure you want to cancel the current task?')) {
      return;
    }
    
    try {
      const result = await cancelCurrentTask();
      if (result.status === 'success') {
        setMessage(lang === 'zh' ? '任务已取消' : 'Task cancelled');
        setTaskStatus(null);
        setTaskId(null);
        await checkStatus();
      } else {
        setMessage(result.message || '取消任务失败');
      }
    } catch (error) {
      setMessage(lang === 'zh' ? `取消任务失败: ${error.message}` : `Failed to cancel task: ${error.message}`);
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

  const getTaskStatusText = () => {
    if (!taskStatus) return '';
    
    switch (taskStatus.status) {
      case 'running': return lang === 'zh' ? '运行中' : 'Running';
      case 'completed': return lang === 'zh' ? '已完成' : 'Completed';
      case 'cancelled': return lang === 'zh' ? '已取消' : 'Cancelled';
      case 'error': return lang === 'zh' ? '出错' : 'Error';
      case 'idle': return lang === 'zh' ? '空闲' : 'Idle';
      default: return taskStatus.status;
    }
  };

  const getTaskStatusColor = () => {
    if (!taskStatus) return '#9E9E9E';
    
    switch (taskStatus.status) {
      case 'running': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#FF9800';
      case 'error': return '#F44336';
      case 'idle': return '#9E9E9E';
      default: return '#9E9E9E';
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
      <h3 style={{ margin: '0 0 12px 0', color: '#2c7c6c', fontSize: '15px', fontWeight: 'bold' }}>
        📚 {lang === 'zh' ? '知识库管理' : 'Knowledge Base'}
      </h3>

      {/* 统一状态显示区域 */}
      <div style={{ 
        marginBottom: '12px',
        padding: '10px',
        background: '#f8f9fa',
        borderRadius: '6px',
        border: '1px solid #e9ecef'
      }}>
        {/* 知识库状态 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '10px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getStatusColor(),
            marginRight: '8px'
          }} />
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#495057' }}>
            {lang === 'zh' ? '知识库状态' : 'KB Status'}: {getStatusText()}
          </span>
        </div>

        {/* 任务状态 - 只在有任务时显示 */}
        {taskStatus && taskStatus.status === 'running' && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '10px',
            padding: '6px',
            background: '#e3f2fd',
            borderRadius: '4px',
            border: '1px solid #bbdefb'
          }}>
            <div style={{ fontSize: '11px', color: '#1976d2' }}>
              <strong>{lang === 'zh' ? '任务状态' : 'Task'}:</strong> 
              <span style={{ 
                color: getTaskStatusColor(),
                marginLeft: '6px',
                fontWeight: '500'
              }}>
                {getTaskStatusText()}
              </span>
            </div>
            <button
              onClick={handleCancelTask}
              style={{
                padding: '3px 6px',
                background: '#F44336',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: '500'
              }}
            >
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
          </div>
        )}

        {/* 统计信息 */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px',
          fontSize: '11px'
        }}>
          {kbInfo && (
            <div style={{ 
              padding: '6px',
              background: '#e8f5e8',
              borderRadius: '4px',
              border: '1px solid #c8e6c9'
            }}>
              <div style={{ fontWeight: '600', color: '#2e7d32', marginBottom: '2px' }}>
                {lang === 'zh' ? '文档块数量' : 'Document Chunks'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1b5e20' }}>
                {kbInfo.total_documents}
              </div>
            </div>
          )}
          
          {systemStatus && systemStatus.total_files_in_repository !== undefined && (
            <div style={{ 
              padding: '6px',
              background: '#fff3e0',
              borderRadius: '4px',
              border: '1px solid #ffcc02'
            }}>
              <div style={{ fontWeight: '600', color: '#f57c00', marginBottom: '2px' }}>
                {lang === 'zh' ? '可用PDF文件' : 'Available PDF Files'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e65100' }}>
                {systemStatus.total_files_in_repository}
              </div>
            </div>
          )}
        </div>

        {/* 任务消息 - 只在有任务时显示 */}
        {taskStatus && taskStatus.status === 'running' && (
          <div style={{ 
            marginTop: '8px',
            padding: '6px',
            background: '#e8f5e8',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#2e7d32'
          }}>
            {lang === 'zh' ? '正在处理文档...' : 'Processing documents...'}
          </div>
        )}
      </div>

      {/* 操作按钮区域 */}
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        flexWrap: 'wrap', 
        marginBottom: '12px' 
      }}>
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
            fontWeight: '500',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? (lang === 'zh' ? '处理中...' : 'Processing...') : (lang === 'zh' ? '初始化' : 'Initialize')}
        </button>

        <button
          onClick={handleAddDocuments}
          disabled={isLoading || status !== 'available' || (taskStatus && taskStatus.status === 'running')}
          style={{
            padding: '6px 12px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isLoading || status !== 'available' || (taskStatus && taskStatus.status === 'running')) ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            opacity: (isLoading || status !== 'available' || (taskStatus && taskStatus.status === 'running')) ? 0.6 : 1
          }}
        >
          {isLoading ? (lang === 'zh' ? '处理中...' : 'Processing...') : (lang === 'zh' ? '添加文档' : 'Add Documents')}
        </button>

        <button
          onClick={() => setShowUpload(!showUpload)}
          disabled={isLoading || status !== 'available'}
          style={{
            padding: '6px 12px',
            background: showUpload ? '#FF9800' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isLoading || status !== 'available') ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            opacity: (isLoading || status !== 'available') ? 0.6 : 1
          }}
        >
          {showUpload ? 
            (lang === 'zh' ? '隐藏上传' : 'Hide Upload') : 
            (lang === 'zh' ? '论文上传' : 'Paper Upload')
          }
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
            fontWeight: '500',
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
            fontWeight: '500',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {lang === 'zh' ? '刷新状态' : 'Refresh'}
        </button>
      </div>

      {/* 论文上传组件 */}
      {showUpload && status === 'available' && (
        <div style={{ marginBottom: '12px' }}>
          <PaperUpload onUploadSuccess={checkStatus} />
        </div>
      )}

      {/* 消息显示 */}
      {message && (
        <div style={{
          marginTop: '8px',
          padding: '8px 10px',
          background: message.includes('失败') || message.includes('failed') ? '#ffebee' : '#e8f5e8',
          color: message.includes('失败') || message.includes('failed') ? '#c62828' : '#2e7d32',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseManager; 