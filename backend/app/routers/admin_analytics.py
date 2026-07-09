"""Admin analytics endpoints — aggregated data for thesis evaluation dashboard."""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query
from app.database import mongo_db
from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_admin_key: Optional[str]) -> None:
    if not x_admin_key or not secrets.compare_digest(x_admin_key, settings.ADMIN_SECRET_KEY):
        raise HTTPException(status_code=403, detail="Admin access required")


def _date_filter(days: Optional[int]) -> dict:
    if not days:
        return {}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return {"updated_at": {"$gte": cutoff}}


def _projects_col():
    return mongo_db.get_database()["projects"]


def _panel_ratings_col():
    return mongo_db.get_database()["panel_ratings"]


def _comic_ratings_col():
    return mongo_db.get_database()["comic_ratings"]


def _users_col():
    return mongo_db.get_database()["users"]


# ─── Overview ────────────────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    df = _date_filter(days)
    proj_df = {k: v for k, v in df.items()} if df else {}

    total_users = _users_col().count_documents({})

    comics_created = _projects_col().count_documents({"has_step1": True, **proj_df})

    # Funnel: how many projects reached each step
    funnel_pipeline = [
        {"$match": {"has_step1": True, **proj_df}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "step2": {"$sum": {"$cond": [{"$eq": ["$has_step2", True]}, 1, 0]}},
            "step3": {"$sum": {"$cond": [{"$eq": ["$has_step3", True]}, 1, 0]}},
            "step4": {"$sum": {"$cond": [{"$eq": ["$has_step4", True]}, 1, 0]}},
            "step4_approved": {"$sum": {"$cond": [{"$eq": ["$step3_approved", True]}, 1, 0]}},
        }},
    ]
    funnel_raw = list(_projects_col().aggregate(funnel_pipeline))
    funnel = funnel_raw[0] if funnel_raw else {"total": 0, "step2": 0, "step3": 0, "step4": 0, "step4_approved": 0}
    funnel.pop("_id", None)

    # Count projects that have been exported (have a comic_rating = was at export stage)
    exported = _comic_ratings_col().count_documents(df)

    # Avg comic rating
    rating_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"stars": {"$ne": None}, "skipped": False, **df}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]))
    avg_rating = round(rating_agg[0]["avg"], 1) if rating_agg else None
    rating_count = rating_agg[0]["count"] if rating_agg else 0

    # Avg regens per comic
    regen_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"total_regen_count": {"$exists": True}, **df}},
        {"$group": {"_id": None, "avg_regen": {"$avg": "$total_regen_count"}}},
    ]))
    avg_regen = round(regen_agg[0]["avg_regen"], 1) if regen_agg else 0

    # Panel reaction distribution
    reaction_agg = list(_panel_ratings_col().aggregate([
        {"$match": df},
        {"$group": {"_id": "$reaction", "count": {"$sum": 1}}},
    ]))
    reactions = {r["_id"]: r["count"] for r in reaction_agg}

    # Comics per day (last 7 days for chart)
    comics_per_day = []
    for i in range(6, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        count = _projects_col().count_documents({
            "has_step1": True,
            "saved_at": {"$gte": day_start.isoformat(), "$lte": day_end.isoformat()},
        })
        comics_per_day.append({"date": day.strftime("%m/%d"), "count": count})

    total_images = list(_comic_ratings_col().aggregate([
        {"$match": df},
        {"$group": {"_id": None, "total": {"$sum": "$total_panels"}}},
    ]))
    images_generated = total_images[0]["total"] if total_images else 0

    return {
        "kpis": {
            "total_users": total_users,
            "comics_created": comics_created,
            "images_generated": images_generated,
            "avg_rating": avg_rating,
            "avg_regen_per_comic": avg_regen,
            "rating_count": rating_count,
        },
        "funnel": {
            "step1": funnel.get("total", 0),
            "step2": funnel.get("step2", 0),
            "step3": funnel.get("step3", 0),
            "step4": funnel.get("step4", 0),
            "exported": exported,
        },
        "comics_per_day": comics_per_day,
        "reactions": reactions,
    }


# ─── Quality ─────────────────────────────────────────────────────────────────

@router.get("/quality")
def get_quality(
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    df = _date_filter(days)

    # Rating overview
    comic_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"stars": {"$ne": None}, "skipped": False, **df}},
        {"$group": {
            "_id": None,
            "avg_stars": {"$avg": "$stars"},
            "count": {"$sum": 1},
            "rated_5": {"$sum": {"$cond": [{"$eq": ["$stars", 5]}, 1, 0]}},
            "rated_4": {"$sum": {"$cond": [{"$eq": ["$stars", 4]}, 1, 0]}},
            "rated_3": {"$sum": {"$cond": [{"$eq": ["$stars", 3]}, 1, 0]}},
            "rated_2": {"$sum": {"$cond": [{"$eq": ["$stars", 2]}, 1, 0]}},
            "rated_1": {"$sum": {"$cond": [{"$eq": ["$stars", 1]}, 1, 0]}},
        }},
    ]))
    comic_stats = comic_agg[0] if comic_agg else {}
    comic_stats.pop("_id", None)

    # Panel reaction stats
    panel_agg = list(_panel_ratings_col().aggregate([
        {"$match": df},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "love": {"$sum": {"$cond": [{"$eq": ["$reaction", "love"]}, 1, 0]}},
            "good": {"$sum": {"$cond": [{"$eq": ["$reaction", "good"]}, 1, 0]}},
            "neutral": {"$sum": {"$cond": [{"$eq": ["$reaction", "neutral"]}, 1, 0]}},
            "bad": {"$sum": {"$cond": [{"$eq": ["$reaction", "bad"]}, 1, 0]}},
        }},
    ]))
    panel_stats = panel_agg[0] if panel_agg else {"total": 0, "love": 0, "good": 0, "neutral": 0, "bad": 0}
    panel_stats.pop("_id", None)

    # Regen impact: avg quality score by panel_version
    score_expr = {"$switch": {
        "branches": [
            {"case": {"$eq": ["$reaction", "love"]}, "then": 4},
            {"case": {"$eq": ["$reaction", "good"]}, "then": 3},
            {"case": {"$eq": ["$reaction", "neutral"]}, "then": 2},
            {"case": {"$eq": ["$reaction", "bad"]}, "then": 1},
        ],
        "default": 2,
    }}
    regen_impact = list(_panel_ratings_col().aggregate([
        {"$match": df},
        {"$group": {
            "_id": "$panel_version",
            "avg_score": {"$avg": score_expr},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 5},
    ]))
    for r in regen_impact:
        r["version"] = r.pop("_id")
        r["avg_score"] = round(r["avg_score"], 2)

    # Rating by art style
    style_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"art_style": {"$ne": ""}, "stars": {"$ne": None}, **df}},
        {"$group": {
            "_id": "$art_style",
            "avg_stars": {"$avg": "$stars"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"avg_stars": -1}},
        {"$limit": 8},
    ]))
    for r in style_agg:
        r["style"] = r.pop("_id")
        r["avg_stars"] = round(r["avg_stars"], 1)

    # Top positive / negative keywords (simple word frequency)
    def extract_keywords(field: str, min_len: int = 4) -> list:
        import re
        from collections import Counter
        stop = {"the", "and", "was", "very", "but", "for", "are", "not", "that", "this", "with", "good", "great", "more", "some", "just", "have", "could", "would", "make"}
        docs = list(_comic_ratings_col().find({field: {"$ne": "", "$exists": True}, **df}, {field: 1}))
        words = []
        for doc in docs:
            text = doc.get(field, "")
            words += [w.lower() for w in re.findall(r"[a-zA-Z]+", text) if len(w) >= min_len and w.lower() not in stop]
        top = Counter(words).most_common(8)
        total = max(sum(c for _, c in top), 1)
        return [{"word": w, "count": c, "pct": round(c / total * 100)} for w, c in top]

    return {
        "comic_stats": {**comic_stats, "avg_stars": round(comic_stats.get("avg_stars") or 0, 1)},
        "panel_stats": panel_stats,
        "regen_impact": regen_impact,
        "style_ratings": style_agg,
        "positive_keywords": extract_keywords("comment_positive"),
        "negative_keywords": extract_keywords("comment_negative"),
    }


