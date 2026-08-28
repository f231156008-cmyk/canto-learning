import argparse
import asyncio
import json
import os
import ast
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

VOICES = {
    "female": "zh-HK-HiuGaaiNeural",
    "male": "zh-HK-WanLungNeural",
}


async def generate_one(text: str, voice: str, destination: Path, semaphore: asyncio.Semaphore):
    async with semaphore:
        temporary = destination.with_suffix(destination.suffix + ".part")
        command = [
            sys.executable, "-m", "edge_tts", "--voice", voice,
            "--rate=-4%", "--text", text, "--write-media", str(temporary),
        ]
        last_error = ""
        for attempt in range(3):
            result = await asyncio.to_thread(subprocess.run, command, capture_output=True, timeout=60)
            if result.returncode == 0 and temporary.exists() and temporary.stat().st_size:
                temporary.replace(destination)
                return
            last_error = result.stderr.decode("utf-8", errors="replace")
            if temporary.exists():
                temporary.unlink()
            await asyncio.sleep(2 ** attempt)
        raise RuntimeError(last_error)


async def generate_missing_sentences(root: Path, limit: int | None):
    words_path = root / "data" / "words.json"
    audio_dir = root / "audio"
    review_path = root / "data" / "audio-review.json"
    words = json.loads(words_path.read_text(encoding="utf-8"))
    targets = [
        word for word in words
        if word.get("example") and any(
            not (audio_dir / f"{int(word['id']):03d}-sentence-{gender}.mp3").exists()
            for gender in VOICES
        )
    ]
    if limit is not None:
        targets = targets[:limit]

    semaphore = asyncio.Semaphore(2)
    tasks = []
    records = []
    for word in targets:
        for gender, voice in VOICES.items():
            filename = f"{int(word['id']):03d}-sentence-{gender}.mp3"
            destination = audio_dir / filename
            if not destination.exists():
                tasks.append(generate_one(word["example"], voice, destination, semaphore))
            records.append({
                "wordId": word["id"],
                "kind": "sentence",
                "gender": gender,
                "file": filename,
                "text": word["example"],
                "targetJyutping": word.get("sentenceJyutping", ""),
                "voice": voice,
                "status": "generated_unreviewed",
            })

    if tasks:
        await asyncio.gather(*tasks)

    for word in words:
        female = f"{int(word['id']):03d}-sentence-female.mp3"
        male = f"{int(word['id']):03d}-sentence-male.mp3"
        if (audio_dir / female).exists() and (audio_dir / male).exists():
            word["sentenceAudio"] = {"female": female, "male": male}
    words_path.write_text(json.dumps(words, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = []
    if review_path.exists():
        existing = json.loads(review_path.read_text(encoding="utf-8"))
    keys = {(record["file"], record["kind"]) for record in records}
    existing = [record for record in existing if (record.get("file"), record.get("kind")) not in keys]
    timestamp = datetime.now(timezone.utc).isoformat()
    for record in records:
        record["generatedAt"] = timestamp
    review_records = existing + records
    review_keys = {(record.get("file"), record.get("kind")) for record in review_records}
    for word in words:
        for gender, voice in VOICES.items():
            filename = f"{int(word['id']):03d}-sentence-{gender}.mp3"
            key = (filename, "sentence")
            if key in review_keys or not (audio_dir / filename).exists():
                continue
            review_records.append({
                "wordId": word["id"],
                "kind": "sentence",
                "gender": gender,
                "file": filename,
                "text": word.get("example", ""),
                "targetJyutping": word.get("sentenceJyutping", ""),
                "voice": voice,
                "status": "legacy_unreviewed",
                "generatedAt": None,
            })
    review_path.write_text(json.dumps(review_records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(records)} sentence recordings for {len(targets)} words.")


async def generate_pronunciation_inventory(root: Path):
    source = (root / "assets" / "js" / "pronunciation.js").read_text(encoding="utf-8")
    audio_dir = root / "audio"
    review_path = root / "data" / "audio-review.json"
    initials_match = re.search(r"const initials=(\[.*?\]);\s*const finals", source, re.S)
    if not initials_match:
        raise RuntimeError("Could not read pronunciation initials.")
    initials = ast.literal_eval(initials_match.group(1))
    finals = re.findall(r"([a-z]+):\['([^']+)','([^']+)'\]", source)
    targets = []
    for item in initials:
        if len(item) == 4:
            symbol, word, jyutping, _ = item
        elif item[0] == "kw":
            symbol, word, jyutping = "kw", "誇", "kwaa1"
        else:
            raise RuntimeError(f"Incomplete initial entry: {item[0]}")
        key = "zero" if symbol == "Ø" else symbol
        targets.append((f"pron-initial-{key}.mp3", word, jyutping, "initial"))
    for final, word, jyutping in finals:
        targets.append((f"pron-final-{final}.mp3", word, jyutping, "final"))

    semaphore = asyncio.Semaphore(2)
    tasks = []
    for filename, text, _, _ in targets:
        destination = audio_dir / filename
        if not destination.exists():
            tasks.append(generate_one(text, VOICES["female"], destination, semaphore))
    if tasks:
        await asyncio.gather(*tasks)

    review = json.loads(review_path.read_text(encoding="utf-8")) if review_path.exists() else []
    filenames = {filename for filename, _, _, _ in targets}
    review = [record for record in review if record.get("file") not in filenames]
    timestamp = datetime.now(timezone.utc).isoformat()
    review.extend({
        "kind": kind,
        "gender": "female",
        "file": filename,
        "text": text,
        "targetJyutping": jyutping,
        "voice": VOICES["female"],
        "status": "generated_unreviewed",
        "generatedAt": timestamp,
    } for filename, text, jyutping, kind in targets)
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(targets)} pronunciation recordings.")


async def generate_challenges(root: Path):
    node = os.environ.get("CANTO_NODE", "node")
    exported = subprocess.run(
        [node, "tools/export_challenge_audio.mjs"],
        cwd=root,
        capture_output=True,
        check=True,
    )
    records = json.loads(exported.stdout.decode("utf-8"))
    audio_dir = root / "audio"
    review_path = root / "data" / "audio-review.json"
    semaphore = asyncio.Semaphore(1)
    tasks = []
    for record in records:
        destination = audio_dir / record["file"]
        if not destination.exists():
            tasks.append(generate_one(record["text"], VOICES["female"], destination, semaphore))
    if tasks:
        await asyncio.gather(*tasks)

    review = json.loads(review_path.read_text(encoding="utf-8")) if review_path.exists() else []
    filenames = {record["file"] for record in records}
    review = [record for record in review if record.get("file") not in filenames]
    timestamp = datetime.now(timezone.utc).isoformat()
    for record in records:
        record.update({
            "gender": "female",
            "voice": VOICES["female"],
            "status": "generated_unreviewed",
            "generatedAt": timestamp,
        })
    review_path.write_text(json.dumps(review + records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(records)} challenge recordings.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--inventory", action="store_true")
    parser.add_argument("--challenges", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    if args.challenges:
        asyncio.run(generate_challenges(root))
    elif args.inventory:
        asyncio.run(generate_pronunciation_inventory(root))
    else:
        asyncio.run(generate_missing_sentences(root, args.limit))


if __name__ == "__main__":
    main()
