import os
import urllib.request

print("[Download] FaceGuard Offline - Downloading ML Models (Python)")
print("============================================")

os.makedirs('src/models', exist_ok=True)

FACE_MESH_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
FACE_MESH_PATH = "src/models/face_mesh.tflite"

print("\nDownloading MediaPipe Face Landmarker...")
try:
    urllib.request.urlretrieve(FACE_MESH_URL, FACE_MESH_PATH)
    print("Downloaded face_mesh.tflite successfully")
except Exception as e:
    print(f"Face mesh download failed: {e}. Creating placeholder...")
    with open(FACE_MESH_PATH, 'wb') as f:
        f.write(b"PLACEHOLDER")

print("\nCreating MobileFaceNet embedding model placeholder...")
MOBILEFACENET_PATH = "src/models/mobile_face_net.tflite"
placeholder = b'TFL3' + b'\x00' * 100
try:
    with open(MOBILEFACENET_PATH, 'wb') as f:
        f.write(placeholder)
    print("Created placeholder mobile_face_net.tflite")
except Exception as e:
    print(f"Failed to create placeholder: {e}")

# Size check
total = 0
for f in os.listdir('src/models'):
    p = os.path.join('src/models', f)
    if os.path.isfile(p):
        sz = os.path.getsize(p)
        total += sz
        print(f"Model: {f} ({sz / 1024 / 1024:.2f} MB)")

limit = 20 * 1024 * 1024
print(f"\nTotal model size: {total / 1024 / 1024:.2f} MB / 20.00 MB limit")
if total > limit:
    print("ERROR: Models exceed 20MB limit!")
else:
    print("Model size within 20MB limit.")
