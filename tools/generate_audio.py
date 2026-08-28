import argparse
import asyncio
import json
import os
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
        result = await asyncio.to_thread(subprocess.run, command, capture_output=True, timeout=45)
        if result.returncode:
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
        temporary.replace(destination)


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    asyncio.run(generate_missing_sentences(Path(args.root).resolve(), args.limit))


if __name__ == "__main__":
    main()
