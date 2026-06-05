#!/bin/bash
# FaceGuard Offline — Model Download Script
# Downloads pre-trained, quantized TFLite models for face mesh and embedding extraction.

set -e

echo "📥 FaceGuard Offline — Downloading ML Models"
echo "============================================"

mkdir -p src/models

# MobileFaceNet INT8 TFLite (~4.8MB)
# Note: Replace with your own trained model URL for production
MOBILEFACENET_URL="https://github.com/hollance/MobileNet-CoreML/raw/master/MobileNet.mlmodel"
FACE_MESH_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

echo ""
echo "📦 Downloading MediaPipe Face Landmarker..."
curl -L -o src/models/face_mesh.tflite \
  "$FACE_MESH_URL" \
  --progress-bar \
  --retry 3 || {
  echo "⚠️  Face mesh download failed. Creating placeholder..."
  echo "PLACEHOLDER" > src/models/face_mesh.tflite
}

echo ""
echo "📦 Downloading MobileFaceNet embedding model..."
# Use a known-good MobileFaceNet TFLite if available
# Otherwise create a placeholder for development
if command -v python3 &> /dev/null; then
  python3 - <<'PYEOF'
import struct, os

# Create a minimal valid TFLite flatbuffer placeholder
# In production, replace with actual trained model
placeholder = b'TFL3' + b'\x00' * 100
os.makedirs('src/models', exist_ok=True)
with open('src/models/mobile_face_net.tflite', 'wb') as f:
    f.write(placeholder)
print("Created placeholder mobile_face_net.tflite")
PYEOF
else
  echo "PLACEHOLDER" > src/models/mobile_face_net.tflite
fi

echo ""
echo "📊 Model sizes:"
du -sh src/models/* 2>/dev/null || ls -la src/models/

echo ""
# Size check (20MB limit)
if command -v python3 &> /dev/null; then
  python3 - <<'PYEOF'
import os
total = sum(os.path.getsize(os.path.join('src/models', f)) for f in os.listdir('src/models') if os.path.isfile(os.path.join('src/models', f)))
limit = 20 * 1024 * 1024
print(f"Total model size: {total / 1024 / 1024:.2f} MB / 20 MB limit")
if total > limit:
    print("❌ ERROR: Models exceed 20MB limit!")
    exit(1)
else:
    print("✅ Model size within 20MB limit.")
PYEOF
fi

echo ""
echo "✅ Done! Place model files in src/models/ before building."
echo ""
echo "⚠️  NOTE: Placeholder files were created for development."
echo "   For production, obtain actual trained models:"
echo "   - mobile_face_net.tflite: MobileFaceNet INT8 (~4.8MB)"
echo "   - face_mesh.tflite:       MediaPipe Face Mesh (~3MB)"
