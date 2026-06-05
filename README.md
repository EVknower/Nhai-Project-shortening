# 🛡️ FaceGuard Offline

**100% Offline · AES-256 Encrypted · On-Device AI · DPDP Act 2023 Compliant**

A production-ready facial recognition + liveness detection attendance system for Android 8+ and iOS 12+. All biometric processing happens on-device — zero cloud dependency for core functionality.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Face Recognition** | MobileFaceNet INT8 TFLite, 128-dim embeddings, cosine similarity |
| **Liveness Detection** | EAR blink detection, MAR smile, head pose estimation |
| **Security** | AES-256-CBC encrypted SQLite, PBKDF2 key derivation, device integrity checks |
| **Offline-first** | Full functionality without internet; AWS sync is optional |
| **Multi-angle Enrollment** | 5 angles (FRONT, LEFT, RIGHT, UP, DOWN) per employee |
| **Sync Queue** | Exponential backoff, dead-letter handling, conflict resolution |

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Node.js 18+
- React Native CLI (`npm install -g @react-native-community/cli`)
- Android Studio (for Android) or Xcode 14+ (for iOS)
- Python 3.9+ (optional, for model training scripts)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd FaceGuardOffline
npm install --legacy-peer-deps
```

### 2. Download ML Models

```bash
bash scripts/download_models.sh
```

Place the model files in `src/models/`:
- `face_mesh.tflite` (~3MB) — MediaPipe Face Landmarker
- `mobile_face_net.tflite` (~5MB) — MobileFaceNet INT8

### 3. Android

```bash
# Start Metro bundler
npx react-native start

# Run on device/emulator
npx react-native run-android
```

### 4. iOS

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

---

## 📱 Using the App

1. **Launch** → Splash screen runs device integrity check + loads ML models (~1.5s)
2. **Register Employee** → Fill name, code, department → Tap "Register & Enroll Face"
3. **Face Enrollment** → Follow prompts: FRONT → LEFT → RIGHT → UP → DOWN (auto-capture)
4. **Mark Attendance** → Tap "Tap to Scan" → Face detected → Complete liveness challenge
5. **Records** → View all attendance records, filter by status/date
6. **Sync** → Tap "Sync Now" when online to push records to AWS

---

## 🧪 Testing

```bash
# All tests
npm test

# With coverage report
npm test -- --coverage

# Single test file
npm test FaceMatchingService

# Watch mode
npm test -- --watch
```

### Test Coverage

| Module | Tests |
|--------|-------|
| `cosineDistance` | Similarity, orthogonal, opposite, zero vectors |
| `FaceMatchingService` | Match threshold, multi-candidate, confidence levels |
| `LivenessService` | EAR calculation, challenge generation, action detection |
| `EmployeeRepository` | CRUD, soft delete, mark synced |
| `AttendanceFlow` | Full integration: register→enroll→match→record |

---

## 🤖 ML Models

### MobileFaceNet (Embedding Model)
- Architecture: 22 depthwise separable conv layers
- Input: 112×112×3 normalized face image
- Output: 128-dimensional L2-normalized embedding
- Quantization: INT8 (reduces size ~4×, minimal accuracy loss)
- Target size: ~4.8MB

### MediaPipe Face Mesh (Detection Model)
- 468 facial landmarks with 3D coordinates
- Used for: face detection, eye/mouth landmarks, head pose estimation
- Target size: ~3MB

**Total model budget: < 20MB** ✅

### Training Your Own Model

```bash
# Prepare your dataset in:
# weights/mobilefacenet_asia.h5 (trained weights)

python scripts/train_mobilefacenet.py
```

---

## 🔒 Security Architecture

```
Camera Frame
    │
    ▼
Face Detection (MediaPipe)
    │ 468 landmarks
    ▼
ROI Extraction + Alignment
    │ 112×112 face crop
    ▼
MobileFaceNet Inference
    │ 128-dim embedding
    ▼
Cosine Similarity Match
    │ vs encrypted DB embeddings
    ▼
Liveness Challenge
    │ Blink/Smile/Turn
    ▼
Attendance Record
    │ AES-256 encrypted SQLite
    ▼
Sync Queue (offline-first)
    │ Exponential backoff
    ▼
AWS API (optional)
```

### Key Security Properties

- **Encryption**: AES-256-CBC with random IV per record
- **Key Storage**: PBKDF2 (100k iterations) derived key in Android Keystore / iOS Secure Enclave
- **Device Integrity**: Root detection, emulator detection, app bundle validation
- **Liveness**: Prevents photo/video spoofing via behavioral biometrics

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```env
AWS_API_ENDPOINT=https://your-api.execute-api.ap-south-1.amazonaws.com/prod
APP_VERSION=1.0.0
```

### Recognition Thresholds

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Match Threshold | 0.75 | 0.60–0.95 | Cosine similarity required for a match |
| Liveness Required | ON | — | Require challenge completion |

Adjust these in **Settings** → **Recognition Settings**.

---

## 📁 Project Structure

```
src/
├── types/          # TypeScript interfaces
├── database/       # SQLite manager + 4 repositories
│   ├── migrations/ # Versioned schema migrations
│   └── repositories/
├── services/       # Business logic
│   ├── EncryptionService.ts
│   ├── LivenessService.ts
│   ├── FaceMatchingService.ts
│   ├── DeviceIntegrityService.ts
│   └── SyncService.ts
├── ml/             # TFLite model wrappers
│   ├── ModelLoader.ts
│   ├── FaceDetector.ts
│   └── EmbeddingExtractor.ts
├── hooks/          # React hooks
├── screens/        # 9 UI screens
├── navigation/     # Stack + Tab navigator
└── utils/          # Logger, cosine math, frame processing
```

---

## 🛠️ Troubleshooting

| Error | Fix |
|-------|-----|
| `tflite model not found` | Run `bash scripts/download_models.sh` |
| `camera permission denied` | Check AndroidManifest / Info.plist permissions |
| `SQLite not opening` | Check `react-native-sqlite-storage` native link |
| `metro can't resolve .tflite` | Ensure `tflite` is in `assetExts` in `metro.config.js` |
| `crypto-js encrypt undefined` | Import as `import CryptoJS from 'crypto-js'` |
| `pod install fails` | Run `cd ios && pod deintegrate && pod install` |
| `npm install fails` | Use `npm install --legacy-peer-deps` |

---

## 📋 DPDP Act 2023 Compliance

- ✅ All biometric data stored exclusively on-device
- ✅ AES-256 encryption for biometric embeddings
- ✅ No raw face images stored — only mathematical embeddings
- ✅ Employee consent required before enrollment
- ✅ Data deletion available via Settings → Clear All Data
- ✅ Audit trail for all attendance records

---

## 📄 License

MIT — See LICENSE file.

---

*FaceGuard Offline — Production-Ready · Hackathon-Winning · 100% Offline AI*