# ─── Regeneration ────────────────────────────────────────────────────────────

@router.get("/regeneration")
def get_regeneration(
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    df = _date_filter(days)

    # Overview cards
    regen_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"total_regen_count": {"$exists": True}, **df}},
        {"$group": {
            "_id": None,
            "total_regens": {"$sum": "$total_regen_count"},
            "avg_per_comic": {"$avg": "$total_regen_count"},
            "comics_with_regen": {"$sum": {"$cond": [{"$gt": ["$total_regen_count", 0]}, 1, 0]}},
            "total_comics": {"$sum": 1},
        }},
    ]))
    overview = regen_agg[0] if regen_agg else {}
    overview.pop("_id", None)
    if overview:
        overview["avg_per_comic"] = round(overview.get("avg_per_comic") or 0, 1)
        total = overview.get("total_comics", 0)
        with_regen = overview.get("comics_with_regen", 0)
        overview["pct_users_regen"] = round(with_regen / total * 100) if total else 0

    # Common regen feedback keywords
    panel_with_feedback = list(_panel_ratings_col().find(
        {"regen_count": {"$gt": 0}, **df}, {"_id": 0, "panel_id": 1, "reaction": 1, "regen_count": 1}
    ).limit(200))

    # Most regenned pages
    most_regenned = list(_panel_ratings_col().aggregate([
        {"$match": {"regen_count": {"$gt": 0}, **df}},
        {"$group": {"_id": "$panel_id", "total_regens": {"$sum": "$regen_count"}, "count": {"$sum": 1}}},
        {"$sort": {"total_regens": -1}},
        {"$limit": 10},
    ]))
    for r in most_regenned:
        r["panel_id"] = r.pop("_id")

    # Regen before/after: compare V1 vs V2 reactions for same panels that were regen'd
    before_after = list(_panel_ratings_col().aggregate([
        {"$match": {"was_regenerated": True, **df}},
        {"$group": {
            "_id": "$panel_id",
            "versions": {"$push": {"version": "$panel_version", "reaction": "$reaction"}},
        }},
        {"$limit": 10},
    ]))
    samples = []
    score_map = {"love": 4, "good": 3, "neutral": 2, "bad": 1}
    for doc in before_after:
        vs = sorted(doc.get("versions", []), key=lambda x: x.get("version", 0))
        if len(vs) >= 2:
            samples.append({
                "panel_id": doc["_id"],
                "v1": vs[0].get("reaction"),
                "v2": vs[-1].get("reaction"),
                "improved": score_map.get(vs[-1].get("reaction"), 0) > score_map.get(vs[0].get("reaction"), 0),
            })

    # Improvement rate: % of sampled regens where outcome was better
    improved_count = sum(1 for s in samples if s["improved"])
    improvement_rate = round(improved_count / len(samples) * 100) if samples else None
    if overview:
        overview["improvement_rate"] = improvement_rate

    # What reaction was on a panel before the user chose to regenerate it?
    trigger_agg = list(_panel_ratings_col().aggregate([
        {"$match": {"was_regenerated": True, "panel_version": 1, **df}},
        {"$group": {"_id": "$reaction", "count": {"$sum": 1}}},
    ]))
    trigger_reactions = {r["_id"]: r["count"] for r in trigger_agg}

    # How many times did users regen the same panel? (1×, 2×, 3×+)
    depth_agg = list(_panel_ratings_col().aggregate([
        {"$match": {"regen_count": {"$gt": 0}, **df}},
        {"$addFields": {
            "depth_label": {"$switch": {
                "branches": [
                    {"case": {"$eq": ["$regen_count", 1]}, "then": "1×"},
                    {"case": {"$eq": ["$regen_count", 2]}, "then": "2×"},
                ],
                "default": "3×+",
            }},
        }},
        {"$group": {"_id": "$depth_label", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]))
    regen_depth = [{"depth": r["_id"], "count": r["count"]} for r in depth_agg]

    return {
        "overview": overview,
        "most_regenned": most_regenned,
        "before_after_samples": samples,
        "trigger_reactions": trigger_reactions,
        "regen_depth": regen_depth,
    }


# ─── Export ──────────────────────────────────────────────────────────────────

@router.get("/export")
def export_data(
    tab: str = Query("overview"),
    fmt: str = Query("json"),
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    df = _date_filter(days)

    if tab == "panel_ratings":
        data = list(_panel_ratings_col().find(df, {"_id": 0}).limit(5000))
    elif tab == "comic_ratings":
        data = list(_comic_ratings_col().find(df, {"_id": 0}).limit(5000))
    elif tab == "projects":
        data = list(_projects_col().find(df, {
            "_id": 0, "project_id": 1, "user_id": 1, "saved_at": 1, "genre": 1,
            "has_step1": 1, "has_step2": 1, "has_step3": 1, "has_step4": 1,
        }).limit(5000))
    else:
        data = []

    if fmt == "csv":
        if not data:
            return {"csv": ""}
        headers = list(data[0].keys())
        rows = [",".join(str(row.get(h, "")) for h in headers) for row in data]
        csv_text = "\n".join([",".join(headers)] + rows)
        return {"csv": csv_text, "filename": f"{tab}_{days or 'all'}d.csv"}

    return {"data": data, "count": len(data)}


# ─── Thesis report ───────────────────────────────────────────────────────────

@router.get("/thesis-report")
def get_thesis_report(
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    # Reuse overview and quality data
    from fastapi import Request
    df = _date_filter(days)

    total_users = _users_col().count_documents({})
    comics = _projects_col().count_documents({"has_step1": True})
    exported = _comic_ratings_col().count_documents({})

    funnel_raw = list(_projects_col().aggregate([
        {"$match": {"has_step1": True}},
        {"$group": {
            "_id": None,
            "s1": {"$sum": 1},
            "s2": {"$sum": {"$cond": [{"$eq": ["$has_step2", True]}, 1, 0]}},
            "s3": {"$sum": {"$cond": [{"$eq": ["$has_step3", True]}, 1, 0]}},
            "s4": {"$sum": {"$cond": [{"$eq": ["$has_step4", True]}, 1, 0]}},
        }},
    ]))
    f = funnel_raw[0] if funnel_raw else {"s1": 0, "s2": 0, "s3": 0, "s4": 0}

    rating_agg = list(_comic_ratings_col().aggregate([
        {"$match": {"stars": {"$ne": None}, "skipped": False}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]))
    avg_stars = round(rating_agg[0]["avg"] or 0, 1) if rating_agg else 0

    regen_agg = list(_comic_ratings_col().aggregate([
        {"$group": {"_id": None, "avg_regen": {"$avg": "$total_regen_count"}}},
    ]))
    avg_regen = round(regen_agg[0]["avg_regen"], 1) if regen_agg else 0

    panel_total = _panel_ratings_col().count_documents(df)
    rated_panels = panel_total

    s1           = f["s1"] or 1   # safe divisor for drop calculations
    period_str   = f"Last {days} days" if days else "All time"
    completion_pct = round(exported / comics * 100) if comics else 0
    completion_str = f"{completion_pct}%" if comics else "—"

    # Early-stage data warning — prepended when there is nothing meaningful to report
    insufficient = total_users == 0 or comics == 0
    warning_block = (
        "⚠ Note: Insufficient data for meaningful analysis.\n"
        "The following metrics reflect early-stage usage.\n\n"
    ) if insufficient else ""

    # Pipeline funnel block — avoids "0 users (100%)" and negative drop language
    if f["s1"] == 0:
        funnel_block = (
            "- Step 1 (Story Analysis): 0 users — no comics started yet\n"
            "- Step 2 (Character Design): —\n"
            "- Step 3 (Script Generation): —\n"
            "- Step 4 (Image Generation): —\n"
            "- Exported: —\n"
            "- Biggest drop-off: N/A (no pipeline data yet)"
        )
    else:
        drops = [
            ("Step 1 → Step 2", s1,              f["s2"]),
            ("Step 2 → Step 3", f["s2"] or 1,    f["s3"]),
            ("Step 3 → Step 4", f["s3"] or 1,    f["s4"]),
        ]
        biggest_drop = max(drops, key=lambda x: (x[1] - x[2]) / x[1] if x[1] else 0)
        drop_pct     = round((biggest_drop[1] - biggest_drop[2]) / biggest_drop[1] * 100) if biggest_drop[1] else 0
        funnel_block = (
            f"- Step 1 (Story Analysis): {f['s1']:,} users (baseline)\n"
            f"- Step 2 (Character Design): {f['s2']:,} users ({round(f['s2'] / s1 * 100)}%)\n"
            f"- Step 3 (Script Generation): {f['s3']:,} users ({round(f['s3'] / s1 * 100)}%)\n"
            f"- Step 4 (Image Generation): {f['s4']:,} users ({round(f['s4'] / s1 * 100)}%)\n"
            f"- Exported: {exported:,} users ({completion_pct}%)\n"
            f"- Biggest drop-off: {biggest_drop[0]} ({drop_pct}% drop)"
        )

    report = f"""# mOhiOm — System Evaluation Summary
Period: {period_str}
Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}

{warning_block}## User Participation
- Total registered users: {total_users:,}
- Comics started: {comics:,}
- Comics exported: {exported:,}
- Pipeline completion rate: {completion_str}

## Pipeline Funnel
{funnel_block}

## Quality Ratings
- Average overall rating: {avg_stars}/5 stars
- Total comics rated: {rating_agg[0]['count'] if rating_agg else 0}
- Panel reactions collected: {rated_panels:,}

## Regeneration Analysis
- Average regenerations per comic: {avg_regen}
- Total panel ratings: {rated_panels:,}

## Notes
Data collected from mOhiOm comic generation system.
All users participated voluntarily; ratings are self-reported.
"""

    return {"report": report, "generated_at": datetime.now(timezone.utc).isoformat()}


# ─── Characters tab ───────────────────────────────────────────────────────────

@router.get("/characters")
def get_characters(
    days: Optional[int] = Query(None),
    x_admin_key: Optional[str] = Header(None),
):
    _require_admin(x_admin_key)
    df = _date_filter(days)

    char_col   = mongo_db.get_database()["character_ratings"]
    char_set   = mongo_db.get_database()["character_set_ratings"]
    panel_col  = mongo_db.get_database()["panel_ratings"]
    events_col = mongo_db.get_database()["analytics_events"]

    def score_expr(reaction_field: str = "$reaction"):
        return {"$switch": {
            "branches": [
                {"case": {"$eq": [reaction_field, "love"]},    "then": 4},
                {"case": {"$eq": [reaction_field, "good"]},    "then": 3},
                {"case": {"$eq": [reaction_field, "neutral"]}, "then": 2},
                {"case": {"$eq": [reaction_field, "bad"]},     "then": 1},
            ],
            "default": 0,
        }}

    # ── FIX 1: KPI cards ──────────────────────────────────────────────────────
    total_chars_generated = events_col.count_documents({"event": "character_generated", **df})
    total_chars_rated     = char_col.count_documents(df)
    total_chars_approved  = events_col.count_documents({"event": "character_approved",  **df})
    approval_rate = (
        round(total_chars_approved / total_chars_generated * 100, 1)
        if total_chars_generated > 0 else None
    )

    cs_agg = list(char_set.aggregate([
        {"$match": {"avg_versions_per_character": {"$gt": 0}, **df}},
        {"$group": {"_id": None,
            "avg_versions": {"$avg": "$avg_versions_per_character"},
            "avg_stars":    {"$avg": "$stars"},
        }},
    ]))
    avg_versions   = round(cs_agg[0]["avg_versions"], 1) if cs_agg else None
    avg_char_stars = round(cs_agg[0]["avg_stars"] or 0, 1) if cs_agg else None

    # ── FIX 2: Version vs quality ──────────────────────────────────────────────
    version_quality = list(char_col.aggregate([
        {"$match": {"reaction": {"$in": ["love", "good", "neutral", "bad"]}, **df}},
        {"$addFields": {
            "score": score_expr(),
            "vcap":  {"$cond": [{"$gte": ["$version", 3]}, 3, "$version"]},
        }},
        {"$group": {"_id": "$vcap", "avg_score": {"$avg": "$score"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]))
    _ver_labels = {
        0: "V1 — Original",
        1: "V2 — 1st regen",
        2: "V3 — 2nd regen",
    }
    for v in version_quality:
        v["version"]   = v.pop("_id")
        v["label"]     = "V4+ — 3rd regen+" if v["version"] >= 3 else _ver_labels.get(v["version"], f"V{v['version'] + 1}")
        v["avg_score"] = round(v["avg_score"], 2)
        v["pct"]       = round(v["avg_score"] / 4 * 100)

    v1_score = next((v["avg_score"] for v in version_quality if v["version"] == 0), None)
    v2_score = next((v["avg_score"] for v in version_quality if v["version"] == 1), None)
    v1_v2_jump = round((v2_score - v1_score) / v1_score * 100) if v1_score and v2_score and v1_score > 0 else None

    # ── FIX 3: Role and mode analysis (from analytics events) ─────────────────
    def event_quality_by_field(field: str, label_map: Optional[dict] = None):
        results = list(events_col.aggregate([
            {"$match": {"event": "character_generated", field: {"$ne": None}, **df}},
            {"$lookup": {
                "from": "character_ratings",
                "localField":  "character_id",
                "foreignField": "character_id",
                "as": "ratings",
            }},
            {"$unwind": "$ratings"},
            {"$addFields": {"score": score_expr("$ratings.reaction")}},
            {"$group": {
                "_id":       f"${field}",
                "avg_score": {"$avg": "$score"},
                "count":     {"$sum": 1},
            }},
            {"$sort": {"avg_score": -1}},
        ]))
        out = []
        for r in results:
            key = r.pop("_id")
            r["key"]       = key
            r["label"]     = (label_map or {}).get(key, str(key))
            r["avg_score"] = round(r["avg_score"] or 0, 2)
            r["pct"]       = round(r["avg_score"] / 4 * 100)
            out.append(r)
        return out

    mode_labels = {1: "Text only", 2: "+ Reference", 3: "+ Pose", 4: "Full"}
    role_quality = event_quality_by_field("character_role")
    mode_quality = event_quality_by_field("generation_mode", mode_labels)

    # ── FIX 4: Chip analysis ──────────────────────────────────────────────────
    from collections import Counter
    chip_docs = list(char_col.find(
        {"reaction": {"$in": ["neutral", "bad"]}, "chips_selected": {"$ne": []}, **df},
        {"chips_selected": 1, "_id": 0},
    ).limit(2000))
    all_chips   = [c for doc in chip_docs for c in doc.get("chips_selected", [])]
    chip_counts = Counter(all_chips)
    total_neg   = len(chip_docs) or 1
    chip_labels = {
        "age_wrong":       "👤 Wrong age",
        "hair_wrong":      "💇 Hair is wrong",
        "eyes_wrong":      "👁 Wrong eyes",
        "outfit_wrong":    "👗 Outfit incorrect",
        "personality_off": "🎭 Personality",
        "build_wrong":     "📏 Wrong build",
        "color_wrong":     "🎨 Color wrong",
        "missing_details": "✨ Missing details",
    }
    chip_analysis = [
        {
            "chip":  chip_id,
            "label": chip_labels.get(chip_id, chip_id),
            "count": cnt,
            "pct":   round(cnt / total_neg * 100, 1),
        }
        for chip_id, cnt in chip_counts.most_common()
    ]

    # ── FIX 5: Correlation character quality → panel quality ──────────────────
    char_by_comic  = {r["_id"]: r["avg"] for r in char_col.aggregate([
        {"$match": df},
        {"$addFields": {"score": score_expr()}},
        {"$group": {"_id": "$comic_id", "avg": {"$avg": "$score"}}},
    ])}
    panel_by_comic = {r["_id"]: r["avg"] for r in panel_col.aggregate([
        {"$match": df},
        {"$addFields": {"score": score_expr()}},
        {"$group": {"_id": "$comic_id", "avg": {"$avg": "$score"}}},
    ])}
    common = list(set(char_by_comic) & set(panel_by_comic))

    corr_r = None
    if len(common) >= 3:
        xs = [char_by_comic[c] for c in common]
        ys = [panel_by_comic[c] for c in common]
        n  = len(xs); mx = sum(xs) / n; my = sum(ys) / n
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
        corr_r = round(num / den, 3) if den > 0 else 0

    char_reaction_table = []
    for rxn in ["love", "good", "neutral", "bad"]:
        comic_ids_for_rxn = {
            r["_id"] for r in char_col.aggregate([
                {"$match": {"reaction": rxn, **df}},
                {"$group": {"_id": "$comic_id"}},
            ])
        }
        pscores = [panel_by_comic[c] for c in comic_ids_for_rxn if c in panel_by_comic]
        char_reaction_table.append({
            "char_reaction":   rxn,
            "avg_panel_score": round(sum(pscores) / len(pscores), 2) if pscores else None,
            "comic_count":     len(pscores),
        })

    # ── FIX 6: Character funnel ────────────────────────────────────────────────
    chars_regen_agg = list(char_col.aggregate([
        {"$match": {"version": {"$gte": 1}, **df}},
        {"$group": {"_id": "$character_id"}},
        {"$count": "n"},
    ]))
    chars_regenerated = chars_regen_agg[0]["n"] if chars_regen_agg else 0

    return {
        "kpis": {
            "total_chars_generated": total_chars_generated,
            "total_chars_rated":     total_chars_rated,
            "avg_versions":          avg_versions,
            "avg_char_stars":        avg_char_stars,
            "approval_rate":         approval_rate,
        },
        "version_quality": version_quality,
        "v1_v2_jump":      v1_v2_jump,
        "role_quality":    role_quality,
        "mode_quality":    mode_quality,
        "chip_analysis":   chip_analysis,
        "correlation": {
            "pearson_r":     corr_r,
            "reaction_table": char_reaction_table,
            "sample_count":  len(common),
        },
        "funnel": {
            "generated":   total_chars_generated,
            "rated":       total_chars_rated,
            "regenerated": chars_regenerated,
            "approved":    total_chars_approved,
        },
    }
