from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
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

from knowledge_base import init_knowledge_base, get_knowledge_base, LinguisticKnowledgeBase

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT) 