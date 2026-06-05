import os
import urllib.request
import zipfile

print("[Setup] Extracting and Downloading Real TFLite Models")
print("=====================================================")

os.makedirs('src/models', exist_ok=True)

# 1. Extract face_landmarks_detector.tflite from face_landmarker.task if it was downloaded
task_path = 'src/models/face_mesh.tflite'
if os.path.exists(task_path):
    print("Checking if face_mesh.tflite is a task ZIP archive...")
    try:
        with zipfile.ZipFile(task_path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            print(f"ZIP contents: {file_list}")
            if 'face_landmarks_detector.tflite' in file_list:
                print("Extracting face_landmarks_detector.tflite...")
                extracted_data = zip_ref.read('face_landmarks_detector.tflite')
                # Overwrite face_mesh.tflite with the raw extracted model
                with open(task_path, 'wb') as f:
                    f.write(extracted_data)
                print("Successfully updated face_mesh.tflite to raw TFLite model.")
            else:
                print("face_landmarks_detector.tflite not found in ZIP.")
    except zipfile.BadZipFile:
        print("face_mesh.tflite is not a ZIP file or is already extracted. Skipping extraction.")
else:
    print("face_mesh.tflite does not exist. Please run scripts/download_models.py first.")

# 2. Download a real MobileFaceNet tflite model
MOBILEFACENET_URL = "https://github.com/shubham0204/OnDevice-Face-Recognition-Android/raw/master/app/src/main/assets/mobilefacenet.tflite"
MOBILE_NET_PATH = "src/models/mobile_face_net.tflite"

print("\nDownloading pre-trained MobileFaceNet model from GitHub...")
try:
    # Set a User-Agent to avoid HTTP 403 Forbidden
    req = urllib.request.Request(
        MOBILEFACENET_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    with urllib.request.urlopen(req) as response:
        data = response.read()
    with open(MOBILE_NET_PATH, 'wb') as f:
        f.write(data)
    print("Downloaded mobile_face_net.tflite successfully.")
except Exception as e:
    print(f"MobileFaceNet download failed: {e}. Trying fallback URL...")
    # Try another known repo if the first one fails
    FALLBACK_URL = "https://github.com/MCarlomagno/FaceRecognitionAuth/raw/master/assets/mobilefacenet.tflite"
    try:
        req = urllib.request.Request(
            FALLBACK_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            data = response.read()
        with open(MOBILE_NET_PATH, 'wb') as f:
            f.write(data)
        print("Downloaded mobile_face_net.tflite successfully from fallback.")
    except Exception as e2:
        print(f"Fallback download failed: {e2}.")

# 3. Print final sizes
total = 0
for file in os.listdir('src/models'):
    p = os.path.join('src/models', file)
    if os.path.isfile(p):
        sz = os.path.getsize(p)
        total += sz
        print(f"Model File: {file} ({sz / 1024 / 1024:.2f} MB)")

print(f"\nTotal model size: {total / 1024 / 1024:.2f} MB")
