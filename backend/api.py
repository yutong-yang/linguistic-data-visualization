from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
from pathlib import Path
import logging
import tempfile
import shutil
import asyncio
from typing import Optional, Dict, Any
import uuid
import httpx

from knowledge_base import init_knowledge_base, get_knowledge_base, LinguisticKnowledgeBase
from database_explorer import (
    search_feature_descriptions,
    get_feature_statistics,
    clean_description,
    get_all_feature_ids
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 从环境变量获取配置
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000").split(",")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "50")) * 1024 * 1024  # 默认50MB

app = FastAPI(title="Linguistic Knowledge Base API", version="1.0.0")

# 配置CORS - 使用环境变量
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_found: int

class KnowledgeBaseInfo(BaseModel):
    total_documents: int
    collection_name: str
    database_path: str
    embedding_method: str
    status: str
    last_updated: Optional[str] = None
    processing_status: Optional[str] = None

class InitRequest(BaseModel):
    openai_api_key: Optional[str] = None

class DocumentRequest(BaseModel):
    file_path: str
    file_type: str  # "pdf" or "csv"

class PaperUploadRequest(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[str] = None
    publication_date: Optional[str] = None

class StatusResponse(BaseModel):
    status: str
    message: str
    details: Optional[Dict[str, Any]] = None

# 全局变量
knowledge_base: Optional[LinguisticKnowledgeBase] = None
processing_status: str = "ready"  # idle, processing, completed, error
last_operation: Optional[str] = None
last_operation_time: Optional[str] = None
current_task_id: Optional[str] = None
current_task: Optional[asyncio.Task] = None
task_cancelled: bool = False

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化知识库"""
    global knowledge_base, processing_status
    try:
        # 从环境变量获取API密钥
        openai_api_key = os.getenv("OPENAI_API_KEY")
        knowledge_base = init_knowledge_base(openai_api_key=openai_api_key)
        processing_status = "ready"
        logger.info("知识库初始化完成")
    except Exception as e:
        processing_status = "error"
        logger.error(f"知识库初始化失败: {e}")

@app.post("/api/init", response_model=StatusResponse)
async def initialize_knowledge_base(request: InitRequest):
    """初始化知识库"""
    global knowledge_base
    try:
        knowledge_base = init_knowledge_base(openai_api_key=request.openai_api_key)
        
        return StatusResponse(
            status="success",
            message="知识库初始化成功",
            details={
                "embedding_method": "OpenAI" if request.openai_api_key else "轻量级 TF-IDF",
                "storage_method": "轻量级存储",
                "timestamp": str(Path().cwd())
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"初始化失败: {str(e)}")

@app.get("/api/info", response_model=KnowledgeBaseInfo)
async def get_knowledge_base_info():
    """获取知识库信息"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        info = knowledge_base.get_collection_info()
        
        # 简化状态信息，确保能正确返回
        enhanced_info = {
            **info,
            "status": "ready",
            "last_updated": str(Path().cwd()),
            "processing_status": "ready"
        }
        
        return KnowledgeBaseInfo(**enhanced_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取信息失败: {str(e)}")

@app.get("/api/status")
async def get_system_status():
    """获取系统状态"""
    global knowledge_base
    
    try:
        if knowledge_base:
            info = knowledge_base.get_collection_info()
            
            # 只统计 repository 目录下的文件
            repository_dir = Path("../public/repository")
            if repository_dir.exists():
                pdf_files = list(repository_dir.rglob("*.pdf"))
                total_files = len(pdf_files)
            else:
                total_files = 0
            
            return {
                "status": "ready",
                "knowledge_base_initialized": True,
                "total_documents": info.get("total_documents", 0),
                "embedding_method": info.get("embedding_method", "轻量级 TF-IDF"),
                "processing_status": "ready",
                "total_files_in_repository": total_files,
                "pdf_files": total_files,
                "message": f"知识库已初始化，包含 {info.get('total_documents', 0)} 个文档，repository 目录有 {total_files} 个可用PDF文件",
                "database_path": info.get("database_path", "unknown")
            }
        else:
            # 即使未初始化，也统计文件数
            repository_dir = Path("../public/repository")
            if repository_dir.exists():
                pdf_files = list(repository_dir.rglob("*.pdf"))
                total_files = len(pdf_files)
            else:
                total_files = 0
            
            return {
                "status": "not_initialized",
                "knowledge_base_initialized": False,
                "processing_status": "not_initialized",
                "total_files_in_repository": total_files,
                "pdf_files": total_files,
                "message": f"知识库未初始化，repository 目录有 {total_files} 个可用PDF文件"
            }
    except Exception as e:
        return {
            "status": "error",
            "knowledge_base_initialized": False,
            "processing_status": "error",
            "error": str(e)
        }

@app.post("/api/search", response_model=SearchResponse)
async def search_knowledge_base(request: SearchRequest):
    """搜索知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        # 增加默认结果数量，让AI获得更全面的信息
        n_results = max(request.n_results, 10)  # 至少返回10个结果
        results = knowledge_base.search(request.query, n_results)
        return SearchResponse(
            results=results,
            total_found=len(results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@app.post("/api/add-document")
async def add_document(request: DocumentRequest):
    """添加文档到知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        file_path = Path(request.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        documents = []
        
        if request.file_type.lower() == "pdf":
            # 处理PDF文件
            text = knowledge_base.extract_text_from_pdf(str(file_path))
            if text:
                documents.append({
                    "content": text,
                    "metadata": {
                        "source": str(file_path),
                        "type": "pdf",
                        "filename": file_path.name
                    }
                })
        
        elif request.file_type.lower() == "csv":
            # 处理CSV文件
            documents = knowledge_base.process_csv_data(str(file_path))
        
        else:
            raise HTTPException(status_code=400, detail="不支持的文件类型")
        
        if documents:
            knowledge_base.add_documents(documents)
            return {"message": f"成功添加 {len(documents)} 个文档"}
        else:
            return {"message": "没有找到可处理的文档"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加文档失败: {str(e)}")

@app.post("/api/upload-paper")
async def upload_paper(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    authors: Optional[str] = None,
    abstract: Optional[str] = None,
    keywords: Optional[str] = None,
    publication_date: Optional[str] = None
):
    """上传论文文件到知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    # 检查文件类型
    allowed_types = ["pdf", "docx", "txt"]
    file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_extension not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件类型: {file_extension}。支持的类型: {', '.join(allowed_types)}"
        )
    
            # 检查文件大小限制
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件过大: {file.size / 1024 / 1024:.1f}MB。最大允许: {MAX_FILE_SIZE / 1024 / 1024:.0f}MB"
            )
    
    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            # 写入上传的文件内容
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            documents = []
            extracted_text = ""
            
            if file_extension == "pdf":
                # 处理PDF文件
                text = knowledge_base.extract_text_from_pdf(temp_file_path)
                if text and text.strip():
                    extracted_text = text
                    # 创建元数据，只包含非空值
                    metadata = {
                        "source": file.filename,
                        "type": "paper",
                        "file_type": "pdf",
                        "title": title or file.filename.replace(f".{file_extension}", ""),
                        "upload_time": str(Path().cwd()),
                        "file_size": file.size,
                        "pages": len(text.split('\n')) // 50 + 1  # 估算页数
                    }
                    
                    # 只添加非空的元数据字段
                    if authors:
                        metadata["authors"] = authors
                    if abstract:
                        metadata["abstract"] = abstract
                    if keywords:
                        metadata["keywords"] = keywords
                    if publication_date:
                        metadata["publication_date"] = publication_date
                    
                    documents.append({
                        "content": text,
                        "metadata": metadata
                    })
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="PDF文件内容为空或无法提取文本"
                    )
            
            elif file_extension == "docx":
                # 处理Word文档
                try:
                    import docx
                    doc = docx.Document(temp_file_path)
                    text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                    if text.strip():
                        extracted_text = text
                        # 创建元数据，只包含非空值
                        metadata = {
                            "source": file.filename,
                            "type": "paper",
                            "file_type": "docx",
                            "title": title or file.filename.replace(f".{file_extension}", ""),
                            "upload_time": str(Path().cwd()),
                            "file_size": file.size,
                            "paragraphs": len(doc.paragraphs)
                        }
                        
                        # 只添加非空的元数据字段
                        if authors:
                            metadata["authors"] = authors
                        if abstract:
                            metadata["abstract"] = abstract
                        if keywords:
                            metadata["keywords"] = keywords
                        if publication_date:
                            metadata["publication_date"] = publication_date
                        
                        documents.append({
                            "content": text,
                            "metadata": metadata
                        })
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Word文档内容为空"
                        )
                except ImportError:
                    raise HTTPException(
                        status_code=500, 
                        detail="需要安装python-docx包来处理Word文档"
                    )
            
            elif file_extension == "txt":
                # 处理文本文件
                try:
                    with open(temp_file_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                    if text.strip():
                        extracted_text = text
                        # 创建元数据，只包含非空值
                        metadata = {
                            "source": file.filename,
                            "type": "paper",
                            "file_type": "txt",
                            "title": title or file.filename.replace(f".{file_extension}", ""),
                            "upload_time": str(Path().cwd()),
                            "file_size": file.size,
                            "characters": len(text),
                            "lines": len(text.split('\n'))
                        }
                        
                        # 只添加非空的元数据字段
                        if authors:
                            metadata["authors"] = authors
                        if abstract:
                            metadata["abstract"] = abstract
                        if keywords:
                            metadata["keywords"] = keywords
                        if publication_date:
                            metadata["publication_date"] = publication_date
                        
                        documents.append({
                            "content": text,
                            "metadata": metadata
                        })
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="文本文件内容为空"
                        )
                except UnicodeDecodeError:
                    # 尝试其他编码
                    try:
                        with open(temp_file_path, 'r', encoding='gbk') as f:
                            text = f.read()
                        if text.strip():
                            extracted_text = text
                            # 创建元数据，只包含非空值
                            metadata = {
                                "source": file.filename,
                                "type": "paper",
                                "file_type": "txt",
                                "title": title or file.filename.replace(f".{file_extension}", ""),
                                "upload_time": str(Path().cwd()),
                                "file_size": file.size,
                                "characters": len(text),
                                "lines": len(text.split('\n')),
                                "encoding": "gbk"
                            }
                            
                            # 只添加非空的元数据字段
                            if authors:
                                metadata["authors"] = authors
                            if abstract:
                                metadata["abstract"] = abstract
                            if keywords:
                                metadata["keywords"] = keywords
                            if publication_date:
                                metadata["publication_date"] = publication_date
                            
                            documents.append({
                                "content": text,
                                "metadata": metadata
                            })
                        else:
                            raise HTTPException(
                                status_code=400,
                                detail="文本文件内容为空"
                            )
                    except UnicodeDecodeError:
                        raise HTTPException(
                            status_code=400,
                            detail="无法解码文本文件，请检查文件编码"
                        )
            
            if documents:
                # 清理元数据，移除None值
                for doc in documents:
                    if "metadata" in doc:
                        # 过滤掉值为None的元数据字段
                        doc["metadata"] = {k: v for k, v in doc["metadata"].items() if v is not None}
                
                # 保存文件到repository目录
                repository_dir = Path("../public/repository")
                repository_dir.mkdir(exist_ok=True)
                
                # 生成唯一的文件名（避免重名）
                base_name = Path(file.filename).stem
                counter = 1
                final_filename = file.filename
                
                while (repository_dir / final_filename).exists():
                    name_parts = Path(file.filename).stem, Path(file.filename).suffix
                    final_filename = f"{name_parts[0]}_{counter}{name_parts[1]}"
                    counter += 1
                
                final_file_path = repository_dir / final_filename
                
                # 复制文件到repository目录
                shutil.copy2(temp_file_path, final_file_path)
                logger.info(f"文件已保存到repository目录: {final_file_path}")
                
                # 更新元数据中的source路径
                for doc in documents:
                    doc["metadata"]["source"] = str(final_file_path)
                    doc["metadata"]["repository_filename"] = final_filename
                
                # 添加到知识库
                knowledge_base.add_documents(documents)
                
                # 获取文档统计信息
                doc_info = knowledge_base.get_collection_info()
                
                return {
                    "message": f"论文上传成功，已保存到repository目录",
                    "filename": file.filename,
                    "repository_filename": final_filename,
                    "file_type": file_extension,
                    "documents_added": len(documents),
                    "file_size": file.size,
                    "text_length": len(extracted_text),
                    "collection_info": {
                        "total_documents": doc_info.get("total_documents", 0),
                        "collection_name": doc_info.get("collection_name", ""),
                        "database_path": doc_info.get("database_path", "")
                    },
                    "metadata": {
                        "title": documents[0]["metadata"]["title"],
                        "authors": authors,
                        "abstract": abstract,
                        "keywords": keywords,
                        "publication_date": publication_date
                    }
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail="文件内容为空，无法添加到知识库"
                )
                
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_file_path)
            except OSError:
                logger.warning(f"无法删除临时文件: {temp_file_path}")
            
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"论文上传失败: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"论文上传失败: {str(e)}"
        )

@app.post("/api/add-documents-batch")
async def add_documents_batch(background_tasks: BackgroundTasks):
    """批量添加文档（后台任务）"""
    global knowledge_base, current_task_id, current_task, task_cancelled
    
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    # 如果已有任务在运行，返回错误
    if current_task and not current_task.done():
        return {
            "status": "error",
            "message": "已有任务正在运行，请等待完成或先取消当前任务",
            "current_task_id": current_task_id
        }
    
    # 重置取消标志
    task_cancelled = False
    
    async def process_documents():
        """异步处理文档的函数"""
        global current_task_id, task_cancelled
        
        try:
            # 只处理 repository 目录下的文档
            repository_dir = Path("../public/repository")
            
            if not repository_dir.exists():
                logger.warning("repository 目录不存在")
                return
            
            # 统计文件总数
            pdf_files = list(repository_dir.rglob("*.pdf"))
            total_files = len(pdf_files)
            
            if total_files == 0:
                logger.info("repository 目录中没有PDF文件")
                return
            
            logger.info(f"开始批量处理 repository 目录，总计 {total_files} 个PDF文件")
            
            processed_files = 0
            errors = []
            added_files = 0
            
            # 获取已存在的文档源文件列表
            existing_sources = knowledge_base.collection.get_existing_sources()
            logger.info(f"知识库中已有 {len(existing_sources)} 个文档源")
            
            # 处理PDF文件
            for pdf_file in pdf_files:
                # 检查是否被取消
                if task_cancelled:
                    logger.info("任务被用户取消")
                    break
                
                try:
                    # 检查文件是否已经处理过
                    file_path_str = str(pdf_file)
                    if file_path_str in existing_sources:
                        logger.info(f"文件已存在，跳过: {pdf_file.name}")
                        processed_files += 1
                        continue
                    
                    text = knowledge_base.extract_text_from_pdf(file_path_str)
                    if text:
                        documents = [{
                            "content": text,
                            "metadata": {
                                "source": file_path_str,
                                "type": "pdf",
                                "filename": pdf_file.name,
                                "processed_time": str(Path().cwd())
                            }
                        }]
                        knowledge_base.add_documents(documents)
                        processed_files += 1
                        added_files += 1
                        existing_sources.add(file_path_str)  # 添加到已处理列表
                        logger.info(f"成功处理PDF文件: {pdf_file.name} ({processed_files}/{total_files})")
                    else:
                        logger.warning(f"PDF文件内容为空: {pdf_file.name}")
                        processed_files += 1
                        
                except Exception as e:
                    error_msg = f"处理PDF文件失败 {pdf_file}: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                    processed_files += 1  # 即使失败也计数
            
            if task_cancelled:
                logger.info(f"任务被取消，已处理 {processed_files}/{total_files} 个文件")
            else:
                logger.info(f"批量文档处理完成: 总计 {total_files} 个文件，成功处理 {processed_files} 个，新增 {added_files} 个，错误 {len(errors)} 个")
            
        except Exception as e:
            logger.error(f"批量处理文档失败: {e}")
        finally:
            # 清理任务状态
            current_task = None
            current_task_id = None
    
    # 创建新任务
    current_task_id = str(uuid.uuid4())
    current_task = asyncio.create_task(process_documents())
    
    # 立即返回，包含文件统计信息
    repository_dir = Path("../public/repository")
    if repository_dir.exists():
        pdf_files = list(repository_dir.rglob("*.pdf"))
        total_files = len(pdf_files)
    else:
        total_files = 0
    
    return {
        "status": "processing",
        "message": f"批量处理已启动",
        "total_files": total_files,
        "processed_files": 0,
        "operation": "batch_processing",
        "task_id": current_task_id
    }

@app.post("/api/cancel-task")
async def cancel_current_task():
    """取消当前正在运行的任务"""
    global current_task, task_cancelled, current_task_id
    
    if not current_task or current_task.done():
        return {
            "status": "error",
            "message": "没有正在运行的任务"
        }
    
    try:
        # 设置取消标志
        task_cancelled = True
        
        # 取消任务
        current_task.cancel()
        
        # 等待任务完成
        try:
            await current_task
        except asyncio.CancelledError:
            pass
        
        # 清理状态
        current_task = None
        current_task_id = None
        task_cancelled = False
        
        return {
            "status": "success",
            "message": "任务已成功取消",
            "task_id": current_task_id
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"取消任务失败: {str(e)}"
        }

@app.get("/api/task-status")
async def get_task_status():
    """获取当前任务状态"""
    global current_task, current_task_id, task_cancelled
    
    if not current_task:
        return {
            "status": "idle",
            "message": "没有正在运行的任务",
            "task_id": None
        }
    
    if current_task.done():
        if current_task.cancelled():
            status = "cancelled"
            message = "任务已被取消"
        elif current_task.exception():
            status = "error"
            message = f"任务执行出错: {current_task.exception()}"
        else:
            status = "completed"
            message = "任务已完成"
        
        # 清理已完成的任务
        current_task = None
        current_task_id = None
        task_cancelled = False
        
        return {
            "status": status,
            "message": message,
            "task_id": current_task_id
        }
    
    return {
        "status": "running",
        "message": "任务正在运行中",
        "task_id": current_task_id,
        "cancellable": True
    }

@app.delete("/api/clear")
async def clear_knowledge_base():
    """清空知识库"""
    global knowledge_base, processing_status, last_operation, last_operation_time
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        processing_status = "processing"
        last_operation = "clearing"
        last_operation_time = str(Path().cwd())
        
        knowledge_base.clear_collection()
        
        processing_status = "ready"
        last_operation = "clearing_completed"
        last_operation_time = str(Path().cwd())
        
        return StatusResponse(
            status="success",
            message="知识库已清空",
            details={
                "operation": "clear",
                "timestamp": last_operation_time
            }
        )
    except Exception as e:
        processing_status = "error"
        last_operation = "clearing_error"
        last_operation_time = str(Path().cwd())
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")

@app.get("/api/health")
async def health_check():
    """健康检查"""
    global knowledge_base
    return {
        "status": "healthy", 
        "knowledge_base_initialized": knowledge_base is not None,
        "processing_status": "ready" if knowledge_base else "not_initialized",
        "timestamp": str(Path().cwd())
    }

@app.get("/api/progress")
async def get_processing_progress():
    """获取处理进度"""
    try:
        # 检查是否有正在进行的批量处理
        # 这里可以通过检查日志或临时文件来判断进度
        public_dir = Path("../public")
        pdf_files = list(public_dir.rglob("*.pdf"))
        csv_files = list(public_dir.rglob("*.csv"))
        total_files = len(pdf_files) + len(csv_files)
        
        # 获取当前知识库中的文档数
        if knowledge_base:
            current_docs = knowledge_base.get_collection_info().get("total_documents", 0)
        else:
            current_docs = 0
        
        return {
            "status": "processing" if total_files > 0 else "idle",
            "total_files": total_files,
            "current_documents": current_docs,
            "message": f"总计 {total_files} 个文件，当前知识库有 {current_docs} 个文档"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

# 千问API代理端点
class QianwenRequest(BaseModel):
    prompt: str
    model: Optional[str] = "qwen-turbo"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2000

class GeminiRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gemini-1.5-flash"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2000

class FeatureRecommendationRequest(BaseModel):
    user_query: str
    language_data: Optional[List[Dict[str, Any]]] = None
    feature_descriptions: Optional[Dict[str, Any]] = None
    n_kb_results: Optional[int] = 10
    api_provider: Optional[str] = "gemini"  # "gemini" 或 "qianwen"

@app.post("/api/gemini/chat")
async def gemini_chat(
    request: GeminiRequest,
    http_request: Request
):
    """Gemini API代理端点，用于避免CORS问题和保护API Key"""
    try:
        # 优先从环境变量获取API密钥
        api_key = os.getenv("GEMINI_API_KEY")
        
        # 如果没有环境变量，尝试从请求头获取
        if not api_key:
            api_key = http_request.headers.get("X-API-Key") or http_request.headers.get("Authorization", "").replace("Bearer ", "")
        
        # 如果仍然没有API Key，返回错误
        if not api_key:
            raise HTTPException(
                status_code=400, 
                detail="GEMINI_API_KEY未设置。请在环境变量中设置GEMINI_API_KEY，或在请求头中提供X-API-Key"
            )
        
        # Gemini API端点
        api_url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
        
        # 构建请求体
        payload = {
            "contents": [{
                "parts": [{
                    "text": request.prompt
                }]
            }]
        }
        
        # 使用httpx异步调用Gemini API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{api_url}?key={api_key}",
                headers={
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Gemini API error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API调用失败: {error_text}"
                )
            
            try:
                data = response.json()
            except Exception as e:
                logger.error(f"Failed to parse Gemini API response as JSON: {e}. Response text: {response.text[:500]}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Gemini API返回的不是有效的JSON格式: {str(e)}"
                )
            
            # 提取响应内容
            if data.get("candidates") and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if candidate.get("content") and candidate["content"].get("parts"):
                    content = candidate["content"]["parts"][0].get("text", "")
                    if content:
                        return {
                            "success": True,
                            "content": str(content),
                            "usage": data.get("usage", {})
                        }
            
            # 如果所有格式都不匹配，记录完整的响应以便调试
            response_str = json.dumps(data, ensure_ascii=False, indent=2) if isinstance(data, (dict, list)) else str(data)
            logger.error(f"Unexpected Gemini API response structure. Full response: {response_str[:1000]}")
            raise HTTPException(
                status_code=500,
                detail=f"Gemini API返回格式异常。无法从响应中提取内容。响应结构: {response_str[:300]}"
            )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="请求超时，请稍后重试")
    except httpx.RequestError as e:
        logger.error(f"Gemini API request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"网络请求失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"调用Gemini API时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"调用Gemini API时出错: {str(e)}")

@app.post("/api/qianwen/chat")
async def qianwen_chat(
    request: QianwenRequest,
    http_request: Request
):
    """千问API代理端点，用于避免CORS问题"""
    try:
        # 优先从环境变量获取API密钥
        api_key = os.getenv("QIANWEN_API_KEY")
        
        # 如果没有环境变量，尝试从请求头获取
        if not api_key:
            api_key = http_request.headers.get("X-API-Key") or http_request.headers.get("Authorization", "").replace("Bearer ", "")
        
        # 如果仍然没有API Key，返回错误
        if not api_key:
            raise HTTPException(
                status_code=400, 
                detail="QIANWEN_API_KEY未设置。请在环境变量中设置QIANWEN_API_KEY，或在启动后端时设置：export QIANWEN_API_KEY=your_key"
            )
        
        # 千问API端点
        api_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        
        # 构建请求体
        payload = {
            "model": request.model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": request.prompt
                    }
                ]
            },
            "parameters": {
                "temperature": request.temperature,
                "max_tokens": request.max_tokens
            }
        }
        
        # 使用httpx异步调用千问API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                json=payload
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Qianwen API error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"千问API调用失败: {error_text}"
                )
            
            try:
                data = response.json()
            except Exception as e:
                logger.error(f"Failed to parse Qianwen API response as JSON: {e}. Response text: {response.text[:500]}")
                raise HTTPException(
                    status_code=500,
                    detail=f"千问API返回的不是有效的JSON格式: {str(e)}"
                )
            
            # 记录响应结构以便调试（只记录前500字符）
            logger.info(f"Qianwen API response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            
            # 提取响应内容 - 尝试多种可能的响应格式
            content = None
            
            # 格式1: output.text (千问API的标准格式)
            if isinstance(data, dict) and data.get("output"):
                output = data["output"]
                if isinstance(output, dict):
                    # 千问API返回格式: {"output": {"text": "...", "finish_reason": "stop"}}
                    content = output.get("text")
                    # 如果没有text，尝试choices格式（兼容其他可能的格式）
                    if not content and output.get("choices"):
                        choices = output["choices"]
                        if isinstance(choices, list) and len(choices) > 0:
                            choice = choices[0]
                            if isinstance(choice, dict):
                                # 尝试获取message.content
                                message = choice.get("message", {})
                                if isinstance(message, dict):
                                    content = message.get("content", "")
                                elif isinstance(message, str):
                                    content = message
                                # 如果message不存在，尝试直接获取content或text
                                if not content:
                                    content = choice.get("content") or choice.get("text")
            
            # 格式2: 直接是content字段
            if not content and isinstance(data, dict) and data.get("content"):
                content = data["content"]
            
            # 格式3: result字段
            if not content and isinstance(data, dict) and data.get("result"):
                content = data["result"]
            
            # 格式4: text字段（顶层）
            if not content and isinstance(data, dict) and data.get("text"):
                content = data["text"]
            
            # 格式5: 如果data本身就是字符串
            if not content and isinstance(data, str):
                content = data
            
            if content:
                return {
                    "success": True,
                    "content": str(content),
                    "usage": data.get("usage", {}) if isinstance(data, dict) else {}
                }
            else:
                # 如果所有格式都不匹配，记录完整的响应以便调试
                response_str = json.dumps(data, ensure_ascii=False, indent=2) if isinstance(data, (dict, list)) else str(data)
                logger.error(f"Unexpected Qianwen API response structure. Full response: {response_str[:1000]}")
                raise HTTPException(
                    status_code=500,
                    detail=f"千问API返回格式异常。无法从响应中提取内容。响应结构: {response_str[:300]}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="请求超时，请稍后重试")
    except httpx.RequestError as e:
        logger.error(f"Qianwen API request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"网络请求失败: {str(e)}")
    except Exception as e:
        logger.error(f"Qianwen API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"调用千问API时出错: {str(e)}")

async def call_gemini_api(prompt: str, api_key: str) -> str:
    """调用 Gemini API"""
    try:
        api_url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{api_url}?key={api_key}",
                headers={"Content-Type": "application/json"},
                json=payload
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API 请求失败: {response.text}"
                )
            
            data = response.json()
            
            if data.get("candidates") and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if candidate.get("content") and candidate["content"].get("parts"):
                    return candidate["content"]["parts"][0].get("text", "")
            
            raise HTTPException(status_code=500, detail="Gemini API 返回格式异常")
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="请求超时，请稍后重试")
    except Exception as e:
        logger.error(f"调用 Gemini API 时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"调用 Gemini API 时出错: {str(e)}")

def extract_features_from_knowledge_base(kb_results: List[Dict[str, Any]]) -> List[str]:
    """从知识库搜索结果中提取特征 ID"""
    features = set()
    import re
    
    for result in kb_results:
        document = result.get("document", {})
        content = (result.get("content") or document.get("content") or "").lower()
        
        # 提取 GB 特征
        gb_matches = re.findall(r'gb\d{3}', content, re.IGNORECASE)
        for match in gb_matches:
            feature_id = match.upper()
            num = int(feature_id[2:])
            if 20 <= num <= 999:
                features.add(feature_id)
        
        # 提取 EA 特征
        ea_matches = re.findall(r'ea\d{3}', content, re.IGNORECASE)
        for match in ea_matches:
            features.add(match.upper())
        
        # 提取环境特征
        if "richness" in content:
            features.update([
                "AmphibianRichness",
                "BirdRichness",
                "MammalRichness",
                "VascularPlantsRichness"
            ])
    
    return list(features)

@app.post("/api/feature-recommendation")
async def recommend_features(
    request: FeatureRecommendationRequest,
    http_request: Request
):
    """特征推荐端点"""
    try:
        # 确定使用的 API provider
        api_provider = request.api_provider or "gemini"
        
        # 获取 API Key
        api_key = None
        if api_provider == "qianwen":
            # 优先从环境变量获取
            api_key = os.getenv("QIANWEN_API_KEY")
            # 如果没有环境变量，从请求头获取
            if not api_key:
                api_key = http_request.headers.get("X-API-Key") or http_request.headers.get("Authorization", "").replace("Bearer ", "")
            
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="QIANWEN_API_KEY未设置。请在环境变量中设置QIANWEN_API_KEY，或在请求头中提供X-API-Key"
                )
        else:
            # Gemini
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                api_key = http_request.headers.get("X-API-Key") or http_request.headers.get("Authorization", "").replace("Bearer ", "")
            
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="GEMINI_API_KEY未设置。请在环境变量中设置GEMINI_API_KEY，或在请求头中提供X-API-Key"
                )
        
        # 1. 获取数据库统计信息
        stats = get_feature_statistics()
        
        # 2. 搜索相关特征描述（CSV数据库）
        search_results = search_feature_descriptions(request.user_query, 30)
        
        # 3. 搜索知识库（PDF文档）
        knowledge_base_context = ""
        extracted_features = []
        
        if knowledge_base:
            try:
                kb_results = knowledge_base.search(request.user_query, request.n_kb_results or 10)
                
                if kb_results and len(kb_results) > 0:
                    knowledge_base_context = "\n=== 知识库（PDF研究文献）相关内容 ===\n"
                    for index, result in enumerate(kb_results[:10], 1):
                        document = result.get("document", {})
                        metadata = result.get("metadata") or document.get("metadata", {})
                        content = result.get("content") or document.get("content", "")
                        source_name = metadata.get("filename") or metadata.get("source") or "未知文档"
                        
                        knowledge_base_context += f"\n**文献 {index}**: {source_name}\n"
                        knowledge_base_context += f"**内容**: {content[:400]}{'...' if len(content) > 400 else ''}\n"
                        knowledge_base_context += "\n---\n"
                    
                    # 从知识库内容中提取特征ID
                    extracted_features = extract_features_from_knowledge_base(kb_results)
                    if extracted_features:
                        knowledge_base_context += f"\n**从文献中提取的特征ID**: {', '.join(extracted_features[:15])}\n"
            except Exception as e:
                logger.warning(f"知识库搜索失败（不影响推荐）: {e}")
        
        # 4. 获取当前数据中的特征
        current_features = []
        if request.language_data:
            import re
            for lang in request.language_data:
                for key in lang.keys():
                    if (key.startswith('GB') or key.startswith('EA') or 'Richness' in key):
                        if key.startswith('GB'):
                            match = re.match(r'^GB(\d{3})$', key)
                            if match:
                                num = int(match.group(1))
                                if num >= 20:
                                    current_features.append(key)
                        else:
                            current_features.append(key)
        
        current_features = list(set(current_features))[:20]
        
        # 5. 构建数据样本
        data_sample = ""
        if request.language_data and len(request.language_data) > 0:
            sample_langs = request.language_data[:5]
            data_sample = "\n=== 数据样本 (5种语言) ===\n"
            for lang in sample_langs:
                name = lang.get('Name') or lang.get('name', '')
                family = lang.get('Family_level_ID') or lang.get('family', '')
                features_str = ', '.join([
                    f"{k}={v}" for k, v in list(lang.items())[:10]
                    if k not in ['Name', 'name', 'Family_level_ID', 'family']
                ])
                data_sample += f"{name} ({family}): {features_str}\n"
        
        # 6. 构建 LLM 提示
        # 构建特征列表字符串
        features_text = "\n".join([
            f"{feature.get('id', '')} ({feature.get('source', '')}): {feature.get('name', '')}\n  分类: {feature.get('category', '')}\n  描述: {clean_description(feature.get('description', ''))[:150]}..."
            for feature in search_results
        ])
        
        current_features_text = ', '.join(current_features)
        if len(current_features) > 20:
            current_features_text += '...'
        
        prompt = f"""你是一位专业的语言学数据分析专家。现在你有机会探索完整的语言学数据库和知识库（研究文献）来为用户推荐最相关的特征。

=== 用户问题 ===
{request.user_query}

=== 完整数据库信息 ===
Grambank数据库: {stats.get('totalGrambankFeatures', 0)} 个语法特征
D-PLACE数据库: {stats.get('totalDplaceFeatures', 0)} 个社会文化特征

=== 搜索到的相关特征（CSV数据库）({len(search_results)}个) ===
{features_text}
{knowledge_base_context}

=== 当前数据中的特征 ({len(current_features)}个) ===
{current_features_text}
{data_sample}

=== 任务 ===
请分析用户问题，从完整数据库和知识库中推荐最相关的特征。你可以：
1. 从搜索到的相关特征（CSV数据库）中选择
2. 参考知识库（PDF文献）中提到的特征和研究发现
3. 从当前数据中的特征中选择
4. 推荐数据库中其他相关特征

请按以下JSON格式返回推荐：

{{
  "recommendations": [
    {{
      "category": "特征分类名称",
      "name": "推荐组名称", 
      "description": "推荐理由",
      "features": ["特征ID1", "特征ID2", "特征ID3"],
      "reason": "为什么推荐这些特征（可以引用知识库中的研究发现）",
      "source": "Grambank/D-PLACE/Knowledge Base/Current Data"
    }}
  ]
}}

要求：
1. 优先推荐搜索到的相关特征（CSV数据库）
2. 如果知识库中有相关研究，可以参考并引用
3. 确保推荐的特征在数据库中实际存在
4. 考虑特征之间的关联性和互补性
5. 提供清晰的推荐理由，可以结合知识库中的研究发现
6. 标注特征来源（Grambank/D-PLACE/Knowledge Base/当前数据）"""
        
        # 7. 调用 LLM 获取推荐
        if api_provider == "qianwen":
            response_text = await call_qianwen_api_for_recommendation(prompt, api_key)
        else:
            response_text = await call_gemini_api(prompt, api_key)
        
        # 8. 解析响应
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                parsed = json.loads(json_match.group(0))
                if parsed.get("recommendations"):
                    # 验证特征是否存在
                    all_feature_ids = get_all_feature_ids()
                    valid_gb = set(all_feature_ids.get('grambank', []))
                    valid_ea = set(all_feature_ids.get('dplace', []))
                    
                    for rec in parsed["recommendations"]:
                        valid_features = []
                        for feature_id in rec.get("features", []):
                            if feature_id in valid_gb or feature_id in valid_ea or 'Richness' in feature_id:
                                valid_features.append(feature_id)
                        rec["features"] = valid_features
                    
                    # 过滤掉没有有效特征的推荐
                    parsed["recommendations"] = [
                        rec for rec in parsed["recommendations"]
                        if len(rec.get("features", [])) > 0
                    ]
                    
                    return parsed
            except json.JSONDecodeError as e:
                logger.warning(f"LLM响应解析失败: {e}")
        
        # 如果解析失败，返回空推荐
        return {"recommendations": []}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"特征推荐失败: {e}")
        raise HTTPException(status_code=500, detail=f"特征推荐失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT) 