import * as d3 from 'd3';

// 树文件列表
export const treeFiles = [
  { value: 'abkh1242.trees', label: 'Abkhaz-Adyge (abkh1242)' },
  { value: 'afro1255.trees', label: 'Afro-Asiatic (afro1255)' },
  { value: 'algi1248.trees', label: 'Algic (algi1248)' },
  { value: 'araw1281.trees', label: 'Arawakan (araw1281)' },
  { value: 'atha1245.trees', label: 'Athabaskan (atha1245)' },
  { value: 'atkinson2006.trees', label: 'Mayan (atkinson2006)' },
  { value: 'atla1278.trees', label: 'Atlantic-Congo (atla1278)' },
  { value: 'aust1305.trees', label: 'Austronesian (aust1305)' },
  { value: 'aust1307.trees', label: 'Austronesian (aust1307)' },
  { value: 'ayma1253.trees', label: 'Aymaran (ayma1253)' },
  { value: 'boro1281.trees', label: 'Bora-Witoto (boro1281)' },
  { value: 'bouckaert_et_al2012.trees', label: 'Indo-European (bouckaert_et_al2012)' },
  { value: 'bouckaert_et_al2018.trees', label: 'Indo-European (bouckaert_et_al2018)' },
  { value: 'bowern_and_atkinson2012.trees', label: 'Pama-Nyungan (bowern_and_atkinson2012)' },
  { value: 'cadd1255.trees', label: 'Caddoan (cadd1255)' },
  { value: 'cari1283.trees', label: 'Cariban (cari1283)' },
  { value: 'cent2225.trees', label: 'Central Sudanic (cent2225)' },
  { value: 'chacon_and_list2015.trees', label: 'Tupian (chacon_and_list2015)' },
  { value: 'chang_et_al2015.trees', label: 'Sino-Tibetan (chang_et_al2015)' },
  { value: 'chib1249.trees', label: 'Chibchan (chib1249)' },
  { value: 'chin1490.trees', label: 'Chinese (chin1490)' },
  { value: 'chon1288.trees', label: 'Chonan (chon1288)' },
  { value: 'chuk1271.trees', label: 'Chukotko-Kamchatkan (chuk1271)' },
  { value: 'coch1271.trees', label: 'Cochimi-Yuman (coch1271)' },
  { value: 'defilippo_et_al2012.trees', label: 'Niger-Congo (defilippo_et_al2012)' },
  { value: 'dizo1235.trees', label: 'Dizoid (dizo1235)' },
  { value: 'drav1251.trees', label: 'Dravidian (drav1251)' },
  { value: 'dunn_et_al2011.trees', label: 'Uralic (dunn_et_al2011)' },
  { value: 'eski1264.trees', label: 'Eskimo-Aleut (eski1264)' },
  { value: 'gong1255.trees', label: 'Gongduk (gong1255)' },
  { value: 'gray_et_al2009.trees', label: 'Austronesian (gray_et_al2009)' },
  { value: 'greenhill2015.trees', label: 'Austronesian (greenhill2015)' },
  { value: 'grollemund_et_al2015.trees', label: 'Bantu (grollemund_et_al2015)' },
  { value: 'guai1249.trees', label: 'Guajiboan (guai1249)' },
  { value: 'gunw1250.trees', label: 'Gunwinyguan (gunw1250)' },
  { value: 'haid1248.trees', label: 'Haida (haid1248)' },
  { value: 'heib1242.trees', label: 'Heiban (heib1242)' },
  { value: 'hmon1336.trees', label: 'Hmong-Mien (hmon1336)' },
  { value: 'honkola_et_al2013.trees', label: 'Uralic (honkola_et_al2013)' },
  { value: 'hruschka_et_al2015.trees', label: 'Sino-Tibetan (hruschka_et_al2015)' },
  { value: 'indo1319.trees', label: 'Indo-European (indo1319)' },
  { value: 'iroq1247.trees', label: 'Iroquoian (iroq1247)' },
  { value: 'japo1237.trees', label: 'Japonic (japo1237)' },
  { value: 'jara1244.trees', label: 'Jarawa-Onge (jara1244)' },
  { value: 'jarr1235.trees', label: 'Jarrakan (jarr1235)' },
  { value: 'kadu1256.trees', label: 'Kadu (kadu1256)' },
  { value: 'kart1248.trees', label: 'Kartvelian (kart1248)' },
  { value: 'kere1287.trees', label: 'Keresan (kere1287)' },
  { value: 'khoe1240.trees', label: 'Khoe-Kwadi (khoe1240)' },
  { value: 'kiow1265.trees', label: 'Kiowa-Tanoan (kiow1265)' },
  { value: 'kitchen_et_al2009.trees', label: 'Bantu (kitchen_et_al2009)' },
  { value: 'koia1260.trees', label: 'Koian (koia1260)' },
  { value: 'kolipakam_et_al2018.trees', label: 'Dravidian (kolipakam_et_al2018)' },
  { value: 'krua1234.trees', label: 'Kru (krua1234)' },
  { value: 'kwer1242.trees', label: 'Kwerba (kwer1242)' },
  { value: 'kxaa1236.trees', label: 'Kx\'a (kxaa1236)' },
  { value: 'lee2015.trees', label: 'Korean (lee2015)' },
  { value: 'lee_and_hasegawa2011.trees', label: 'Japonic (lee_and_hasegawa2011)' },
  { value: 'lee_and_hasegawa2013.trees', label: 'Ainu (lee_and_hasegawa2013)' },
  { value: 'maid1262.trees', label: 'Maiduan (maid1262)' },
  { value: 'mand1469.trees', label: 'Mande (mand1469)' },
  { value: 'mata1289.trees', label: 'Matacoan (mata1289)' },
  { value: 'maya1287.trees', label: 'Mayan (maya1287)' },
  { value: 'miwo1274.trees', label: 'Miwok (miwo1274)' },
  { value: 'mixe1284.trees', label: 'Mixe-Zoque (mixe1284)' },
  { value: 'mong1349.trees', label: 'Mongolic (mong1349)' },
  { value: 'musk1252.trees', label: 'Muskogean (musk1252)' },
  { value: 'nduu1242.trees', label: 'Ndu (nduu1242)' },
  { value: 'nilo1247.trees', label: 'Nilotic (nilo1247)' },
  { value: 'nubi1251.trees', label: 'Nubian (nubi1251)' },
  { value: 'nucl1708.trees', label: 'Nuclear Trans New Guinea (nucl1708)' },
  { value: 'nucl1709.trees', label: 'Nuclear Trans New Guinea (nucl1709)' },
  { value: 'nucl1710.trees', label: 'Nuclear Trans New Guinea (nucl1710)' },
  { value: 'otom1299.trees', label: 'Otomanguean (otom1299)' },
  { value: 'pala1350.trees', label: 'Palaungic (pala1350)' },
  { value: 'pama1250.trees', label: 'Pama-Nyungan (pama1250)' },
  { value: 'pano1259.trees', label: 'Panoan (pano1259)' },
  { value: 'pomo1273.trees', label: 'Pomoan (pomo1273)' },
  { value: 'quec1387.trees', label: 'Quechuan (quec1387)' },
  { value: 'robinson_and_holton2012.trees', label: 'Alor-Pantar (robinson_and_holton2012)' },
  { value: 'sagart_et_al2019.trees', label: 'Sino-Tibetan (sagart_et_al2019)' },
  { value: 'saha1239.trees', label: 'Saharan (saha1239)' },
  { value: 'saha1256.trees', label: 'Saharan (saha1256)' },
  { value: 'sali1255.trees', label: 'Salishan (sali1255)' },
  { value: 'sicoli_and_holton2014.trees', label: 'Na-Dene (sicoli_and_holton2014)' },
  { value: 'sino1245.trees', label: 'Sino-Tibetan (sino1245)' },
  { value: 'siou1252.trees', label: 'Siouan (siou1252)' },
  { value: 'song1307.trees', label: 'Songhay (song1307)' },
  { value: 'sout2845.trees', label: 'South Bougainville (sout2845)' },
  { value: 'surm1244.trees', label: 'Surmic (surm1244)' },
  { value: 'taik1256.trees', label: 'Tai-Kadai (taik1256)' },
  { value: 'tang1340.trees', label: 'Tangkic (tang1340)' },
  { value: 'tsim1258.trees', label: 'Tsimshianic (tsim1258)' },
  { value: 'tuca1253.trees', label: 'Tucanoan (tuca1253)' },
  { value: 'tung1282.trees', label: 'Tungusic (tung1282)' },
  { value: 'tupi1275.trees', label: 'Tupian (tupi1275)' },
  { value: 'turk1311.trees', label: 'Turkic (turk1311)' },
  { value: 'tuuu1241.trees', label: 'Tuu (tuuu1241)' },
  { value: 'ural1272.trees', label: 'Uralic (ural1272)' },
  { value: 'utoa1244.trees', label: 'Uto-Aztecan (utoa1244)' },
  { value: 'waka1280.trees', label: 'Wakashan (waka1280)' },
  { value: 'walker_and_ribeiro2011.trees', label: 'Tupian (walker_and_ribeiro2011)' },
  { value: 'wint1258.trees', label: 'Wintuan (wint1258)' },
  { value: 'worr1236.trees', label: 'Worrorran (worr1236)' },
  { value: 'yano1268.trees', label: 'Yanomaman (yano1268)' },
  { value: 'yoku1255.trees', label: 'Yokutsan (yoku1255)' },
  { value: 'yuki1242.trees', label: 'Yuki (yuki1242)' },
  { value: 'zhang_et_al2019.trees', label: 'Sino-Tibetan (zhang_et_al2019)' }
];

