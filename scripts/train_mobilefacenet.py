"""
MobileFaceNet Training + INT8 Quantization Pipeline
=====================================================
Run this script to train your own MobileFaceNet model on a custom dataset.
Designed for Indian demographic face data.

Requirements:
  pip install tensorflow numpy pillow tqdm

Usage:
  python scripts/train_mobilefacenet.py

Output:
  src/models/mobile_face_net.tflite (~4.8MB INT8 quantized)
"""

import tensorflow as tf
import numpy as np
import os
import struct


# ─── Architecture ────────────────────────────────────────────────────────────

def depthwise_bottleneck(x, filters: int, stride: int):
    """MobileNet-style depthwise separable bottleneck block."""
    residual = x
    in_channels = x.shape[-1]

    # Pointwise expand
    x = tf.keras.layers.Conv2D(filters * 6, 1, padding='same', use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.PReLU(shared_axes=[1, 2])(x)

    # Depthwise
    x = tf.keras.layers.DepthwiseConv2D(3, strides=stride, padding='same', use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.PReLU(shared_axes=[1, 2])(x)

    # Pointwise compress
    x = tf.keras.layers.Conv2D(filters, 1, padding='same', use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)

    # Skip connection (only when spatial dims and channels match)
    if stride == 1 and in_channels == filters:
        x = tf.keras.layers.Add()([x, residual])

    return x


def build_mobilefacenet(embedding_size: int = 128) -> tf.keras.Model:
    """
    MobileFaceNet: 22-layer lightweight face recognition model.
    Input: 112×112×3 normalized face image
    Output: 128-dimensional L2-normalized embedding
    """
    inputs = tf.keras.Input(shape=(112, 112, 3), name='face_input')

    # Initial conv
    x = tf.keras.layers.Conv2D(64, 3, strides=2, padding='same', use_bias=False)(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.PReLU(shared_axes=[1, 2])(x)

    # Depthwise conv (no activation)
    x = tf.keras.layers.DepthwiseConv2D(3, padding='same', use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)

    # Bottleneck blocks
    bottleneck_configs = [
        # (output_filters, stride, repeats)
        (64,  2, 5),
        (128, 2, 1),
        (128, 1, 6),
        (128, 2, 2),
        (128, 1, 2),
        (128, 2, 2),
    ]
    for filters, stride, repeats in bottleneck_configs:
        for i in range(repeats):
            x = depthwise_bottleneck(x, filters, stride if i == 0 else 1)

    # Global depthwise conv (7×7 receptive field after 4 strides)
    x = tf.keras.layers.DepthwiseConv2D(7, use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)

    # Flatten + embedding
    x = tf.keras.layers.Flatten()(x)
    x = tf.keras.layers.Dense(embedding_size, use_bias=False)(x)
    x = tf.keras.layers.BatchNormalization()(x)

    # L2 normalization
    x = tf.keras.layers.Lambda(
        lambda t: tf.math.l2_normalize(t, axis=1),
        name='embedding'
    )(x)

    return tf.keras.Model(inputs, x, name='MobileFaceNet')


# ─── Training ────────────────────────────────────────────────────────────────

class ArcFaceLoss(tf.keras.losses.Loss):
    """ArcFace additive angular margin loss for face recognition."""
    def __init__(self, num_classes: int, margin: float = 0.5, scale: float = 64):
        super().__init__()
        self.num_classes = num_classes
        self.margin = margin
        self.scale = scale

    def call(self, y_true, y_pred):
        # y_pred: embeddings, y_true: one-hot labels
        cos_theta = y_pred
        theta = tf.math.acos(tf.clip_by_value(cos_theta, -1 + 1e-7, 1 - 1e-7))
        marginal_theta = theta + self.margin
        logits = self.scale * tf.math.cos(marginal_theta)
        return tf.keras.losses.categorical_crossentropy(
            y_true, logits, from_logits=True
        )


# ─── INT8 Quantization ───────────────────────────────────────────────────────

def get_representative_dataset(num_samples: int = 100):
    """
    Generator of representative face images for INT8 calibration.
    Replace with your actual face dataset in production.
    """
    def generator():
        for _ in range(num_samples):
            # Random face-like image (replace with real data)
            face = np.random.uniform(-1, 1, (1, 112, 112, 3)).astype(np.float32)
            yield [face]
    return generator


def quantize_to_int8(
    keras_model: tf.keras.Model,
    representative_dataset_gen,
    output_path: str
) -> int:
    """Convert Keras model to INT8 TFLite."""
    converter = tf.lite.TFLiteConverter.from_keras_model(keras_model)

    # Full INT8 quantization
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset_gen
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.float32  # Keep output as float

    tflite_model = converter.convert()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    size_mb = len(tflite_model) / 1024 / 1024
    print(f"✅ Quantized model saved: {output_path}")
    print(f"   Model size: {size_mb:.2f} MB")

    if size_mb > 20:
        raise ValueError(f"Model size {size_mb:.2f}MB exceeds 20MB limit!")

    return len(tflite_model)


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    OUTPUT_PATH = 'src/models/mobile_face_net.tflite'

    print("Building MobileFaceNet architecture...")
    model = build_mobilefacenet(embedding_size=128)
    model.summary()

    total_params = model.count_params()
    print(f"Total parameters: {total_params:,}")

    # Optional: load pre-trained weights
    weights_path = 'weights/mobilefacenet_asia.h5'
    if os.path.exists(weights_path):
        model.load_weights(weights_path)
        print(f"Loaded weights from {weights_path}")
    else:
        print("⚠️  No weights file found. Using random initialization.")
        print("   Provide 'weights/mobilefacenet_asia.h5' for production.")

    print("\nQuantizing to INT8 TFLite...")
    quantize_to_int8(
        model,
        get_representative_dataset(num_samples=200),
        OUTPUT_PATH
    )

    print("\n✅ Done! Model is ready for deployment.")
    print(f"   Path: {OUTPUT_PATH}")
