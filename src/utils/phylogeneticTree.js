// 系统发育树数据处理工具

// 解析NEXUS格式的系统发育树文件
export const parseNexusTree = (nexusContent) => {
  try {
    const lines = nexusContent.split('\n');
    const taxa = [];
    const treeData = {};
    
    let inTaxa = false;
    let inTree = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 解析TAXA部分
      if (line === 'BEGIN TAXA;') {
        inTaxa = true;
        continue;
      }
      
      if (line === 'END;' && inTaxa) {
        inTaxa = false;
        continue;
      }
      
      if (inTaxa && line.startsWith('TAXLABELS')) {
        // 读取语言ID列表
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith(';')) {
          const taxLine = lines[j].trim();
          if (taxLine && !taxLine.startsWith(';')) {
            const taxIds = taxLine.split(/\s+/).filter(id => id && id !== ';');
            taxa.push(...taxIds);
          }
          j++;
        }
        i = j;
        continue;
      }
      
      // 解析TREE部分
      if (line.startsWith('TREE')) {
        inTree = true;
        const treeMatch = line.match(/TREE\s+\*\s+(\w+)\s*=\s*\[&R\]\s*(.+)/);
        if (treeMatch) {
          treeData.name = treeMatch[1];
          treeData.newick = treeMatch[2];
        }
        continue;
      }
      
      if (line === 'END;' && inTree) {
        inTree = false;
        break;
      }
    }
    
    return {
      taxa,
      treeData,
      success: true
    };
  } catch (error) {
    console.error('解析NEXUS文件失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 解析Newick格式的树结构
export const parseNewickTree = (newickString) => {
  try {
    // 简单的Newick解析器
    const tokens = newickString.match(/[(),:;]|[^(),:;\s]+/g) || [];
    let index = 0;
    
    const parseNode = (parent = null) => {
      const node = {
        children: [],
        branchLength: null,
        name: null,
        parent: parent
      };
      
      if (tokens[index] === '(') {
        index++; // 跳过左括号
        
        // 解析子节点
        while (tokens[index] !== ')') {
          if (tokens[index] === ',') {
            index++; // 跳过逗号
          }
          const childNode = parseNode(node);
          node.children.push(childNode);
        }
        
        index++; // 跳过右括号
        
        // 解析节点名称和分支长度
        if (tokens[index] && tokens[index] !== ',' && tokens[index] !== ')') {
          const nameLength = tokens[index].split(':');
          if (nameLength.length === 2) {
            node.name = nameLength[0];
            node.branchLength = parseFloat(nameLength[1]);
          } else {
            node.name = tokens[index];
          }
          index++;
        }
      } else {
        // 叶子节点
        const nameLength = tokens[index].split(':');
        if (nameLength.length === 2) {
          node.name = nameLength[0];
          node.branchLength = parseFloat(nameLength[1]);
        } else {
          node.name = tokens[index];
        }
        index++;
      }
      
      return node;
    };
    
    const root = parseNode();
    return {
      success: true,
      tree: root
    };
  } catch (error) {
    console.error('解析Newick树失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 在树中查找特定语言
export const findLanguageInTree = (tree, languageId) => {
  if (!tree) return null;
  
  const searchNode = (node) => {
    if (node.name === languageId) {
      return node;
    }
    
    for (const child of node.children) {
      const result = searchNode(child);
      if (result) return result;
    }
    
    return null;
  };
  
  return searchNode(tree);
};

// 获取语言的最近亲属
export const getClosestRelatives = (tree, languageId) => {
  const targetNode = findLanguageInTree(tree, languageId);
  if (!targetNode || !targetNode.parent) return null;
  
  const siblings = targetNode.parent.children.filter(child => child.name !== languageId);
  return siblings.map(sibling => ({
    id: sibling.name,
    branchLength: sibling.branchLength
  }));
};

// 获取语言在树中的位置信息
export const getTreePosition = (tree, languageId) => {
  const targetNode = findLanguageInTree(tree, languageId);
  if (!targetNode) return null;
  
  // 计算到根节点的距离
  let distanceToRoot = 0;
  let currentNode = targetNode;
  
  while (currentNode.parent) {
    if (currentNode.branchLength) {
      distanceToRoot += currentNode.branchLength;
    }
    currentNode = currentNode.parent;
  }
  
  return {
    distanceToRoot: distanceToRoot.toFixed(3),
    level: getNodeLevel(tree, languageId),
    hasChildren: targetNode.children.length > 0
  };
};

// 获取节点在树中的层级
const getNodeLevel = (tree, languageId, currentLevel = 0) => {
  if (!tree) return -1;
  
  if (tree.name === languageId) {
    return currentLevel;
  }
  
  for (const child of tree.children) {
    const result = getNodeLevel(child, languageId, currentLevel + 1);
    if (result !== -1) return result;
  }
  
  return -1;
};

// 主要的语言信息获取函数
export const getPhylogeneticInfo = (tree, languageId) => {
  if (!tree || !languageId) {
    return {
      closestRelatives: null,
      branchLength: null,
      treePosition: null
    };
  }
  
  const targetNode = findLanguageInTree(tree, languageId);
  if (!targetNode) {
    return {
      closestRelatives: null,
      branchLength: null,
      treePosition: null
    };
  }
  
  const closestRelatives = getClosestRelatives(tree, languageId);
  const treePosition = getTreePosition(tree, languageId);
  
  return {
    closestRelatives: closestRelatives ? 
      closestRelatives.map(rel => `${rel.id} (${rel.branchLength?.toFixed(3) || 'N/A'})`).join(', ') : 
      'No close relatives found',
    branchLength: targetNode.branchLength ? targetNode.branchLength.toFixed(3) : 'N/A',
    treePosition: treePosition ? 
      `Level ${treePosition.level}, Distance to root: ${treePosition.distanceToRoot}` : 
      'Position unknown'
  };
};
