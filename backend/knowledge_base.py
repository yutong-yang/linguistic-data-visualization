import os
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import PyPDF2
import logging
import pickle
import hashlib

# 添加轻量级嵌入支持
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LightweightDocumentStore:
    """轻量级文档存储，完全独立的存储方案"""
    
    def __init__(self, db_path: str = "./knowledge_db"):
        self.db_path = Path(db_path)
        self.db_path.mkdir(exist_ok=True)
        self.documents_file = self.db_path / "documents.pkl"
        self.metadata_file = self.db_path / "metadata.pkl"
        self.vectors_file = self.db_path / "vectors.pkl"
        
        # 加载现有数据
        self.documents = self._load_data(self.documents_file, [])
        self.metadata = self._load_data(self.metadata_file, [])
        self.vectors = self._load_data(self.vectors_file, None)
        
        # 初始化向量化器
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
            import numpy as np
            
            self.vectorizer = TfidfVectorizer(
                max_features=10000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            # 如果有文档，重新训练向量化器
            if self.documents and len(self.documents) > 0:
                try:
                    logger.info(f"重新训练向量化器，文档数量: {len(self.documents)}")
                    self.vectors = self.vectorizer.fit_transform(self.documents)
                    self.is_fitted = True
                    logger.info("向量化器训练成功")
                except Exception as e:
                    logger.error(f"向量化器训练失败: {e}")
                    self.vectors = None
                    self.is_fitted = False
            else:
                self.vectors = None
                self.is_fitted = False
        except ImportError as e:
            logger.warning(f"sklearn导入失败，使用简单搜索: {e}")
            self.vectorizer = None
            self.vectors = None
            self.is_fitted = False
    
    def _load_data(self, file_path: Path, default_value):
        """安全加载数据文件"""
        try:
            if file_path.exists():
                with open(file_path, 'rb') as f:
                    return pickle.load(f)
        except Exception as e:
            logger.warning(f"加载数据文件失败 {file_path}: {e}")
        return default_value
    
    def _save_data(self, file_path: Path, data):
        """安全保存数据文件"""
        try:
            with open(file_path, 'wb') as f:
                pickle.dump(data, f)
        except Exception as e:
            logger.error(f"保存数据文件失败 {file_path}: {e}")
    
    def _clean_metadata(self, metadata: Dict) -> Dict:
        """清理元数据，确保所有值都是基本类型"""
        clean_metadata = {}
        
        for key, value in metadata.items():
            if value is None:
                clean_metadata[key] = None
            elif isinstance(value, (str, int, float, bool)):
                clean_metadata[key] = value
            elif isinstance(value, (list, tuple)):
                # 列表转换为字符串
                clean_metadata[key] = str(value)
            elif isinstance(value, dict):
                # 字典转换为字符串
                clean_metadata[key] = str(value)
            else:
                # 其他类型转换为字符串
                clean_metadata[key] = str(value)
        
        return clean_metadata
    
    def check_document_exists(self, source_path: str) -> bool:
        """检查文档是否已经存在（基于源文件路径）"""
        for meta in self.metadata:
            if meta.get("source") == source_path:
                return True
        return False
    
    def get_existing_sources(self) -> set:
        """获取所有已存在的文档源文件路径"""
        sources = set()
        for meta in self.metadata:
            source = meta.get("source")
            if source:
                sources.add(source)
        return sources
    
    def add(self, documents: List[str], metadatas: List[Dict], ids: List[str] = None):
        """添加文档到存储，支持去重检查"""
        try:
            # 检查是否有重复的源文件
            new_documents = []
            new_metadatas = []
            skipped_count = 0
            
            for i, (doc, meta) in enumerate(zip(documents, metadatas)):
                source_path = meta.get("source")
                if source_path and self.check_document_exists(source_path):
                    logger.info(f"文档已存在，跳过: {source_path}")
                    skipped_count += 1
                    continue
                
                new_documents.append(doc)
                new_metadatas.append(self._clean_metadata(meta))
            
            if not new_documents:
                logger.info(f"所有文档都已存在，跳过添加")
                return
            
            # 清理元数据
            cleaned_metadatas = [self._clean_metadata(meta) for meta in new_metadatas]
            
            # 添加新文档
            self.documents.extend(new_documents)
            self.metadata.extend(cleaned_metadatas)
            
            # 重新训练向量化器
            if SKLEARN_AVAILABLE and self.vectorizer:
                self.vectors = self.vectorizer.fit_transform(self.documents)
                self.is_fitted = True
            
            # 保存数据
            self._save_data(self.documents_file, self.documents)
            self._save_data(self.metadata_file, self.metadata)
            if self.vectors is not None:
                self._save_data(self.vectors_file, self.vectors)
            
            logger.info(f"成功添加 {len(new_documents)} 个新文档，跳过 {skipped_count} 个重复文档，总计 {len(self.documents)} 个")
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise
    
    def simple_search(self, query: str, n_results: int = 5):
        """优化的关键词搜索（备用方案）"""
        if not self.documents:
            return {
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]]
            }
        
        try:
            query_lower = query.lower()
            results = []
            
            # 预处理查询词，提取重要关键词
            query_words = [word.strip() for word in query_lower.split() if len(word.strip()) > 2]
            if not query_words:
                query_words = [query_lower]
            
            for i, doc in enumerate(self.documents):
                doc_lower = doc.lower()
                # 计算更精确的匹配分数
                score = 0
                exact_matches = 0
                partial_matches = 0
                
                for word in query_words:
                    if word in doc_lower:
                        # 完全匹配给予更高分数
                        if f" {word} " in f" {doc_lower} ":
                            exact_matches += 1
                            score += 2
                        else:
                            partial_matches += 1
                            score += 1
                
                # 考虑文档长度和匹配密度
                if score > 0:
                    # 归一化分数，考虑匹配密度
                    doc_length = len(doc_lower.split())
                    density_score = score / doc_length if doc_length > 0 else 0
                    
                    # 最终分数 = 匹配分数 + 密度分数
                    final_score = (score * 0.7) + (density_score * 0.3)
                    
                    results.append({
                        "index": i,
                        "score": final_score,
                        "exact_matches": exact_matches,
                        "partial_matches": partial_matches,
                        "document": doc,
                        "metadata": self.metadata[i] if i < len(self.metadata) else {}
                    })
            
            # 按分数排序，优先考虑完全匹配
            results.sort(key=lambda x: (x["exact_matches"], x["score"]), reverse=True)
            
            # 取前n_results个结果
            top_results = results[:n_results]
            
            return {
                "documents": [[r["document"] for r in top_results]],
                "metadatas": [[r["metadata"] for r in top_results]],
                "distances": [[1 - r["score"] for r in top_results]]  # 转换为距离
            }
            
        except Exception as e:
            logger.error(f"简单搜索失败: {e}")
            return {
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]]
            }
    
    def query(self, query_texts: List[str], n_results: int = 5):
        """查询相似文档"""
        if not self.is_fitted or not self.vectorizer:
            # 使用简单搜索作为备用
            logger.info("向量化器不可用，使用简单搜索")
            return self.simple_search(query_texts[0], n_results)
        
        try:
            from sklearn.metrics.pairwise import cosine_similarity
            import numpy as np
            
            query = query_texts[0]
            query_vector = self.vectorizer.transform([query])
            
            # 计算相似度
            similarities = cosine_similarity(query_vector, self.vectors).flatten()
            
            # 获取最相似的文档索引
            top_indices = np.argsort(similarities)[::-1][:n_results]
            
            # 构建结果
            results = {
                "documents": [[self.documents[i] for i in top_indices]],
                "metadatas": [[self.metadata[i] for i in top_indices]],
                "distances": [[1 - similarities[i] for i in top_indices]]  # 转换为距离
            }
            
            return results
            
        except Exception as e:
            logger.error(f"向量搜索失败，回退到简单搜索: {e}")
            return self.simple_search(query_texts[0], n_results)
    
    def count(self):
        """返回文档数量"""
        count = len(self.documents)
        logger.info(f"LightweightDocumentStore.count(): 当前文档数量 = {count}")
        return count
    
    def count_unique_sources(self):
        """返回唯一源文件数量（实际的PDF文档数量）"""
        unique_sources = set()
        for meta in self.metadata:
            source = meta.get("source")
            if source:
                # 提取文件名，去除路径
                filename = source.split('/')[-1] if '/' in source else source
                unique_sources.add(filename)
        
        count = len(unique_sources)
        logger.info(f"LightweightDocumentStore.count_unique_sources(): 唯一源文件数量 = {count}")
        return count
    
    def get_source_files_info(self):
        """获取源文件详细信息"""
        source_files = {}
        for meta in self.metadata:
            source = meta.get("source")
            if source:
                filename = source.split('/')[-1] if '/' in source else source
                if filename not in source_files:
                    source_files[filename] = {
                        "filename": filename,
                        "chunks_count": 0,
                        "file_type": meta.get("type", "unknown"),
                        "first_added": meta.get("processed_time", "unknown")
                    }
                source_files[filename]["chunks_count"] += 1
        
        return source_files
    
    def delete_collection(self):
        """删除集合"""
        try:
            if self.documents_file.exists():
                self.documents_file.unlink()
            if self.vectors_file.exists():
                self.vectors_file.unlink()
            if self.metadata_file.exists():
                self.metadata_file.unlink()
            
            self.documents = []
            self.vectors = None
            self.metadata = []
            self.is_fitted = False
            
            logger.info("集合已删除")
        except Exception as e:
            logger.error(f"删除集合失败: {e}")

