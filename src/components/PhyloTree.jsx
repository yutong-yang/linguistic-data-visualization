import React, { useState, useRef, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { treeFiles, loadAndParseTree, renderD3Tree } from '../utils/treeUtils';

const PhyloTree = () => {
  const { languageData, languageMapping, setHighlightedLanguages, lang, langs } = useContext(DataContext);
  const [selectedTree, setSelectedTree] = useState('');
  const [treeInfo, setTreeInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const treeContainerRef = useRef(null);
  const currentTreeRef = useRef(null);

  // 处理树节点点击
  const handleNodeClick = (node, descendantLanguages) => {
    console.log('Node clicked:', node.data.name);
    console.log('Descendant languages found:', descendantLanguages);
    console.log('Current language mapping:', languageMapping);
    
    if (descendantLanguages.length > 0) {
      setTreeInfo(`
        <strong>Selected Node:</strong> ${node.data.name || 'Internal node'}<br>
        <strong>Languages highlighted:</strong> ${descendantLanguages.length}<br>
        <strong>Languages:</strong> ${descendantLanguages.join(', ')}
      `);
      setHighlightedLanguages(descendantLanguages);
      console.log('Setting highlighted languages:', descendantLanguages);
    } else {
      setTreeInfo('No matching languages found for this node.');
      setHighlightedLanguages([]);
      console.log('No languages found, clearing highlights');
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
      
      // 清除之前的可视化
      if (treeContainerRef.current) {
        treeContainerRef.current.innerHTML = '';
      }

      // 使用 D3.js 渲染树
      try {
        const tree = renderD3Tree(
          treeData, 
          treeContainerRef.current, 
          handleNodeClick, 
          languageMapping
        );
        currentTreeRef.current = tree;

        // 计算统计信息
        const tips = tree.descendants().filter(d => !d.children || d.children.length === 0);
        const maxDepth = Math.max(...tree.descendants().map(d => d.depth));

        setTreeInfo(`
          <strong>Tree Information:</strong><br>
          • File: ${selectedTree}<br>
          • Number of tips (languages): ${tips.length}<br>
          • Maximum depth: ${maxDepth}<br>
          • Tree type: Phylogenetic tree from D-PLACE database<br>
          • Visualization: D3.js tree layout<br>
          • <strong>Interaction:</strong> Click on tree nodes to highlight corresponding languages on the map
        `);

      } catch (renderError) {
        console.error('Error rendering tree with D3:', renderError);
        setError('Error rendering tree visualization. Please try another tree file.');
      }

    } catch (error) {
      console.error('Error loading tree:', error);
      setError(`Error loading tree: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chart-container analysis-section">
      <div className="chart-title">{langs[lang].treeTitle}</div>
      <div className="tree-controls">
        <select 
          id="tree-selector"
          value={selectedTree}
          onChange={(e) => setSelectedTree(e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}
        >
          <option value="">{langs[lang].selectTree}</option>
          {treeFiles.map(tree => (
            <option key={tree.value} value={tree.value}>
              {tree.label}
            </option>
          ))}
        </select>
        <button 
          id="load-tree"
          onClick={loadAndDisplayTree}
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
            {langs[lang].selectTree}
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