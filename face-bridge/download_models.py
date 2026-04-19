import os
from insightface.app import FaceAnalysis

def download():
    print("🚀 Starting download of InsightFace models (buffalo_s)...")
    # This will trigger the automatic download of the buffalo_s model package
    # and store it in the default (~/.insightface/models) directory.
    app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("✅ Models downloaded and initialized successfully.")

if __name__ == "__main__":
    download()
