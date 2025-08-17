import React, { useState, useContext, useRef, useCallback } from 'react';
import { DataContext } from '../context/DataContext';

const PaperUpload = ({ onUploadSuccess }) => {
  const { lang, langs } = useContext(DataContext);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadData, setUploadData] = useState({
    title: '',
    authors: '',
    abstract: '',
    keywords: '',
    publication_date: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // 文件大小限制 (50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // 检查文件类型
      const allowedTypes = ['pdf', 'docx', 'txt'];
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        errors.push(`${file.name}: ${lang === 'zh' ? '不支持的文件类型' : 'Unsupported file type'}`);
        return;
      }

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ${lang === 'zh' ? '文件过大' : 'File too large'} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setMessage(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setMessage('');
      
      // 如果第一个文件没有标题，自动填充标题
      if (!uploadData.title && validFiles[0]) {
        const fileName = validFiles[0].name.replace(/\.[^/.]+$/, '');
        setUploadData(prev => ({ ...prev, title: fileName }));
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (previewFile && previewFile.index === index) {
      setPreviewFile(null);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    }
  }, [lang]);

  const handleInputChange = (field, value) => {
    setUploadData(prev => ({ ...prev, [field]: value }));
  };

  const previewFileContent = (file, index) => {
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewFile({
          name: file.name,
          content: e.target.result,
          type: 'text',
          index
        });
      };
      reader.readAsText(file);
    } else {
      setPreviewFile({
        name: file.name,
        content: null,
        type: file.type,
        index
      });
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setMessage(lang === 'zh' ? '请选择要上传的文件' : 'Please select files to upload');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setUploadProgress(0);

    try {
      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress((i / selectedFiles.length) * 100);

        try {
          const formData = new FormData();
          formData.append('file', file);
          
          // 添加元数据
          Object.keys(uploadData).forEach(key => {
            if (uploadData[key]) {
              formData.append(key, uploadData[key]);
            }
          });

          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/upload-paper`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Upload failed');
          }

          const result = await response.json();
          successCount++;
          results.push({
            filename: file.name,
            status: 'success',
            result: result,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          failCount++;
          results.push({
            filename: file.name,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      setUploadProgress(100);

      // 更新上传历史
      setUploadHistory(prev => [...results, ...prev].slice(0, 50));

      // 显示结果消息
      if (failCount === 0) {
        setMessage(lang === 'zh' ? 
          `所有文件上传成功！共 ${successCount} 个文件` : 
          `All files uploaded successfully! Total: ${successCount} files`
        );
        
        // 通知父组件刷新状态
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        setMessage(lang === 'zh' ? 
          `上传完成。成功: ${successCount}, 失败: ${failCount}` : 
          `Upload completed. Success: ${successCount}, Failed: ${failCount}`
        );
        
        // 即使有失败的文件，也通知父组件刷新状态（因为可能有成功的）
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
      
      // 重置表单
      setSelectedFiles([]);
      setUploadData({
        title: '',
        authors: '',
        abstract: '',
        keywords: '',
        publication_date: ''
      });
      
      // 重置文件输入
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      setMessage(lang === 'zh' ? 
        `上传失败: ${error.message}` : 
        `Upload failed: ${error.message}`
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return '📕';
      case 'docx': return '📘';
      case 'txt': return '📄';
      default: return '📄';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="paper-upload" style={{
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#2c7c6c',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          📝 {lang === 'zh' ? '论文上传' : 'Paper Upload'}
        </h3>
        
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            padding: '4px 8px',
            background: showHistory ? '#2c7c6c' : '#f0f0f0',
            color: showHistory ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          {showHistory ? 
            (lang === 'zh' ? '隐藏历史' : 'Hide History') : 
            (lang === 'zh' ? '上传历史' : 'Upload History')
          }
        </button>
      </div>

      {/* 上传历史 */}
      {showHistory && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#333' }}>
            {lang === 'zh' ? '最近上传记录' : 'Recent Upload History'}
          </h4>
          {uploadHistory.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
              {lang === 'zh' ? '暂无上传记录' : 'No upload history'}
            </div>
          ) : (
            uploadHistory.slice(0, 10).map((record, index) => (
              <div key={index} style={{
                padding: '6px',
                margin: '4px 0',
                background: record.status === 'success' ? '#e8f5e8' : '#ffebee',
                borderRadius: '4px',
                fontSize: '10px'
              }}>
                <div style={{ fontWeight: 'bold' }}>{record.filename}</div>
                <div style={{ color: record.status === 'success' ? '#2e7d32' : '#c62828' }}>
                  {record.status === 'success' ? 
                    (lang === 'zh' ? '成功' : 'Success') : 
                    (lang === 'zh' ? '失败' : 'Failed')
                  }
                </div>
                <div style={{ color: '#666', fontSize: '9px' }}>
                  {new Date(record.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 文件选择区域 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          {lang === 'zh' ? '选择论文文件' : 'Select Paper Files'}
        </label>
        
        <div
          ref={dropZoneRef}
          style={{
            border: `2px dashed ${dragActive ? '#2c7c6c' : '#ddd'}`,
            borderRadius: '6px',
            padding: '20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: dragActive ? '#f0f8ff' : '#fafafa'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          
          {selectedFiles.length > 0 ? (
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
              <div style={{ fontSize: '12px', color: '#2c7c6c', fontWeight: 'bold' }}>
                {lang === 'zh' ? `已选择 ${selectedFiles.length} 个文件` : `${selectedFiles.length} files selected`}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {lang === 'zh' ? '点击选择文件或拖拽到此处' : 'Click to select files or drag and drop here'}
              </div>
              <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                {lang === 'zh' ? '支持 PDF, DOCX, TXT 格式，最大50MB' : 'Supports PDF, DOCX, TXT formats, max 50MB'}
              </div>
            </div>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* 已选文件列表 */}
      {selectedFiles.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#333' }}>
            {lang === 'zh' ? '已选文件' : 'Selected Files'}
          </h4>
          {selectedFiles.map((file, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              margin: '4px 0',
              background: '#f8f9fa',
              borderRadius: '4px',
              fontSize: '11px'
            }}>
              <span style={{ marginRight: '8px' }}>{getFileIcon(file.name)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{file.name}</div>
                <div style={{ color: '#666', fontSize: '9px' }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
              <button
                onClick={() => previewFileContent(file, index)}
                style={{
                  padding: '2px 6px',
                  margin: '0 4px',
                  background: '#2c7c6c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '9px',
                  cursor: 'pointer'
                }}
              >
                {lang === 'zh' ? '预览' : 'Preview'}
              </button>
              <button
                onClick={() => removeFile(index)}
                style={{
                  padding: '2px 6px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '9px',
                  cursor: 'pointer'
                }}
              >
                {lang === 'zh' ? '删除' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 文件预览 */}
      {previewFile && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h4 style={{ margin: 0, fontSize: '12px', color: '#333' }}>
              {lang === 'zh' ? '文件预览' : 'File Preview'}: {previewFile.name}
            </h4>
            <button
              onClick={() => setPreviewFile(null)}
              style={{
                padding: '2px 6px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer'
              }}
            >
              {lang === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
          {previewFile.type === 'text' ? (
            <div style={{
              fontSize: '10px',
              color: '#333',
              whiteSpace: 'pre-wrap',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {previewFile.content}
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
              {lang === 'zh' ? '此文件类型不支持预览' : 'Preview not supported for this file type'}
            </div>
          )}
        </div>
      )}

      {/* 元数据输入 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {lang === 'zh' ? '论文标题' : 'Paper Title'} *
            </label>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={lang === 'zh' ? '输入论文标题' : 'Enter paper title'}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {lang === 'zh' ? '作者' : 'Authors'}
            </label>
            <input
              type="text"
              value={uploadData.authors}
              onChange={(e) => handleInputChange('authors', e.target.value)}
              placeholder={lang === 'zh' ? '作者1, 作者2' : 'Author1, Author2'}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            {lang === 'zh' ? '摘要' : 'Abstract'}
          </label>
          <textarea
            value={uploadData.abstract}
            onChange={(e) => handleInputChange('abstract', e.target.value)}
            placeholder={lang === 'zh' ? '输入论文摘要...' : 'Enter paper abstract...'}
            rows="3"
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '11px',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {lang === 'zh' ? '关键词' : 'Keywords'}
            </label>
            <input
              type="text"
              value={uploadData.keywords}
              onChange={(e) => handleInputChange('keywords', e.target.value)}
              placeholder={lang === 'zh' ? '关键词1, 关键词2' : 'Keyword1, Keyword2'}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {lang === 'zh' ? '发布日期' : 'Publication Date'}
            </label>
            <input
              type="date"
              value={uploadData.publication_date}
              onChange={(e) => handleInputChange('publication_date', e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 上传进度 */}
      {isUploading && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '11px',
            color: '#666'
          }}>
            <span>{lang === 'zh' ? '上传进度' : 'Upload Progress'}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#f0f0f0',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* 上传按钮 */}
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
        style={{
          width: '100%',
          padding: '10px',
          background: selectedFiles.length > 0 && !isUploading ? '#2c7c6c' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: selectedFiles.length > 0 && !isUploading ? 'pointer' : 'not-allowed',
          fontSize: '12px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease'
        }}
      >
        {isUploading ? 
          (lang === 'zh' ? '上传中...' : 'Uploading...') : 
          (lang === 'zh' ? `上传 ${selectedFiles.length} 个文件` : `Upload ${selectedFiles.length} Files`)
        }
      </button>

      {/* 消息显示 */}
      {message && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: message.includes('失败') || message.includes('failed') ? '#ffebee' : '#e8f5e8',
          color: message.includes('失败') || message.includes('failed') ? '#c62828' : '#2e7d32',
          borderRadius: '4px',
          fontSize: '11px',
          whiteSpace: 'pre-line'
        }}>
          {message}
        </div>
      )}

      {/* 功能说明 */}
      <div style={{
        marginTop: '12px',
        fontSize: '10px',
        color: '#666',
        lineHeight: '1.4'
      }}>
        <div><strong>{lang === 'zh' ? '功能说明' : 'Features'}:</strong></div>
        <div>• {lang === 'zh' ? '支持PDF、Word文档和文本文件上传' : 'Supports PDF, Word documents and text files'}</div>
        <div>• {lang === 'zh' ? '支持批量上传和拖拽上传' : 'Supports batch upload and drag & drop'}</div>
        <div>• {lang === 'zh' ? '自动提取文本内容并建立语义索引' : 'Automatically extracts text content and builds semantic index'}</div>
        <div>• {lang === 'zh' ? '支持论文元数据标注（标题、作者、摘要等）' : 'Supports paper metadata annotation (title, authors, abstract, etc.)'}</div>
        <div>• {lang === 'zh' ? '上传后可通过AI聊天助手查询论文内容' : 'After upload, you can query paper content through AI chat assistant'}</div>
      </div>
    </div>
  );
};

export default PaperUpload;
