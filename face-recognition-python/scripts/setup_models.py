import os
import requests

def download_from_url(url, filename):
    print(f"Trying source: {url}")
    try:
        r = requests.get(url, stream=True, timeout=15)
        r.raise_for_status()
        total_size = int(r.headers.get('content-length', 0))
        
        with open(filename, 'wb') as f:
            downloaded = 0
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    downloaded += len(chunk)
                    f.write(chunk)
                    if total_size > 0:
                        percent = int(100 * downloaded / total_size)
                        print(f"\rProgress: {percent}%", end="")
        
        # Verify result is a real file and not an HTML error page
        if os.path.getsize(filename) > 100000:
            print("\nDownload Successful!")
            return True
        else:
            print("\nFile too small, possibly corrupted version.")
            os.remove(filename)
            return False
    except Exception as e:
        print(f"\nSource failed: {e}")
        if os.path.exists(filename):
            os.remove(filename)
        return False

def setup():
    os.makedirs('models', exist_ok=True)
    path = os.path.join('models', 'arcface.onnx')
    
    # List of reliable sources for the MobileFaceNet ArcFace model
    sources = [
        "https://huggingface.co/marconet/arcface-mobilefacenet-onnx/resolve/main/arcface-mobilefacenet.onnx",
        "https://huggingface.co/garavv/arcface-onnx/resolve/main/arc.onnx",
        "https://github.com/onnx/models/raw/main/vision/body_analysis/arcface/model/arcface-mobilefacenet.onnx",
        "https://github.com/Open-Biometrics/Face-Recognition-Models/raw/main/ArcFace/arcface_mobilefacenet.onnx"
    ]
    
    if os.path.exists(path):
        os.remove(path)
        
    print("Attempting to download ArcFace model from multiple sources...")
    
    success = False
    for url in sources:
        if download_from_url(url, path):
            success = True
            break
            
    if success:
        print(f"\nSUCCESS: ArcFace model is ready at {path}")
        print("You can now start the service with: python app.py")
    else:
        print("\nFATAL ERROR: All sources failed.")
        print("Please check your internet or manually download a model from one of the URLs and save it as 'models/arcface.onnx'")

if __name__ == "__main__":
    setup()
