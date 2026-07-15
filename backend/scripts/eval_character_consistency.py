"""
Objective character-consistency measurement for thesis Chuong 6, muc 6.4.1(b).

Compares a reference portrait against two sets of generated panels (config A:
prompt-only, config B: prompt + IP-Adapter reference) using CLIP image-image
embedding similarity, and prints the mean/median/std/pass-rate table in the
same shape as the draft's table so it can be pasted straight into
KhoaLuan_Draft.md.

Originally this used ArcFace face embeddings (via InsightFace), but that
detector — like DeepFace's — is trained on real human photographs and could
not detect any face in the project's manga/anime-style reference art (domain
gap between training data and the illustrated evaluation set). CLIP
image-image similarity is used instead since it needs no face-detection step
and works directly on stylized art. See 6.4.1(b) in the draft for the full
discussion.

Setup (one-off, not added to requirements.txt):
    pip install open_clip_torch torch pillow numpy

Usage:
    python eval_character_consistency.py \
        --reference path/to/portrait.png \
        --config-a path/to/panels_prompt_only/ \
        --config-b path/to/panels_with_reference/
"""

import argparse
import statistics
from pathlib import Path

import numpy as np
import torch
from PIL import Image

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

_clip_model = None
_clip_preprocess = None


def load_clip_model():
    global _clip_model, _clip_preprocess
    if _clip_model is None:
        import open_clip
        _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms("ViT-B-32")
        _clip_model.eval()
    return _clip_model, _clip_preprocess


def extract_embedding(image_path):
    model, preprocess = load_clip_model()
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception:
        return None
    tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        feat = model.encode_image(tensor)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat.squeeze(0).numpy()


def cosine_similarity(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def list_images(directory):
    return sorted(p for p in Path(directory).iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS)


def evaluate_config(reference_embedding, panel_dir, threshold=0.75):
    similarities = []
    detected = 0
    total = 0
    for image_path in list_images(panel_dir):
        total += 1
        embedding = extract_embedding(image_path)
        if embedding is None:
            continue
        detected += 1
        similarities.append(cosine_similarity(reference_embedding, embedding))

    passed = sum(1 for s in similarities if s >= threshold)
    return {
        "n": total,
        "detected": detected,
        "mean": statistics.mean(similarities) if similarities else None,
        "median": statistics.median(similarities) if similarities else None,
        "stdev": statistics.stdev(similarities) if len(similarities) > 1 else None,
        "pass_rate": (passed / total * 100) if total else 0.0,
    }


def format_value(value, precision=3):
    return f"{value:.{precision}f}" if value is not None else "…"


def print_markdown_table(result_a, result_b):
    print("| Chỉ số (cosine CLIP với ảnh tham chiếu) | (A) Chỉ prompt | (B) Prompt + IP-Adapter |")
    print("|---|---|---|")
    print(f"| Trung bình | {format_value(result_a['mean'])} | {format_value(result_b['mean'])} |")
    print(f"| Trung vị | {format_value(result_a['median'])} | {format_value(result_b['median'])} |")
    print(f"| Độ lệch chuẩn | {format_value(result_a['stdev'])} | {format_value(result_b['stdev'])} |")
    print(
        f"| Tỉ lệ panel đạt ngưỡng (≥ 0.75) | "
        f"{result_a['pass_rate']:.0f}% | {result_b['pass_rate']:.0f}% |"
    )


def run(reference_path, config_a_dir, config_b_dir):
    reference_embedding = extract_embedding(reference_path)
    if reference_embedding is None:
        raise ValueError(f"Could not read reference image: {reference_path}")

    result_a = evaluate_config(reference_embedding, config_a_dir)
    result_b = evaluate_config(reference_embedding, config_b_dir)
    return result_a, result_b


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, help="Path to the reference portrait image")
    parser.add_argument("--config-a", required=True, help="Directory of prompt-only panel images")
    parser.add_argument("--config-b", required=True, help="Directory of prompt+IP-Adapter panel images")
    args = parser.parse_args()

    result_a, result_b = run(args.reference, args.config_a, args.config_b)

    print(f"N (config A): {result_a['n']} panels, {result_a['detected']} with a usable embedding")
    print(f"N (config B): {result_b['n']} panels, {result_b['detected']} with a usable embedding")
    print()
    print_markdown_table(result_a, result_b)


if __name__ == "__main__":
    main()
