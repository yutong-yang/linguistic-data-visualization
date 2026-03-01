import os
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
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
        
        # 初始化向量化器 - 优先级：Ollama > sentence-transformers > TF-IDF
        self.embedding_model = None
        self.use_ollama = False
        self.use_sentence_transformers = False
        self.vectorizer = None  # TF-IDF 向量化器，仅在无其他 embedding 时使用
        self.is_fitted = False
        
        # 优先尝试使用Ollama（本地模型，隐私友好，Mac友好）
        # 直接使用ollama Python包，避免langchain-ollama的版本冲突
        try:
            import ollama
            # 检查Ollama服务是否可用（只检查API是否可访问，不发送embedding请求）
            try:
                # 轻量级检查：只检查服务是否运行，不生成embedding
                import httpx
                test_response = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
                if test_response.status_code == 200:
                    # 服务可用，尝试初始化（不发送embedding请求）
                    self.embedding_model = "nomic-embed-text"  # 存储模型名
                    self.ollama_client = ollama  # 存储客户端
                    self.use_ollama = True
                    logger.info("✅ 使用 Ollama embeddings (nomic-embed-text) - 本地模型，隐私友好")
                else:
                    raise Exception("Ollama服务不可用")
            except (httpx.RequestError, httpx.TimeoutException, Exception) as e:
                logger.warning(f"Ollama不可用: {e}")
                logger.info("💡 提示: 如果未安装Ollama，请运行: brew install ollama")
                logger.info("💡 然后启动Ollama服务并拉取模型: ollama pull nomic-embed-text")
                self.use_ollama = False
                self.ollama_client = None
        except ImportError:
            logger.info("ollama Python包未安装，跳过Ollama embeddings")
            logger.info("💡 要使用Ollama，请安装: pip install ollama")
            self.use_ollama = False
            self.ollama_client = None
        
        # 如果Ollama不可用，尝试使用sentence-transformers（本地模型，无需API key）
        if not self.use_ollama:
            try:
                from sentence_transformers import SentenceTransformer
                # 使用轻量级多语言模型，支持中英文
                # all-MiniLM-L6-v2: 轻量级，速度快，支持多语言
                # 首次使用会自动下载模型（约80MB）
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                self.use_sentence_transformers = True
                logger.info("✅ 使用 sentence-transformers 本地embedding模型 (all-MiniLM-L6-v2)")
            except ImportError:
                logger.info("sentence-transformers未安装，将使用TF-IDF作为备用方案")
                logger.info("💡 要使用更好的embedding，请安装: pip install sentence-transformers")
                self.use_sentence_transformers = False
        
        # 如果Ollama和sentence-transformers都不可用，使用TF-IDF作为备用
        if not self.use_ollama and not self.use_sentence_transformers:
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer
                from sklearn.metrics.pairwise import cosine_similarity
                import numpy as np
                
                # 优化的TF-IDF参数，提升搜索质量
                self.vectorizer = TfidfVectorizer(
                    max_features=20000,  # 增加特征数量，捕获更多词汇
                    stop_words='english',  # 移除英文停用词
                    ngram_range=(1, 3),  # 扩展到3-gram，捕获更多短语
                    min_df=2,  # 至少出现在2个文档中的词才考虑
                    max_df=0.95,  # 出现在95%以上文档的词忽略（太常见）
                    sublinear_tf=True,  # 使用对数TF，降低高频词权重
                    norm='l2',  # L2归一化
                    analyzer='word'  # 按词分析
                )
                # 如果有文档，重新训练向量化器
                if self.documents and len(self.documents) > 0:
                    try:
                        logger.info(f"重新训练TF-IDF向量化器，文档数量: {len(self.documents)}")
                        self.vectors = self.vectorizer.fit_transform(self.documents)
                        self.is_fitted = True
                        logger.info("TF-IDF向量化器训练成功")
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
        
        # 如果使用Ollama或sentence-transformers，检查是否需要生成embedding
        if (self.use_ollama or self.use_sentence_transformers) and self.embedding_model:
            if self.documents and len(self.documents) > 0:
                # 检查是否已有保存的向量
                # 处理稀疏矩阵和密集矩阵的情况
                vectors_len = None
                if self.vectors is not None:
                    try:
                        if hasattr(self.vectors, 'shape'):
                            vectors_len = self.vectors.shape[0]  # 稀疏或密集矩阵
                        else:
                            vectors_len = len(self.vectors)  # 列表或数组
                    except:
                        vectors_len = None
                
                # 维度检查：确保已保存向量的维度与当前模型一致
                if self.use_sentence_transformers and self.embedding_model and self.vectors is not None:
                    if hasattr(self.vectors, 'shape') and len(self.vectors.shape) > 1:
                        expected_dim = self.embedding_model.get_sentence_embedding_dimension()
                        actual_dim = self.vectors.shape[1]
                        if actual_dim != expected_dim:
                            logger.warning(
                                f"向量维度不匹配: 已保存={actual_dim}维, "
                                f"当前模型={expected_dim}维，需要重新生成 embedding"
                            )
                            vectors_len = None  # 强制触发重新生成

                if vectors_len is not None and vectors_len == len(self.documents):
                    model_name = "Ollama" if self.use_ollama else "sentence-transformers"
                    logger.info(f"加载已保存的{model_name} embedding向量，文档数量: {len(self.documents)}")
                    self.is_fitted = True
                else:
                    # 需要重新生成embedding
                    try:
                        model_name = "Ollama" if self.use_ollama else "sentence-transformers"
                        logger.info(f"使用{model_name}生成embedding，文档数量: {len(self.documents)}")
                        
                        if self.use_ollama:
                            # Ollama embeddings使用ollama.embeddings()方法
                            import numpy as np
                            total_docs = len(self.documents)
                            embeddings = []
                            # 禁用httpx的详细日志以减少噪音
                            import logging
                            httpx_logger = logging.getLogger("httpx")
                            original_level = httpx_logger.level
                            httpx_logger.setLevel(logging.WARNING)
                            
                            try:
                                for i, doc in enumerate(self.documents):
                                    try:
                                        response = self.ollama_client.embeddings(
                                            model=self.embedding_model,
                                            prompt=doc
                                        )
                                        if response and "embedding" in response:
                                            embeddings.append(response["embedding"])
                                        else:
                                            embeddings.append([0.0] * 768)  # 默认维度
                                        
                                        # 每10个文档显示一次进度
                                        if (i + 1) % 10 == 0 or (i + 1) == total_docs:
                                            logger.info(f"  进度: {i + 1}/{total_docs} ({100*(i+1)//total_docs}%)")
                                    except Exception as e:
                                        logger.warning(f"生成embedding失败: {e}，使用零向量")
                                        embeddings.append([0.0] * 768)
                            finally:
                                # 恢复httpx日志级别
                                httpx_logger.setLevel(original_level)
                            
                            self.vectors = np.array(embeddings)
                        else:
                            # sentence-transformers使用encode方法
                            self.vectors = self.embedding_model.encode(
                                self.documents,
                                show_progress_bar=True,
                                batch_size=32,
                                convert_to_numpy=True
                            )
                        
                        self.is_fitted = True
                        logger.info(f"{model_name} embedding生成成功")
                        # 保存embedding向量
                        self._save_data(self.vectors_file, self.vectors)
                    except Exception as e:
                        model_name = "Ollama" if self.use_ollama else "sentence-transformers"
                        logger.error(f"{model_name} embedding生成失败: {e}")
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
            
            # 重新生成向量 - 优先级：Ollama > sentence-transformers > TF-IDF
            if self.use_ollama and self.embedding_model and self.ollama_client:
                try:
                    import numpy as np
                    total_docs = len(self.documents)
                    logger.info(f"使用Ollama embeddings为 {total_docs} 个文档生成embedding...")
                    # Ollama使用ollama.embeddings()方法
                    embeddings = []
                    # 禁用httpx的详细日志以减少噪音
                    import logging
                    httpx_logger = logging.getLogger("httpx")
                    original_level = httpx_logger.level
                    httpx_logger.setLevel(logging.WARNING)
                    
                    try:
                        for i, doc in enumerate(self.documents):
                            try:
                                response = self.ollama_client.embeddings(
                                    model=self.embedding_model,
                                    prompt=doc
                                )
                                if response and "embedding" in response:
                                    embeddings.append(response["embedding"])
                                else:
                                    embeddings.append([0.0] * 768)  # 默认维度
                                
                                # 每10个文档显示一次进度
                                if (i + 1) % 10 == 0 or (i + 1) == total_docs:
                                    logger.info(f"  进度: {i + 1}/{total_docs} ({100*(i+1)//total_docs}%)")
                            except Exception as e:
                                logger.warning(f"文档 {i} embedding生成失败: {e}")
                                embeddings.append([0.0] * 768)
                    finally:
                        # 恢复httpx日志级别
                        httpx_logger.setLevel(original_level)
                    
                    self.vectors = np.array(embeddings)
                    self.is_fitted = True
                    logger.info(f"✅ Ollama embedding生成成功，共 {total_docs} 个文档")
                except Exception as e:
                    logger.error(f"Ollama embedding生成失败: {e}")
                    self.vectors = None
                    self.is_fitted = False
            elif self.use_sentence_transformers and self.embedding_model:
                try:
                    logger.info(f"使用sentence-transformers为 {len(self.documents)} 个文档生成embedding...")
                    self.vectors = self.embedding_model.encode(
                        self.documents,
                        show_progress_bar=True,
                        batch_size=32,
                        convert_to_numpy=True
                    )
                    self.is_fitted = True
                    logger.info("sentence-transformers embedding生成成功")
                except Exception as e:
                    logger.error(f"sentence-transformers embedding生成失败: {e}")
                    self.vectors = None
                    self.is_fitted = False
            # 回退到TF-IDF
            elif SKLEARN_AVAILABLE and self.vectorizer:
                try:
                    logger.info(f"使用TF-IDF为 {len(self.documents)} 个文档生成向量...")
                    self.vectors = self.vectorizer.fit_transform(self.documents)
                    self.is_fitted = True
                    logger.info("TF-IDF向量化成功")
                except Exception as e:
                    logger.error(f"TF-IDF向量化失败: {e}")
                    self.vectors = None
                    self.is_fitted = False
            
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
        query = query_texts[0]
        
        # 优先级：Ollama > sentence-transformers > TF-IDF
        # 优先使用Ollama embeddings
        if self.use_ollama and self.embedding_model and self.ollama_client and self.is_fitted and self.vectors is not None:
            try:
                import numpy as np
                from sklearn.metrics.pairwise import cosine_similarity
                
                # 将查询转换为embedding（使用ollama.embeddings()）
                response = self.ollama_client.embeddings(
                    model=self.embedding_model,
                    prompt=query
                )
                if not response or "embedding" not in response:
                    raise Exception("Ollama embedding返回空结果")
                query_embedding = np.array([response["embedding"]])
                
                # 计算相似度
                similarities = cosine_similarity(query_embedding, self.vectors).flatten()
                
                # 获取最相似的文档索引
                top_indices = np.argsort(similarities)[::-1][:n_results]
                
                # 构建结果
                results = {
                    "documents": [[self.documents[i] for i in top_indices]],
                    "metadatas": [[self.metadata[i] for i in top_indices]],
                    "distances": [[1 - similarities[i] for i in top_indices]]  # 转换为距离
                }
                
                logger.info(f"使用Ollama embeddings搜索，找到 {len(top_indices)} 个结果")
                return results
                
            except Exception as e:
                logger.error(f"Ollama embeddings搜索失败: {e}，回退到其他方法")
                # 回退到sentence-transformers或TF-IDF
        
        # 使用sentence-transformers
        if self.use_sentence_transformers and self.embedding_model and self.is_fitted and self.vectors is not None:
            try:
                import numpy as np
                from sklearn.metrics.pairwise import cosine_similarity
                
                # 将查询转换为embedding
                query_embedding = self.embedding_model.encode([query], convert_to_numpy=True)
                
                # 计算相似度
                similarities = cosine_similarity(query_embedding, self.vectors).flatten()
                
                # 获取最相似的文档索引
                top_indices = np.argsort(similarities)[::-1][:n_results]
                
                # 构建结果
                results = {
                    "documents": [[self.documents[i] for i in top_indices]],
                    "metadatas": [[self.metadata[i] for i in top_indices]],
                    "distances": [[1 - similarities[i] for i in top_indices]]  # 转换为距离
                }
                
                logger.info(f"使用sentence-transformers搜索，找到 {len(top_indices)} 个结果")
                return results
                
            except Exception as e:
                logger.error(f"sentence-transformers搜索失败: {e}，回退到TF-IDF")
                # 回退到TF-IDF
        
        # 使用TF-IDF作为备用（改进版：混合搜索）
        if self.is_fitted and self.vectorizer and self.vectors is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                import numpy as np
                
                query_vector = self.vectorizer.transform([query])
                
                # 计算TF-IDF相似度
                tfidf_similarities = cosine_similarity(query_vector, self.vectors).flatten()
                
                # 混合搜索：结合TF-IDF和关键词匹配
                query_lower = query.lower()
                query_words = [w.strip() for w in query_lower.split() if len(w.strip()) > 2]
                
                # 计算关键词匹配分数
                keyword_scores = np.zeros(len(self.documents))
                for i, doc in enumerate(self.documents):
                    doc_lower = doc.lower()
                    for word in query_words:
                        if word in doc_lower:
                            # 完全匹配给予更高分数
                            if f" {word} " in f" {doc_lower} ":
                                keyword_scores[i] += 2.0
                            else:
                                keyword_scores[i] += 1.0
                
                # 归一化关键词分数
                if keyword_scores.max() > 0:
                    keyword_scores = keyword_scores / keyword_scores.max()
                
                # 混合分数：70% TF-IDF + 30% 关键词匹配
                combined_scores = (tfidf_similarities * 0.7) + (keyword_scores * 0.3)
                
                # 获取最相似的文档索引
                top_indices = np.argsort(combined_scores)[::-1][:n_results]
                
                # 构建结果（使用混合分数计算距离）
                results = {
                    "documents": [[self.documents[i] for i in top_indices]],
                    "metadatas": [[self.metadata[i] for i in top_indices]],
                    "distances": [[1 - combined_scores[i] for i in top_indices]]  # 转换为距离
                }
                
                logger.info(f"使用改进的TF-IDF混合搜索，找到 {len(top_indices)} 个结果")
                return results
                
            except Exception as e:
                logger.error(f"TF-IDF搜索失败: {e}")
        
        # 最后回退到简单搜索
        logger.info("向量化器不可用，使用简单搜索")
        return self.simple_search(query, n_results)
    
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
        
        # Embedding模型选择 - 实际使用的是LightweightDocumentStore中的embedding
        # 优先级：Ollama > OpenAI > sentence-transformers > TF-IDF
        self.embeddings = None
        
        # 检查LightweightDocumentStore实际使用的embedding方法
        if hasattr(self.collection, 'use_ollama') and self.collection.use_ollama:
            self.embedding_method = "Ollama"
            # Ollama已经在LightweightDocumentStore中初始化，这里不需要额外操作
        elif openai_api_key:
            try:
                os.environ["OPENAI_API_KEY"] = openai_api_key
                self.embeddings = OpenAIEmbeddings()
                self.embedding_method = "OpenAI"
                logger.info("使用 OpenAI embedding 模型")
            except Exception as e:
                logger.warning(f"OpenAI embedding 初始化失败: {e}")
                # 回退到LightweightDocumentStore的方法
                if hasattr(self.collection, 'use_sentence_transformers') and self.collection.use_sentence_transformers:
                    self.embedding_method = "sentence-transformers"
                else:
                    self.embedding_method = "TF-IDF"
        elif hasattr(self.collection, 'use_sentence_transformers') and self.collection.use_sentence_transformers:
            self.embedding_method = "sentence-transformers"
            logger.info("使用 sentence-transformers 本地embedding模型")
        else:
            self.embedding_method = "TF-IDF"
            logger.info("使用 TF-IDF embedding 模型")
        
        # 优化的文本分割器 - 更大的块和重叠，保留更多上下文
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,  # 增加块大小，保留更多上下文
            chunk_overlap=300,  # 增加重叠，确保重要信息不被分割
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]  # 智能分割，优先按段落
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
    
    def extract_title_from_pdf(self, pdf_path: str) -> Optional[str]:
        """从PDF文件中提取标题（优先使用元数据，必要时从内容提取）"""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # 1. 优先尝试从PDF元数据获取（最可靠）
                if pdf_reader.metadata and pdf_reader.metadata.title:
                    title = pdf_reader.metadata.title.strip()
                    if title and len(title) > 5:
                        # 验证标题是否合理（不是内容片段）
                        if not title.startswith('(') and not title.endswith(')') and len(title) >= 10:
                            logger.info(f"从PDF元数据提取标题: {title[:80]}...")
                            return title
                
                # 2. 如果元数据没有，尝试从第一页提取标题（仅当文件名是DOI格式时使用）
                if len(pdf_reader.pages) > 0:
                    first_page_text = pdf_reader.pages[0].extract_text()
                    if first_page_text:
                        lines = first_page_text.split('\n')
                        best_title = None
                        best_score = 0
                        
                        # 查找可能的标题（通常在前几行，且较长）
                        for i, line in enumerate(lines[:30]):  # 检查前30行
                            line = line.strip()
                            
                            # 跳过空行和明显不是标题的行
                            if not line or len(line) < 20:  # 标题至少20字符
                                continue
                            
                            # 排除明显的非标题内容
                            skip_patterns = [
                                'abstract', 'keywords', 'introduction', 'doi:', 'http', '@',
                                'page', 'volume', 'issue', 'pp.', 'pp ', 'pages',
                                'received', 'accepted', 'published', 'copyright',
                                'correspondence', 'email', 'address', 'journal',
                                'series', 'companion', 'studies in', 'edited by'
                            ]
                            if any(pattern in line.lower() for pattern in skip_patterns):
                                continue
                            
                            # 排除以括号开头或结尾的行（通常是系列名称、卷号等）
                            if line.startswith('(') or line.endswith(')') or (line.startswith('[') and line.endswith(']')):
                                continue
                            
                            # 排除明显的作者行（通常包含多个逗号或"and"）
                            if ',' in line:
                                parts = [p.strip() for p in line.split(',')]
                                if len(parts) > 2:  # 可能是作者列表
                                    continue
                            
                            # 排除包含明显作者名的行（如"Matti M"）
                            if any(word in line.lower() for word in ['matti', 'et al', 'and', 'author']):
                                # 但如果整行看起来像标题（长度足够，没有太多逗号），可能还是标题
                                if ',' in line and len([p for p in line.split(',') if p.strip()]) > 2:
                                    continue
                            
                            # 排除明显的机构名
                            if any(word in line.lower() for word in ['university', 'institute', 'department', 'school', 'college', 'laboratory', 'lab']):
                                continue
                            
                            # 排除页码和数字行
                            if line.isdigit() or (len(line) < 20 and any(char.isdigit() for char in line[:3])):
                                continue
                            
                            # 标题特征评分
                            score = 0
                            # 长度合理（30-200字符）加分（标题通常较长）
                            if 30 <= len(line) <= 200:
                                score += 15
                            elif 20 <= len(line) < 30:
                                score += 8
                            # 首字母大写加分
                            if line and line[0].isupper():
                                score += 5
                            # 在前5行加分（更可能是标题）
                            if i < 5:
                                score += 10
                            elif i < 10:
                                score += 5
                            # 包含常见学术词汇加分
                            if any(word in line.lower() for word in ['analysis', 'study', 'research', 'approach', 'method', 'system', 'model', 'perspective', 'cross-linguistic', 'linguistic']):
                                score += 5
                            # 不以数字开头加分
                            if not line[0].isdigit():
                                score += 2
                            # 不包含括号加分（避免系列名称）
                            if '(' not in line and '[' not in line:
                                score += 5
                            
                            # 如果分数更高，更新最佳标题
                            if score > best_score:
                                best_title = line
                                best_score = score
                        
                        if best_title and best_score >= 20:  # 提高阈值，至少要有较高分数
                            logger.info(f"从PDF第一页提取标题: {best_title[:80]}...")
                            return best_title
                
                return None
        except Exception as e:
            logger.warning(f"提取PDF标题失败 {pdf_path}: {e}")
            return None
    
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