// 解析 NEXUS 格式的 tree 文件
export function parseNexusTree(nexusText) {
  try {
    // 提取 TREE 行中的 Newick 字符串
    const treeMatch = nexusText.match(/TREE summary = \[.*\] (.*);/);
    if (!treeMatch) {
      throw new Error('No valid tree found in NEXUS file');
    }
    
    const newickString = treeMatch[1];
    return newickString;
  } catch (error) {
    console.error('Error parsing NEXUS tree:', error);
    return null;
  }
}

// 解析 Newick 字符串为树结构
export function parseNewick(newickString) {
  try {
    // 简单的 Newick 解析器
    const tokens = newickString.match(/[(),;]|[^(),;\s]+/g) || [];
    let index = 0;
    
    function parseNode() {
      const node = { name: '', children: [], length: 0 };
      
      if (tokens[index] === '(') {
        index++; // 跳过 '('
        while (tokens[index] !== ')') {
          if (tokens[index] === ',') {
            index++;
          } else {
            node.children.push(parseNode());
          }
        }
        index++; // 跳过 ')'
      }
      
      // 读取节点名称和长度
      if (index < tokens.length && tokens[index] !== ',' && tokens[index] !== ')' && tokens[index] !== ';') {
        const nameLength = tokens[index].split(':');
        node.name = nameLength[0];
        if (nameLength[1]) {
          node.length = parseFloat(nameLength[1]);
        }
        index++;
      }
      
      return node;
    }
    
    const root = parseNode();
    return root;
  } catch (error) {
    console.error('Error parsing Newick:', error);
    return null;
  }
}

