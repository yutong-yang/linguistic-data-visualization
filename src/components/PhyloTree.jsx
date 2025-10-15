import React, { useState, useRef, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { treeFiles, loadAndParseTree, renderD3Tree } from '../utils/treeUtils';

const PhyloTree = ({ selectedTreeProp, autoLoad = false, controlOnly = false, onSelectChange, onLoad, hideTitle = false }) => {
  const { languageData, languageMapping, setHighlightedLanguages, lang, langs } = useContext(DataContext);
  const [selectedTree, setSelectedTree] = useState('');
  const [treeInfo, setTreeInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const treeContainerRef = useRef(null);
  const currentTreeRef = useRef(null);

  // 处理树节点点击
  const handleNodeClick = (node, descendantLanguages) => {
    
    if (descendantLanguages.length > 0) {
      setTreeInfo(`
        <strong>Selected Node:</strong> ${node.data.name || 'Internal node'}<br>
        <strong>Languages highlighted:</strong> ${descendantLanguages.length}<br>
        <strong>Languages:</strong> ${descendantLanguages.join(', ')}
      `);
      setHighlightedLanguages(descendantLanguages);
    } else {
      setTreeInfo('No matching languages found for this node.');
      setHighlightedLanguages([]);
    }
  };

  // 加载并显示树
  const loadAndDisplayTree = async () => {
    if (!selectedTree) {
      setTreeInfo('Select a tree file...');
      return;
    }

    setLoading(true);
    setError('');
    setTreeInfo('');

    try {
      // 加载并解析树文件
      const { treeData } = await loadAndParseTree(selectedTree);
      
      // 清除之前的可视化（仅当容器存在时）
      if (treeContainerRef.current) {
        treeContainerRef.current.innerHTML = '';
      }

      // 使用 D3.js 渲染树（controlOnly 模式下无容器，跳过渲染）
      try {
        if (treeContainerRef.current) {
          const tree = renderD3Tree(
            treeData, 
            treeContainerRef.current, 
            handleNodeClick, 
            languageMapping
          );
          currentTreeRef.current = tree;
        }

        // 计算统计信息（仅当已渲染出树时）
        if (currentTreeRef.current) {
          const tips = currentTreeRef.current.descendants().filter(d => !d.children || d.children.length === 0);
          const maxDepth = Math.max(...currentTreeRef.current.descendants().map(d => d.depth));

          setTreeInfo(`
            <strong>Tree Information:</strong><br>
            • File: ${selectedTree}<br>
            • Number of tips (languages): ${tips.length}<br>
            • Maximum depth: ${maxDepth}<br>
            • Tree type: Phylogenetic tree from D-PLACE database<br>
            • Visualization: D3.js tree layout<br>
            • <strong>Interaction:</strong> Click on tree nodes to highlight corresponding languages on the map
          `);
        }

      } catch (renderError) {
        console.error('Error rendering tree with D3:', renderError);
        // 在 controlOnly 模式下没有容器，不当作错误弹出
        if (!controlOnly) {
          setError('Error rendering tree visualization. Please try another tree file.');
        }
      }

    } catch (error) {
      console.error('Error loading tree:', error);
      setError(`Error loading tree: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 当外部传入的选择发生变化时，更新内部选择并可选自动加载
  useEffect(() => {
    if (selectedTreeProp && selectedTreeProp !== selectedTree) {
      setSelectedTree(selectedTreeProp);
      if (autoLoad) {
        // 异步触发，确保下一个周期中容器已渲染
        setTimeout(() => {
          loadAndDisplayTree();
        }, 0);
      }
    }
  }, [selectedTreeProp, autoLoad]);

  // 控件模式：只渲染一行筛选器（选择+加载按钮）
  if (controlOnly) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c7c6c', whiteSpace: 'nowrap' }}>
          {lang === 'zh' ? '家族筛选' : 'Family Filter'}:
        </label>
        <select 
          id="tree-selector"
          value={selectedTree}
          onChange={(e) => {
            setSelectedTree(e.target.value);
            if (onSelectChange) onSelectChange(e.target.value);
          }}
          style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: 120 }}
        >
          <option value="">{langs[lang].selectFamily || 'Select a family'}</option>
          {treeFiles.map(tree => (
            <option key={tree.value} value={tree.value}>
              {tree.label}
            </option>
          ))}
        </select>
        <button 
          id="load-tree"
          onClick={async () => {
            await loadAndDisplayTree();
            if (onLoad) onLoad(selectedTree);
          }}
          disabled={loading || !selectedTree}
          style={{ padding: '6px 10px', background: '#2c7c6c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
        >
          {loading ? 'Loading...' : langs[lang].loadTree}
        </button>
      </div>
    );
  }

  return (
    <div className="chart-container analysis-section">
      {!hideTitle && (
        <div className="chart-title">{langs[lang].treeTitle}</div>
      )}
      <div className="tree-controls">
        <select 
          id="tree-selector"
          value={selectedTree}
          onChange={(e) => setSelectedTree(e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}
        >
          <option value="">{langs[lang].selectFamily || 'Select a family'}</option>
          {treeFiles.map(tree => (
            <option key={tree.value} value={tree.value}>
              {tree.label}
            </option>
          ))}
        </select>
        <button 
          id="load-tree"
          onClick={async () => {
            await loadAndDisplayTree();
            if (onLoad) onLoad(selectedTree);
          }}
          disabled={loading || !selectedTree}
          style={{ width: '100%', padding: '8px', background: '#2c7c6c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          {loading ? 'Loading...' : langs[lang].loadTree}
        </button>
      </div>
      
      {/* 错误信息 */}
      {error && (
        <div style={{ 
          marginTop: 10, 
          padding: 10, 
          background: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: 4, 
          color: '#c62828',
          fontSize: '12px'
        }}>
          {error}
        </div>
      )}
      
      {/* 树可视化容器 */}
      <div 
        ref={treeContainerRef}
        id="tree-visualization"
      >
        {!selectedTree && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: '#666',
            fontSize: '14px'
          }}>
            {langs[lang].selectFamily || 'Select a family'}
          </div>
        )}
      </div>
      
      {/* 树信息 */}
      {treeInfo && (
        <div 
          id="tree-info" 
          className="tree-info"
          dangerouslySetInnerHTML={{ __html: treeInfo }}
        />
      )}
    </div>
  );
};

export default PhyloTree; 