class LinguisticKnowledgeBase:
    def __init__(self, db_path: str = "./knowledge_db", openai_api_key: str = None):
        """
        初始化语言学知识库
        
        Args:
            db_path: 知识库路径
            openai_api_key: OpenAI API密钥（仅用于embedding模型）
        """
        self.db_path = db_path
        
        # 统一使用轻量级存储方案
        self.collection = LightweightDocumentStore(db_path)
        logger.info("使用轻量级文档存储方案")
        
        # Embedding模型选择
        if openai_api_key:
            try:
                os.environ["OPENAI_API_KEY"] = openai_api_key
                self.embeddings = OpenAIEmbeddings()
                self.embedding_method = "OpenAI"
                logger.info("使用 OpenAI embedding 模型")
            except Exception as e:
                logger.warning(f"OpenAI embedding 初始化失败，使用轻量级方案: {e}")
                self.embeddings = None
                self.embedding_method = "轻量级 TF-IDF"
        else:
            # 默认使用轻量级 embedding
            self.embeddings = None
            self.embedding_method = "轻量级 TF-IDF"
            logger.info("使用轻量级 TF-IDF embedding 模型")
        
        # 文本分割器
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        
        logger.info(f"知识库初始化完成，路径: {db_path}")
        logger.info(f"Embedding方法: {self.embedding_method}")
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """从PDF文件中提取文本"""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            logger.error(f"提取PDF文本失败 {pdf_path}: {e}")
            return ""
    
    def process_csv_data(self, csv_path: str, collection_name: str = None) -> List[Dict]:
        """处理CSV数据，转换为文档格式"""
        try:
            df = pd.read_csv(csv_path)
            documents = []
            
            # 将每行数据转换为文档
            for idx, row in df.iterrows():
                # 创建文档内容
                content = f"数据记录 {idx + 1}:\n"
                for col, value in row.items():
                    if pd.notna(value):
                        content += f"{col}: {value}\n"
                
                # 清理元数据，确保所有值都是基本类型
                clean_metadata = {
                    "source": csv_path,
                    "type": "csv_data",
                    "row_index": idx,
                    "columns": str(list(df.columns))  # 转换为字符串
                }
                
                # 添加行数据，但确保值是基本类型
                for col, value in row.items():
                    if pd.notna(value):
                        # 处理不同类型的值
                        if isinstance(value, (list, tuple)):
                            clean_metadata[f"{col}_list"] = str(value)
                        elif isinstance(value, dict):
                            clean_metadata[f"{col}_dict"] = str(value)
                        elif isinstance(value, (int, float, str, bool)) or value is None:
                            clean_metadata[col] = value
                        else:
                            # 其他类型转换为字符串
                            clean_metadata[col] = str(value)
                
                documents.append({
                    "content": content,
                    "metadata": clean_metadata
                })
            
            return documents
        except Exception as e:
            logger.error(f"处理CSV数据失败 {csv_path}: {e}")
            return []
    
    def _clean_metadata(self, metadata: Dict) -> Dict:
        """清理元数据，确保所有值都是基本类型"""
        clean_metadata = {}
        
        for key, value in metadata.items():
            if value is None:
                clean_metadata[key] = None
            elif isinstance(value, (str, int, float, bool)):
                clean_metadata[key] = value
            elif isinstance(value, (list, tuple)):
                # 列表转换为字符串
                clean_metadata[key] = str(value)
            elif isinstance(value, dict):
                # 字典转换为字符串
                clean_metadata[key] = str(value)
            else:
                # 其他类型转换为字符串
                clean_metadata[key] = str(value)
        
        return clean_metadata

    def add_documents(self, documents: List[Dict], collection_name: str = None):
        """添加文档到向量数据库"""
        try:
            if not documents:
                logger.warning("没有文档需要添加")
                return
            
            # 分割文档
            all_chunks = []
            for doc in documents:
                if not doc.get("content") or not doc["content"].strip():
                    logger.warning(f"跳过空内容文档: {doc.get('metadata', {}).get('source', 'unknown')}")
                    continue
                
                chunks = self.text_splitter.split_text(doc["content"])
                for i, chunk in enumerate(chunks):
                    if chunk.strip():  # 只添加非空块
                        # 清理元数据
                        clean_metadata = self._clean_metadata(doc["metadata"])
                        clean_metadata.update({
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "chunk_size": len(chunk)
                        })
                        
                        all_chunks.append({
                            "content": chunk,
                            "metadata": clean_metadata
                        })
            
            if not all_chunks:
                logger.warning("所有文档块都为空，无法添加到知识库")
                return
            
            # 生成唯一ID
            import uuid
            chunk_ids = [f"doc_{uuid.uuid4().hex[:8]}_{i}" for i in range(len(all_chunks))]
            
            # 添加到存储
            try:
                self.collection.add(
                    documents=[chunk["content"] for chunk in all_chunks],
                    metadatas=[chunk["metadata"] for chunk in all_chunks],
                    ids=chunk_ids
                )
                
                logger.info(f"成功添加 {len(all_chunks)} 个文档块到知识库")
                
                # 记录添加的文档信息
                for doc in documents:
                    source = doc.get("metadata", {}).get("source", "unknown")
                    file_type = doc.get("metadata", {}).get("file_type", "unknown")
                    logger.info(f"文档已处理: {source} ({file_type})")
                    
            except Exception as e:
                logger.error(f"向存储添加文档失败: {e}")
                raise Exception(f"存储操作失败: {str(e)}")
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise Exception(f"文档处理失败: {str(e)}")
    
    def search(self, query: str, n_results: int = 5) -> List[Dict]:
        """搜索相关文档"""
        try:
            # 使用存储的查询方法
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            # 格式化结果
            formatted_results = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    formatted_results.append({
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] and results["metadatas"][0] else {},
                        "distance": results["distances"][0][i] if results["distances"] and results["distances"][0] else None
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def get_collection_info(self) -> Dict:
        """获取集合信息"""
        try:
            total_chunks = self.collection.count()
            unique_sources = self.collection.count_unique_sources()
            source_files_info = self.collection.get_source_files_info()
            
            logger.info(f"获取集合信息: 文档块数量 = {total_chunks}, 唯一源文件数量 = {unique_sources}, 数据库路径 = {self.db_path}")
            
            return {
                "total_documents": total_chunks,  # 文档块数量
                "total_source_files": unique_sources,  # 实际PDF文档数量
                "source_files_info": source_files_info,  # 源文件详细信息
                "collection_name": "linguistic_knowledge",
                "database_path": self.db_path,
                "embedding_method": "OpenAI" if self.embedding_method == "OpenAI" else "轻量级 TF-IDF"
            }
        except Exception as e:
            logger.error(f"获取集合信息失败: {e}")
            return {}
    
    def clear_collection(self):
        """清空集合"""
        try:
            self.collection.delete_collection()
            logger.info("集合已清空")
        except Exception as e:
            logger.error(f"清空集合失败: {e}")

# 全局知识库实例
knowledge_base = None

def init_knowledge_base(openai_api_key: str = None):
    """初始化全局知识库实例"""
    global knowledge_base
    knowledge_base = LinguisticKnowledgeBase(openai_api_key=openai_api_key)
    return knowledge_base

def get_knowledge_base() -> LinguisticKnowledgeBase:
    """获取全局知识库实例"""
    return knowledge_base 