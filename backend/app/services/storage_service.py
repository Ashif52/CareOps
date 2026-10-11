import os
import uuid
import hashlib
import base64
from pathlib import Path
from typing import Tuple, Optional
from fastapi import UploadFile, HTTPException
from app.config import settings

class StorageService:
    @staticmethod
    def save_upload_file(file: UploadFile, subfolder: str = "evidence") -> Tuple[str, str, int]:
        """Saves an UploadFile, returns (relative_url, sha256_hash, file_size_bytes)"""
        target_dir = Path(settings.UPLOAD_DIR) / subfolder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        file_ext = Path(file.filename).suffix.lower() if file.filename else ".bin"
        filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = target_dir / filename
        
        sha256 = hashlib.sha256()
        size = 0
        
        with open(file_path, "wb") as f:
            while chunk := file.file.read(8192):
                sha256.update(chunk)
                size += len(chunk)
                if size > settings.MAX_UPLOAD_SIZE_BYTES:
                    f.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail="File size exceeds allowable maximum (50MB)")
                f.write(chunk)
                
        relative_url = f"/uploads/{subfolder}/{filename}"
        return relative_url, sha256.hexdigest(), size

    @staticmethod
    def save_base64_data(base64_data: str, subfolder: str = "evidence", default_ext: str = ".jpg") -> Tuple[str, str, int]:
        """Decodes and saves base64 data URI (e.g. data:image/jpeg;base64,...)"""
        target_dir = Path(settings.UPLOAD_DIR) / subfolder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        ext = default_ext
        if "," in base64_data:
            header, encoded = base64_data.split(",", 1)
            if "image/png" in header:
                ext = ".png"
            elif "image/webp" in header:
                ext = ".webp"
            elif "image/jpeg" in header or "image/jpg" in header:
                ext = ".jpg"
            elif "video/mp4" in header:
                ext = ".mp4"
            elif "video/webm" in header:
                ext = ".webm"
            elif "audio/webm" in header:
                ext = ".webm"
            elif "audio/wav" in header:
                ext = ".wav"
        else:
            encoded = base64_data
            
        file_bytes = base64.b64decode(encoded)
        size = len(file_bytes)
        
        if size > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded media exceeds maximum permitted size")
            
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = target_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        relative_url = f"/uploads/{subfolder}/{filename}"
        return relative_url, file_hash, size
