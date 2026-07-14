"""
Objective character-consistency measurement for thesis Chuong 6, muc 6.4.1(b).

Compares a reference portrait against two sets of generated panels (config A:
prompt-only, config B: prompt + IP-Adapter reference) using ArcFace face
embeddings, and prints the mean/median/std/detection-rate table in the same
shape as the draft's table so it can be pasted straight into KhoaLuan_Draft.md.

Setup (one-off, not added to requirements.txt):
    pip install insightface onnxruntime opencv-python numpy
    # On Apple Silicon, onnxruntime-silicon may be needed instead of onnxruntime.

Usage:
    python eval_character_consistency.py \
        --reference path/to/portrait.png \
        --config-a path/to/panels_prompt_only/ \
        --config-b path/to/panels_with_reference/
"""

import argparse
import statistics
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def load_face_analyzer():
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def extract_embedding(app, image_path):
    image = cv2.imread(str(image_path))
    if image is None:
        return None
    faces = app.get(image)
    if not faces:
        return None
    largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return largest_face.normed_embedding


def cosine_similarity(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def list_images(directory):
    return sorted(p for p in Path(directory).iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS)


def evaluate_config(app, reference_embedding, panel_dir):
    similarities = []
    detected = 0
    total = 0
    for image_path in list_images(panel_dir):
        total += 1
        embedding = extract_embedding(app, image_path)
        if embedding is None:
            continue
        detected += 1
        similarities.append(cosine_similarity(reference_embedding, embedding))

    return {
        "n": total,
        "detected": detected,
        "mean": statistics.mean(similarities) if similarities else None,
        "median": statistics.median(similarities) if similarities else None,
        "stdev": statistics.stdev(similarities) if len(similarities) > 1 else None,
        "detection_rate": (detected / total * 100) if total else 0.0,
    }


def format_value(value, precision=3):
    return f"{value:.{precision}f}" if value is not None else "…"


def print_markdown_table(result_a, result_b):
    print("| Chỉ số (cosine với ảnh tham chiếu) | (A) Chỉ prompt | (B) Prompt + IP-Adapter |")
    print("|---|---|---|")
    print(f"| Trung bình | {format_value(result_a['mean'])} | {format_value(result_b['mean'])} |")
    print(f"| Trung vị | {format_value(result_a['median'])} | {format_value(result_b['median'])} |")
    print(f"| Độ lệch chuẩn | {format_value(result_a['stdev'])} | {format_value(result_b['stdev'])} |")
    print(
        f"| Tỉ lệ panel phát hiện được khuôn mặt | "
        f"{result_a['detection_rate']:.0f}% | {result_b['detection_rate']:.0f}% |"
    )


def run(reference_path, config_a_dir, config_b_dir):
    app = load_face_analyzer()

    reference_embedding = extract_embedding(app, reference_path)
    if reference_embedding is None:
        raise ValueError(f"No face detected in reference image: {reference_path}")

    result_a = evaluate_config(app, reference_embedding, config_a_dir)
    result_b = evaluate_config(app, reference_embedding, config_b_dir)
    return result_a, result_b


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, help="Path to the reference portrait image")
    parser.add_argument("--config-a", required=True, help="Directory of prompt-only panel images")
    parser.add_argument("--config-b", required=True, help="Directory of prompt+IP-Adapter panel images")
    args = parser.parse_args()

    result_a, result_b = run(args.reference, args.config_a, args.config_b)

    print(f"N (config A): {result_a['n']} panels, {result_a['detected']} with a detected face")
    print(f"N (config B): {result_b['n']} panels, {result_b['detected']} with a detected face")
    print()
    print_markdown_table(result_a, result_b)


if __name__ == "__main__":
    main()
