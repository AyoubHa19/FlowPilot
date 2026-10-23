"""Renders the promo's whole sound-effects track, sample-accurate.

Reads sfx-events.json (written by build-frames.py from the same timings the
animations use) and STORYBOARD.md (frame order and durations), then mixes one
mono WAV:

- typing: one real keystroke per character, at the exact moment the character
  appears on screen (typeOn shows round(n) characters, n linear over the tween);
- scramble: a soft digital blip on every glyph change of the headline word;
- count: a light tick each time a counter's displayed value changes;
- pop / click / chime / whoosh / alert: one-shots on their cue.

Everything is kept quiet on purpose (the user asked for low volume).

    python scripts/build-sfx.py
"""

import json
import re
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
SFX = Path("assets/sfx")
rng = np.random.default_rng(20261021)  # seeded: the same track on every build


def load(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def normalize(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


def fade(x: np.ndarray, out_ms: float = 15, in_ms: float = 1) -> np.ndarray:
    x = x.copy()
    n_in, n_out = int(SR * in_ms / 1000), int(SR * out_ms / 1000)
    if n_in:
        x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


# ---------------------------------------------------------------- sources
def keystrokes() -> list[np.ndarray]:
    """Cuts the individual key hits out of the bundled typing burst."""
    a = load(SFX / "typing.mp3")
    win = int(SR * 0.004)
    env = np.array([np.abs(a[i : i + win]).max() for i in range(0, len(a) - win, win)])
    hi, lo = env.max() * 0.22, env.max() * 0.08
    strokes, armed, last = [], True, -1
    for i, e in enumerate(env):
        if armed and e > hi and (last < 0 or i - last > 15):
            start = max(0, i * win - int(SR * 0.003))
            seg = a[start : start + int(SR * 0.075)]
            if len(seg) == int(SR * 0.075):
                strokes.append(fade(normalize(seg), out_ms=25))
            armed, last = False, i
        elif e < lo:
            armed = True
    return strokes


def blip(freq: float, ms: float = 22) -> np.ndarray:
    t = np.arange(int(SR * ms / 1000)) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.3 * np.sign(np.sin(2 * np.pi * freq * 2 * t))
    return fade(tone * np.exp(-t * 90), out_ms=6, in_ms=1) * 0.5


def tick() -> np.ndarray:
    t = np.arange(int(SR * 0.012)) / SR
    return fade(np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 400), out_ms=3)


def alert() -> np.ndarray:
    parts = []
    for f in (880, 660):
        t = np.arange(int(SR * 0.16)) / SR
        parts.append(fade(np.sin(2 * np.pi * f * t) * (1 - np.exp(-t * 200)) * np.exp(-t * 9), out_ms=30, in_ms=4))
        parts.append(np.zeros(int(SR * 0.03)))
    return np.concatenate(parts)


# ---------------------------------------------------------------- timing
def frame_starts() -> dict[str, float]:
    """Frame N starts where frames 1..N-1 end (the assembler's layout)."""
    sb = Path("STORYBOARD.md").read_text(encoding="utf-8")
    starts, t = {}, 0.0
    for block in re.split(r"\n## Frame ", sb)[1:]:
        src = re.search(r"- src: compositions/frames/(\S+)\.html", block).group(1)
        dur = float(re.search(r"- duration: ([\d.]+)s", block).group(1))
        starts[src] = t
        t += dur
    starts["__total__"] = t
    return starts


def typing_times(at: float, dur: float, text: str) -> list[tuple[float, str]]:
    # Character k (1-based) becomes visible when round(n) == k, i.e. n = k - 0.5.
    n = len(text)
    return [(at + (k - 0.5) / n * dur, text[k - 1]) for k in range(1, n + 1)]


def count_times(at: float, dur: float, value: float, decimals: int) -> list[float]:
    # GSAP power3.out: v = value * (1 - (1 - p)^3); a tick per change of v.toFixed(d).
    times, last_label, last_t = [], None, -1.0
    for i in range(1, 2001):
        p = i / 2000
        label = f"{value * (1 - (1 - p) ** 3):.{decimals}f}"
        t = at + p * dur
        if label != last_label and t - last_t >= 0.035:
            times.append(t)
            last_t = t
        last_label = label
    return times


# ---------------------------------------------------------------- mix
def main() -> None:
    starts = frame_starts()
    track = np.zeros(int(SR * (starts["__total__"] + 1)), dtype=np.float32)

    def place(sample: np.ndarray, t: float, gain: float) -> None:
        i = int(round(t * SR))
        j = min(len(track), i + len(sample))
        if i < len(track):
            track[i:j] += sample[: j - i] * gain

    keys = keystrokes()
    pop = normalize(load(SFX / "pop.mp3"))
    click = normalize(load(SFX / "click.mp3"))
    chime = normalize(load(SFX / "chime.mp3"))
    whoosh = normalize(load(SFX / "whoosh.mp3"))
    whoosh_peak = 2.5  # seconds into the file (measured)
    whoosh = fade(whoosh[: int(SR * 4.0)], out_ms=400)
    alarm = normalize(alert())
    tk = tick()
    pitches = [1180, 1320, 1480, 1660, 1860, 2090, 2350]

    events = json.loads(Path("sfx-events.json").read_text(encoding="utf-8"))
    for e in events:
        t0 = starts[e["frame"]] + e["at"]
        kind = e["kind"]
        if kind == "type":
            for i, (t, ch) in enumerate(typing_times(t0, e["dur"], e["text"])):
                k = keys[int(rng.integers(len(keys)))]
                g = 0.30 * float(rng.uniform(0.8, 1.1)) * (0.55 if ch == " " else 1.0)
                place(k, t + float(rng.uniform(-0.004, 0.004)), g)
        elif kind == "scramble":
            steps = e["steps"]
            for j in range(1, steps):
                place(blip(pitches[(j * 5) % len(pitches)]), t0 + j / steps * e["dur"], 0.07)
            place(blip(2350, ms=40), t0 + e["dur"], 0.12)  # the word locks in
        elif kind == "count":
            for t in count_times(t0, e["dur"], e["value"], e["decimals"]):
                place(tk, t, 0.10)
        elif kind == "pop":
            place(pop, t0, 0.26)
        elif kind == "pop-soft":
            place(pop, t0, 0.13)
        elif kind == "click":
            place(click, t0, 0.40)
        elif kind == "chime":
            place(chime, t0, 0.24)
        elif kind == "alert":
            place(alarm, t0, 0.16)
        elif kind == "whoosh":
            place(whoosh, t0 - whoosh_peak, 0.13)

    # Gentle limiter, then a quiet master: peaks around -9 dBFS.
    track = np.tanh(track * 1.4) / 1.4
    track = normalize(track[: int(SR * starts["__total__"])], peak=0.35)
    out = SFX / "track.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((track * 32767).astype(np.int16).tobytes())
    print(f"wrote {out} ({len(keys)} keystroke samples, {len(events)} events, {starts['__total__']:.0f}s)")


main()