// 获取树节点的所有后代语言
export function getDescendantLanguages(node, languageMapping) {
  const languages = [];
  
  function traverse(n) {
    if (!n.children || n.children.length === 0) {
      // 叶子节点，提取语言名称
      const glottocode = n.data.name;
      if (glottocode) {
        // 从Glottocode映射到语言名称（与原始HTML版本一致）
        let found = false;
        for (const [langName, code] of Object.entries(languageMapping)) {
          if (code === glottocode) {
            languages.push(langName);
            found = true;
            break;
          }
        }
        if (!found) {
          console.log('No mapping found for glottocode:', glottocode);
          console.log('Available codes in mapping:', Object.values(languageMapping).slice(0, 10));
        }
      }
    } else {
      // 内部节点，递归遍历所有子节点
      n.children.forEach(child => traverse(child));
    }
  }
  
  traverse(node);
  console.log('Found languages for node:', languages);
  return languages;
}

// 使用 D3.js 渲染树
export function renderD3Tree(treeData, container, onNodeClick, languageMapping) {
  const width = container.clientWidth;
  const height = container.clientHeight || 350;
  
  // 创建树布局
  const treeLayout = d3.tree().size([height, width - 100]);
  
  // 创建层次结构
  const hierarchy = d3.hierarchy(treeData, d => d.children);
  
  // 计算树布局
  const tree = treeLayout(hierarchy);

  // 清空容器
  d3.select(container).selectAll('*').remove();

  // 创建 SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'white')
    .call(
      d3.zoom()
        .scaleExtent([0.2, 3])
        .on('zoom', function (event) {
          g.attr('transform', event.transform);
        })
    );

  // 创建 group 用于 pan/zoom
  const g = svg.append('g')
    .attr('class', 'tree-group');

  // 居中 tree
  const nodes = tree.descendants();
  const minX = d3.min(nodes, d => d.x);
  const maxX = d3.max(nodes, d => d.x);
  const centerY = (minX + maxX) / 2;
  g.attr('transform', `translate(40,${height / 2 - centerY})`);

  // 绘制连接线
  g.selectAll('.link')
    .data(tree.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x))
    .style('fill', 'none')
    .style('stroke', '#333')
    .style('stroke-width', '1.5px');
  
  // 绘制节点
  const nodeGroups = g.selectAll('.node')
    .data(tree.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      if (onNodeClick) {
        const descendantLanguages = getDescendantLanguages(d, languageMapping);
        onNodeClick(d, descendantLanguages);
      }
    })
    .on('mouseover', function(event, d) {
      d3.select(this).select('circle').style('fill', '#ff6b6b');
    })
    .on('mouseout', function(event, d) {
      d3.select(this).select('circle').style('fill', '#fff');
    });
  
  // 节点圆圈
  nodeGroups.append('circle')
    .attr('r', 3)
    .style('fill', '#fff')
    .style('stroke', '#666')
    .style('stroke-width', '2px');
  
  // 节点标签
  nodeGroups.append('text')
    .attr('dy', '0.3em')
    .attr('x', d => d.children ? -8 : 8)
    .attr('text-anchor', d => d.children ? 'end' : 'start')
    .style('font-size', '10px')
    .style('font-family', 'Arial, sans-serif')
    .text(d => {
      if (!d.data.name) return '';
      // 移除前缀（如 bouckaert_et_al2012_）
      return d.data.name.replace(/^[^_]*_/, '');
    });
  
  return tree;
}

// 加载并解析树文件
export async function loadAndParseTree(treeFileName) {
  if (!treeFileName) {
    throw new Error('No tree file selected');
  }
  
  try {
    // 构建文件路径
    const treePath = `/dplace-cldf/cldf/trees/${treeFileName}`;
    
    // 加载 tree 文件
    const response = await fetch(treePath);
    if (!response.ok) {
      throw new Error(`Failed to load tree file: ${response.status}`);
    }
    
    const nexusText = await response.text();
    const newickString = parseNexusTree(nexusText);
    
    if (!newickString) {
      throw new Error('Could not parse tree from NEXUS file');
    }
    
    // 解析 Newick 字符串
    const treeData = parseNewick(newickString);
    
    if (!treeData) {
      throw new Error('Could not parse Newick string');
    }
    
    return { treeData, newickString };
  } catch (error) {
    console.error('Error loading tree:', error);
    throw error;
  }
} 