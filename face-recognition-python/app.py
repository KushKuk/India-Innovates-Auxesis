import base64
import os
import numpy as np
import cv2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from core.engine import get_engine

app = FastAPI(title="Face Bridge Service (ArcFace)")

# Initialize engine
engine = get_engine(model_path='models/arcface.onnx')

class VerifyRequest(BaseModel):
    live_image: str  # Base64 string
    stored_embedding: Optional[List[float]] = None
    ref_image: Optional[str] = None  # Path on disk

class ExtractRequest(BaseModel):
    image: str  # Base64 string

@app.get("/health")
async def health():
    return {
        "status": "online",
        "model": "arcface-buffalo-s",
        "cpu_temp": "N/A" # Would normally read from /sys/class/thermal/thermal_zone0/temp on Pi
    }

@app.post("/verify")
async def verify(req: VerifyRequest):
    try:
        # 1. Get Live Embedding
        live_data = base64.b64decode(req.live_image.split(",")[-1])
        live_feat, status = engine.get_embedding(live_data)
        
        if status != "SUCCESS":
            return {"match": False, "confidence": 0, "reason": status}

        # 2. Get Reference Embedding
        ref_feat = None
        if req.stored_embedding:
            ref_feat = np.array(req.stored_embedding, dtype=np.float32)
        elif req.ref_image:
            if not os.path.exists(req.ref_image):
                return {"match": False, "confidence": 0, "reason": "REF_IMAGE_NOT_FOUND"}
            with open(req.ref_image, 'rb') as f:
                ref_data = f.read()
            ref_feat, status = engine.get_embedding(ref_data)
            if status != "SUCCESS":
                return {"match": False, "confidence": 0, "reason": f"REF_ERR_{status}"}
        
        if ref_feat is None:
            return {"match": False, "confidence": 0, "reason": "NO_REFERENCE_DATA"}

        # 3. Compute Similarity
        similarity = engine.compute_similarity(live_feat, ref_feat)
        threshold = 0.45 # Buffalo_S threshold
        
        return {
            "match": bool(similarity > threshold),
            "confidence": float(similarity),
            "threshold": threshold
        }
    except Exception as e:
        print(f"Error in /verify: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract")
async def extract(req: ExtractRequest):
    try:
        image_data = base64.b64decode(req.image.split(",")[-1])
        embedding, status = engine.get_embedding(image_data)
        
        if status != "SUCCESS":
            return {"status": "error", "reason": status}
            
        return {
            "status": "success",
            "embedding": embedding.tolist()
        }
    except Exception as e:
        print(f"Error in /extract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
