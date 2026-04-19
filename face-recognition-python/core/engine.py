import os
import cv2
import numpy as np
import onnxruntime as ort
from numpy.linalg import norm

class FaceEngine:
    def __init__(self, rec_path='models/arcface.onnx'):
        # 1. Initialize Built-in OpenCV Face Detector (No download required)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_detector = cv2.CascadeClassifier(cascade_path)
        
        # 2. Initialize ONNX runtime for ArcFace
        if not os.path.exists(rec_path):
            raise FileNotFoundError(f"Missing biometric model file at {rec_path}. Please run setup_models.py first.")
        
        self.rec_session = ort.InferenceSession(rec_path, providers=['CPUExecutionProvider'])
        self.rec_input_name = self.rec_session.get_inputs()[0].name
        
        print(f"FaceEngine initialized with Built-in OpenCV Detector + ArcFace ONNX")

    def _detect_faces(self, img):
        # Convert to grayscale for Haarcascade
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_detector.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return None
            
        # Return the largest face detected
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        return faces[0] # (x, y, w, h)

    def _preprocess_rec(self, img, bbox):
        x, y, bw, bh = bbox
        h, w, _ = img.shape
        
        # Crop with 15% margin
        margin = 0.15
        nx = max(0, int(x - bw * margin))
        ny = max(0, int(y - bh * margin))
        nx2 = min(w, int(x + bw * (1 + margin)))
        ny2 = min(h, int(y + bh * (1 + margin)))
        
        face_img = img[ny:ny2, nx:nx2]
        if face_img.size == 0:
            return None

        # Standard ArcFace Input
        face_img = cv2.resize(face_img, (112, 112))
        face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_img = (face_img.astype(np.float32) - 127.5) / 128.0
        # face_img = face_img.transpose(2, 0, 1) # Removed: Model expects NHWC (1, 112, 112, 3), not NCHW
        return np.expand_dims(face_img, axis=0)

    def get_embedding(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None, "Failed to decode image"

        # 1. Detect (Using Built-in OpenCV)
        bbox = self._detect_faces(img)
        if bbox is None:
            return None, "NO_FACE"

        # 2. Extract Embedding (Using ArcFace ONNX)
        rec_input = self._preprocess_rec(img, bbox)
        if rec_input is None:
            return None, "CROP_FAILED"

        outputs = self.rec_session.run(None, {self.rec_input_name: rec_input})
        embedding = outputs[0][0]
        
        # L2 Normalize
        embedding = embedding / (norm(embedding) + 1e-6)
        return embedding, "SUCCESS"

    def compute_similarity(self, feat1, feat2):
        return float(np.dot(feat1, feat2))

# Singleton instance
engine = None
def get_engine(model_path=None):
    global engine
    if engine is None:
        engine = FaceEngine()
    return engine
