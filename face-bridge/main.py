import os
import cv2
import numpy as np
import base64
from fastapi import FastAPI, HTTPException, Body
from insightface.app import FaceAnalysis
from typing import List, Optional
import io
from PIL import Image

app = FastAPI(title="India Innovates Face Bridge")

# Initialize InsightFace with buffalo_s (Optimized for Pi 5)
# ctx_id=0 for CPU. -1 uses CPU, but 0 is standard for the first device.
# name='buffalo_s' is the lightweight model for edge devices.
face_app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))

def decode_base64_image(base64_str):
    try:
        if "data:image" in base64_str:
            base64_str = base64_str.split(",")[1]
        img_data = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_data))
        # Convert to RGB if it's not
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

@app.post("/extract")
async def extract_embedding(
    image: Optional[str] = Body(None),
    image_path: Optional[str] = Body(None)
):
    """
    Extracts a 512-d embedding from an image.
    Supports either base64 'image' or file 'image_path'.
    """
    img = None
    if image:
        img = decode_base64_image(image)
    elif image_path:
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"Image not found at {image_path}")
        img = cv2.imread(image_path)
    
    if img is None:
        raise HTTPException(status_code=400, detail="No image or image_path provided")

    faces = face_app.get(img)
    
    if len(faces) == 0:
        return {"status": "error", "reason": "No face detected"}
    if len(faces) > 1:
        return {"status": "error", "reason": "Multiple faces detected"}
    
    # Embedding is a numpy array, convert to list for JSON response
    embedding = faces[0].embedding.tolist()
    return {"status": "success", "embedding": embedding}

@app.post("/verify")
async def verify_face(
    live_image: str = Body(...),
    stored_embedding: Optional[List[float]] = Body(None),
    ref_image: Optional[str] = Body(None)
):
    """
    Verifies a live face against either a stored embedding or a reference image path.
    Prioritizes stored embedding for speed.
    """
    live_img = decode_base64_image(live_image)
    live_faces = face_app.get(live_img)
    
    if len(live_faces) == 0:
        return {"match": False, "confidence": 0, "reason": "No face detected in live capture"}
    
    live_embedding = live_faces[0].embedding
    
    target_embedding = None
    
    # 1. Use stored embedding if provided (O(1) approach)
    if stored_embedding:
        target_embedding = np.array(stored_embedding)
    
    # 2. Fallback to reference image path if embedding not provided
    elif ref_image:
        # Resolve relative paths coming from Docker-aware backend
        # On Windows, paths might have backslashes; normalize them for Linux container
        normalized_path = ref_image.replace('\\', '/')
        
        # If it doesn't start with /app, it's likely a relative path from the backend
        # which we map to /app/backend/
        if not normalized_path.startswith('/'):
            # Check common mount points
            candidate_paths = [
                os.path.join("/app/backend", normalized_path),
                os.path.join("/app", normalized_path),
                normalized_path
            ]
            
            ref_image = None
            for p in candidate_paths:
                if os.path.exists(p):
                    ref_image = p
                    break
        
        if not ref_image or not os.path.exists(ref_image):
            return {"match": False, "confidence": 0, "reason": f"Reference image not found at {normalized_path}"}
        
        ref_img = cv2.imread(ref_image)
        ref_faces = face_app.get(ref_img)
        if len(ref_faces) == 0:
            return {"match": False, "confidence": 0, "reason": "No face detected in reference image"}
        target_embedding = ref_faces[0].embedding
        
    if target_embedding is None:
        return {"match": False, "confidence": 0, "reason": "No reference data provided"}

    # Calculate Cosine Similarity
    sim = np.dot(live_embedding, target_embedding) / (np.linalg.norm(live_embedding) * np.linalg.norm(target_embedding))
    
    # ArcFace threshold is typically 0.4 - 0.5 depending on the model/security needs.
    # buffalo_s works well with 0.45 threshold.
    threshold = 0.45
    match = bool(sim > threshold)
    
    return {
        "match": match,
        "confidence": float(sim),
        "threshold": threshold,
        "status": "success"
    }

@app.get("/health")
async def health():
    """Health check with basic thermal monitoring for Raspberry Pi."""
    temp = "N/A"
    try:
        # Raspberry Pi specific thermal check
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                temp = f"{int(f.read()) / 1000.0}°C"
    except:
        pass
        
    return {
        "status": "online",
        "model": "arcface-buffalo-s",
        "cpu_temp": temp,
        "environment": "docker"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
