"""Writes compositions/frames/*.html for the FlowPilot promo.

Every frame is a <template> sub-composition with its own fonts, styles and one
paused GSAP timeline. Shared pieces (fonts, palette, helpers) are defined once
here so the eight frames stay consistent. Run from the project root:

    python scripts/build-frames.py
"""

from pathlib import Path

OUT = Path("compositions/frames")
OUT.mkdir(parents=True, exist_ok=True)

# Every on-screen action that should make a sound, in frame-local seconds.
# scripts/build-sfx.py turns this into one sample-accurate sound track, so the
# sounds can never drift from the motion they belong to.
EVENTS: list[dict] = []


def ev(kind: str, frame_id: str, at: float, **extra) -> None:
    EVENTS.append({"kind": kind, "frame": frame_id, "at": round(at, 4), **extra})

GSAP = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>'

FONTS = """
@font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400.woff2") format("woff2"); font-weight: 400; font-style: normal; }
@font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-italic.woff2") format("woff2"); font-weight: 400; font-style: italic; }
@font-face { font-family: "Geist"; src: url("assets/fonts/Geist.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
@font-face { font-family: "Geist Mono"; src: url("assets/fonts/GeistMono.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
"""


def base_css(fid: str) -> str:
    return FONTS + f"""
#root {{ position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; color: #f4f5f8; font-family: "Geist", sans-serif; }}
.{fid}-bg {{ position: absolute; inset: 0; background: #0b0b0f; }}
.{fid}-kicker {{ font-family: "Geist Mono", monospace; font-size: 22px; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a4ae; }}
.{fid}-display {{ font-family: "Instrument Serif", serif; font-weight: 400; line-height: 0.95; letter-spacing: -0.02em; color: #f4f5f8; }}
.{fid}-lime {{ color: #c8f135; }}
.{fid}-italic {{ font-style: italic; }}
.{fid}-card {{ background: #141419; border: 1px solid rgba(255,255,255,0.10); border-radius: 22px; box-shadow: 0 40px 80px -30px rgba(0,0,0,0.9); }}
.{fid}-chip {{ display: inline-flex; align-items: center; gap: 10px; border-radius: 999px; padding: 10px 20px; font-size: 24px; font-weight: 600; }}
.{fid}-chip-lime {{ background: #c8f135; color: #15170b; }}
.{fid}-tag {{ display: inline-block; border-radius: 8px; padding: 4px 10px; font-family: "Geist Mono", monospace; font-size: 16px; letter-spacing: 0.1em; font-weight: 500; }}
.{fid}-caret {{ display: inline-block; width: 3px; height: 1em; margin-left: 3px; vertical-align: -0.12em; background: #c8f135; }}
"""


# Deterministic typing: the text shown is a pure function of the tween progress.
TYPE_JS = """
function typeOn(tl, el, text, at, dur, caret) {
  const state = { n: 0 };
  el.textContent = "";
  tl.to(state, {
    n: text.length, duration: dur, ease: "none",
    onUpdate() { el.textContent = text.slice(0, Math.round(state.n)); },
  }, at);
  if (caret) {
    tl.fromTo(caret, { opacity: 0 }, { opacity: 1, duration: 0.01 }, at);
    tl.to(caret, { opacity: 0, duration: 0.2 }, at + dur + 0.3);
  }
}
"""


def frame(fid: str, duration: float, css: str, body: str, js: str) -> str:
    return f"""<template>
  {GSAP}
  <style>
{base_css(fid)}
{css}
  </style>
  <div id="root" data-composition-id="{fid}" data-width="1920" data-height="1080" data-duration="{duration}">
    <div class="clip {fid}-bg" data-start="0" data-duration="{duration}" data-track-index="0"></div>
{body}
  </div>
  <script>
    (() => {{
{TYPE_JS}
      const $ = (s) => document.querySelector('[data-composition-id="{fid}"] ' + s);
      const tl = gsap.timeline({{ paused: true }});
{js}
      window.__timelines["{fid}"] = tl;
    }})();
  </script>
</template>
"""


def write(name: str, html: str) -> None:
    import re

    # Ids and classes must start with a letter to be valid CSS selectors, so
    # every "<frame_id>-x" becomes "f<frame_id>-x". The composition id and the
    # timeline key ("<frame_id>" with no suffix) stay as they are.
    html = html.replace(f"{name}-", f"f{name}-")
    # Every timed clip gets a stable id for Studio.
    n = 0

    def add_id(m: "re.Match[str]") -> str:
        nonlocal n
        tag = m.group(0)
        if " id=" in tag:
            return tag
        n += 1
        return tag.replace("<div ", f'<div id="f{name}-clip{n}" ', 1)

    html = re.sub(r'<div class="clip[^"]*"[^>]*>', add_id, html)
    (OUT / f"{name}.html").write_text(html, encoding="utf-8")
    print("wrote", name)


# ---------------------------------------------------------------- 01 hook
def glyph_band(fid: str, count: int, seed: int) -> str:
    """A fixed, seeded scatter of glyphs (deterministic, no Math.random)."""
    glyphs = "@#&%*+=<>/§€ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
    colors = ["#c8f135", "#c8f135", "#a78bfa", "#e4e7ee", "#e4e7ee", "#8b9cff"]
    s = seed
    spans = []
    for i in range(count):
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        x = 4 + (s % 9200) / 100  # 4%–96%
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        y = 8 + (s % 6400) / 100  # 8%–72%
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        g = glyphs[s % len(glyphs)]
        c = colors[(s >> 8) % len(colors)]
        o = 0.35 + ((s >> 4) % 50) / 100
        spans.append(
            f'<span class="{fid}-g" style="left:{x:.2f}%;top:{y:.2f}%;color:{c};--o:{o:.2f}">{g}</span>'
        )
    return "\n      ".join(spans)


def hook() -> None:
    fid = "01-hook"
    css = f"""
.{fid}-field {{ position: absolute; inset: 0; }}
.{fid}-g {{ position: absolute; font-family: "Geist Mono", monospace; font-size: 30px; opacity: 0; }}
.{fid}-stack {{ position: absolute; left: 0; right: 0; top: 230px; display: flex; flex-direction: column; align-items: center; text-align: center; }}
.{fid}-l1 {{ font-size: 150px; }}
.{fid}-word {{ font-size: 170px; height: 175px; font-style: italic; color: #c8f135; white-space: pre; }}
.{fid}-l3 {{ font-size: 120px; margin-top: 10px; }}
"""
    body = f"""
    <div class="clip {fid}-field" data-start="0" data-duration="5" data-track-index="1" data-layout-allow-overlap aria-hidden="true">
      {glyph_band(fid, 90, 20261020)}
    </div>
    <div class="clip {fid}-stack" data-start="0" data-duration="5" data-track-index="2">
      <div class="{fid}-display {fid}-l1" id="{fid}-l1">Tenant email,</div>
      <div class="{fid}-display {fid}-word" id="{fid}-word">researched</div>
      <div class="{fid}-display {fid}-l3" id="{fid}-l3">before you open it.</div>
    </div>"""
    js = f"""
      const glyphs = document.querySelectorAll('[data-composition-id="{fid}"] .{fid}-g');
      // Glyph band flickers in, then thins out as the headline lands.
      glyphs.forEach((g, i) => {{
        const o = parseFloat(getComputedStyle(g).getPropertyValue("--o")) || 0.6;
        tl.fromTo(g, {{ opacity: 0 }}, {{ opacity: o, duration: 0.25, ease: "power2.out" }}, 0.05 + (i % 30) * 0.035);
        // Dim to a faint texture as the headline arrives, so the type stays readable.
        tl.to(g, {{ opacity: o * 0.18, duration: 0.6, ease: "power2.inOut" }}, 1.0 + (i % 12) * 0.02);
      }});
      tl.fromTo("#{fid}-l1", {{ opacity: 0, y: 60 }}, {{ opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }}, 1.2);
      // Scramble: each frame of the tween shows glyph noise that resolves left to right.
      const word = $("#{fid}-word");
      const NOISE = "@#%&*+=<>/?§€ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
      function scramble(target, at, dur) {{
        const st = {{ p: 0 }};
        tl.to(st, {{ p: 1, duration: dur, ease: "none", onUpdate() {{
          const resolved = Math.floor(st.p * target.length);
          const step = Math.floor(st.p * 24);
          let out = "";
          for (let i = 0; i < target.length; i++) {{
            out += i < resolved ? target[i] : NOISE[(i * 7 + step * 13 + target.length) % NOISE.length];
          }}
          word.textContent = out;
        }} }}, at);
      }}
      tl.fromTo(word, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, 2.4);
      scramble("researched", 2.4, 0.7);
      scramble("drafted", 3.3, 0.6);
      tl.fromTo("#{fid}-l3", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }}, 4.0);
"""
    ev("scramble", fid, 2.4, dur=0.7, steps=24)
    ev("scramble", fid, 3.3, dur=0.6, steps=24)
    write(fid, frame(fid, 5, css, body, js))


# ---------------------------------------------------------------- 02 email
def email() -> None:
    fid = "02-email"
    text = "Hallo, der Wasserhahn in meiner Küche tropft seit drei Tagen und es wird immer schlimmer. Könnte bitte jemand vorbeikommen?"
    css = f"""
.{fid}-col {{ position: absolute; left: 50%; top: 170px; width: 1060px; margin-left: -530px; }}
.{fid}-card {{ position: relative; margin-top: 34px; padding: 44px 48px; }}
.{fid}-from {{ display: flex; align-items: center; gap: 18px; font-size: 26px; color: #a1a4ae; }}
.{fid}-av {{ width: 56px; height: 56px; border-radius: 50%; background: #2a2a45; color: #c9cdfa; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 22px; }}
.{fid}-subject {{ margin-top: 26px; font-size: 44px; font-weight: 600; color: #f4f5f8; letter-spacing: -0.01em; }}
.{fid}-body {{ margin-top: 20px; font-size: 32px; line-height: 1.5; color: #c7c9d1; min-height: 150px; }}
.{fid}-status {{ position: absolute; top: -26px; right: 36px; }}
"""
    body = f"""
    <div class="clip {fid}-col" data-start="0" data-duration="6" data-track-index="1">
      <div class="{fid}-kicker" id="{fid}-kicker">Inbox · 1 new</div>
      <div class="{fid}-card" id="{fid}-card">
        <div class="{fid}-from"><span class="{fid}-av">AS</span><span>Anna Schneider · Lindenhof 2.04</span></div>
        <div class="{fid}-subject">Wasserhahn in der Küche tropft</div>
        <div class="{fid}-body"><span id="{fid}-text"></span><span class="{fid}-caret" id="{fid}-caret"></span></div>
        <div class="{fid}-status" id="{fid}-status"><span class="{fid}-chip {fid}-chip-lime">● Agent run started</span></div>
      </div>
    </div>"""
    js = f"""
      tl.fromTo("#{fid}-kicker", {{ opacity: 0, x: -30 }}, {{ opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }}, 0.2);
      tl.fromTo("#{fid}-card", {{ opacity: 0, y: 90 }}, {{ opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }}, 0.9);
      typeOn(tl, $("#{fid}-text"), {text!r}, 2.0, 2.4, $("#{fid}-caret"));
      tl.fromTo("#{fid}-status", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }}, 4.7);
"""
    ev("type", fid, 2.0, dur=2.4, text=text)
    ev("pop", fid, 4.7)
    write(fid, frame(fid, 6, css, body, js))


# ---------------------------------------------------------------- 03 research
def research() -> None:
    fid = "03-research"
    W, H = 1640, 760  # canvas box, placed at (140, 120)
    nodes = [
        ("a", 60, 70, "Classify", "Gemini Flash Lite", "MODEL", "violet", "Repair · medium · German"),
        ("b", 60, 430, "Find tenant", "Tenant records", "LOOKUP", "grey", "Anna Schneider · Lindenhof 2.04"),
        ("c", 640, 250, "Search her lease", "Vector search", "TOOL", "grey", "§7 Small repairs: tenant pays up to €100"),
        ("d", 1220, 250, "Draft reply", "Gemini Flash", "DRAFT", "lime", "Guten Tag Frau Schneider, wir schicken einen Handwerker …"),
    ]
    NW = 380
    edges = [("a", "c"), ("b", "c"), ("c", "d")]
    pos = {n[0]: (n[1], n[2]) for n in nodes}
    tagcss = {
        "violet": "background: rgba(167,139,250,0.18); color: #c4b5fd;",
        "grey": "background: rgba(255,255,255,0.10); color: #d4d6dd;",
        "lime": "background: #c8f135; color: #15170b;",
    }
    css = f"""
.{fid}-canvas {{ position: absolute; left: 140px; top: 120px; width: {W}px; height: {H}px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.09);
  background-color: #0e0e13; background-image: radial-gradient(rgba(255,255,255,0.09) 1.4px, transparent 1.4px); background-size: 26px 26px; }}
.{fid}-k {{ position: absolute; left: 40px; top: 30px; }}
.{fid}-node {{ position: absolute; width: {NW}px; padding: 22px 24px; }}
.{fid}-head {{ display: flex; justify-content: space-between; gap: 10px; font-size: 22px; }}
.{fid}-title {{ font-weight: 600; color: #f4f5f8; }}
.{fid}-src {{ color: #7d808b; }}
.{fid}-txt {{ margin-top: 14px; font-size: 24px; line-height: 1.45; color: #c7c9d1; min-height: 70px; }}
.{fid}-wires {{ position: absolute; inset: 0; }}
"""
    node_html = []
    for nid, x, y, title, src, tag, tone, _ in nodes:
        node_html.append(
            f'<div class="{fid}-card {fid}-node" id="{fid}-n{nid}" style="left:{x}px;top:{y}px">'
            f'<div class="{fid}-head"><span class="{fid}-title">{title}</span><span class="{fid}-src">{src}</span></div>'
            f'<div style="margin-top:12px"><span class="{fid}-tag" style="{tagcss[tone]}">{tag}</span></div>'
            f'<div class="{fid}-txt"><span id="{fid}-t{nid}"></span><span class="{fid}-caret" id="{fid}-c{nid}"></span></div></div>'
        )
    paths = []
    for a, b in edges:
        (ax, ay), (bx, by) = pos[a], pos[b]
        x1, y1, x2, y2 = ax + NW, ay + 34, bx, by + 34
        paths.append(
            f'<path id="{fid}-e{a}{b}" d="M{x1} {y1} C{x1 + 110} {y1}, {x2 - 110} {y2}, {x2} {y2}" pathLength="1" '
            f'fill="none" stroke="#c8f135" stroke-opacity="0.75" stroke-width="2.5" stroke-dasharray="1" stroke-dashoffset="1"/>'
            f'<circle id="{fid}-d{a}{b}" cx="{x2}" cy="{y2}" r="6" fill="#c8f135" opacity="0"/>'
        )
    body = f"""
    <div class="clip {fid}-canvas" id="{fid}-canvas" data-start="0" data-duration="9" data-track-index="1">
      <svg class="{fid}-wires" viewBox="0 0 {W} {H}">{''.join(paths)}</svg>
      <div class="{fid}-kicker {fid}-k" id="{fid}-k">The agent · one run</div>
      {''.join(node_html)}
    </div>"""
    timings = {"a": (1.0, 1.0), "b": (2.8, 1.1), "c": (4.9, 1.3), "d": (6.9, 1.5)}
    js = [
        f'tl.fromTo("#{fid}-canvas", {{ opacity: 0, scale: 0.97 }}, {{ opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }}, 0);',
        f'tl.fromTo("#{fid}-k", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, 0.4);',
    ]
    for nid, *_rest in nodes:
        at, dur = timings[nid]
        text = _rest[-1]
        js.append(f'tl.fromTo("#{fid}-n{nid}", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }}, {at});')
        js.append(f'typeOn(tl, $("#{fid}-t{nid}"), {text!r}, {at + 0.4}, {dur}, $("#{fid}-c{nid}"));')
        ev("pop-soft", fid, at)
        ev("type", fid, at + 0.4, dur=dur, text=text)
    wire_at = {("a", "c"): 4.4, ("b", "c"): 4.6, ("c", "d"): 6.5}
    for (a, b), at in wire_at.items():
        js.append(f'tl.to("#{fid}-e{a}{b}", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.6, ease: "power2.inOut" }}, {at});')
        js.append(f'tl.fromTo("#{fid}-d{a}{b}", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, {at + 0.55});')
    write(fid, frame(fid, 9, css, body, "\n      ".join(js)))


# ---------------------------------------------------------------- 04 draft
def draft() -> None:
    fid = "04-draft"
    css = f"""
.{fid}-screen {{ position: absolute; left: 700px; top: 150px; width: 1120px; border-radius: 22px; overflow: hidden; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 60px 120px -40px rgba(0,0,0,0.95); }}
.{fid}-screen img {{ display: block; width: 100%; height: auto; }}
.{fid}-back {{ position: absolute; left: 1240px; top: 70px; width: 620px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.10); opacity: 0.55; }}
.{fid}-back img {{ display: block; width: 100%; height: auto; }}
.{fid}-copy {{ position: absolute; left: 110px; top: 230px; width: 560px; }}
.{fid}-h {{ font-size: 120px; }}
.{fid}-chiprow {{ margin-top: 40px; }}
"""
    body = f"""
    <div class="clip {fid}-back" id="{fid}-back" data-start="0" data-duration="7" data-track-index="1"><img src="assets/run-timeline.jpg" alt="" /></div>
    <div class="clip {fid}-screen" id="{fid}-screen" data-start="0" data-duration="7" data-track-index="2"><img src="assets/draft.jpg" alt="" /></div>
    <div class="clip {fid}-copy" data-start="0" data-duration="7" data-track-index="3">
      <div class="{fid}-display {fid}-h" id="{fid}-h">In their <span class="{fid}-lime {fid}-italic">language.</span></div>
      <div class="{fid}-chiprow" id="{fid}-chip"><span class="{fid}-chip {fid}-chip-lime">Draft ready in ~15s</span></div>
    </div>"""
    js = f"""
      tl.fromTo("#{fid}-screen", {{ opacity: 0, y: 140 }}, {{ opacity: 1, y: 0, duration: 1.4, ease: "power3.out" }}, 0.1);
      tl.fromTo("#{fid}-screen", {{ scale: 1 }}, {{ scale: 1.06, duration: 6.8, ease: "none" }}, 0.1);
      tl.fromTo("#{fid}-back", {{ opacity: 0, x: 120, rotation: 6 }}, {{ opacity: 0.55, x: 0, rotation: 4, duration: 1.2, ease: "power3.out" }}, 1.6);
      tl.fromTo("#{fid}-h", {{ opacity: 0, y: 50 }}, {{ opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }}, 3.4);
      tl.fromTo("#{fid}-chip", {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }}, 5.2);
"""
    ev("pop", fid, 5.2)
    ev("whoosh", fid, 7.0)  # peak lands on the cut into the emergency
    write(fid, frame(fid, 7, css, body, js))


# ---------------------------------------------------------------- 05 emergency
def emergency() -> None:
    fid = "05-emergency"
    reply = "Verlassen Sie sofort das Haus · Keine Schalter betätigen · Notruf 112 · Notdienst +49 30 5550 9999"
    css = f"""
.{fid}-mail {{ position: absolute; left: 120px; top: 170px; width: 640px; padding: 36px 40px; }}
.{fid}-from {{ font-size: 24px; color: #a1a4ae; }}
.{fid}-sub {{ margin-top: 18px; font-size: 40px; font-weight: 600; }}
.{fid}-body {{ margin-top: 14px; font-size: 26px; color: #c7c9d1; line-height: 1.45; }}
.{fid}-alert {{ position: absolute; left: 1000px; top: 170px; width: 720px; padding: 30px 36px; border-color: rgba(248,113,113,0.55); }}
.{fid}-red {{ background: #ef4444; color: #fff; }}
.{fid}-glow {{ position: absolute; left: 960px; top: 120px; width: 800px; height: 300px; border-radius: 40px; background: radial-gradient(closest-side, rgba(239,68,68,0.35), transparent); }}
.{fid}-atitle {{ margin-top: 16px; font-size: 40px; font-weight: 600; }}
.{fid}-person {{ margin-top: 20px; }}
.{fid}-reply {{ position: absolute; left: 1000px; top: 520px; width: 720px; padding: 30px 36px; }}
.{fid}-rh {{ font-size: 22px; color: #a1a4ae; }}
.{fid}-rt {{ margin-top: 14px; font-size: 28px; line-height: 1.5; color: #f4f5f8; min-height: 130px; }}
.{fid}-wire {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }}
"""
    body = f"""
    <div class="clip {fid}-glow" id="{fid}-glow" data-start="0" data-duration="8" data-track-index="1"></div>
    <div class="clip" data-start="0" data-duration="8" data-track-index="2">
      <svg class="{fid}-wire" viewBox="0 0 1920 1080"><path id="{fid}-w" d="M760 260 C 880 260, 880 260, 1000 260" pathLength="1" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    </div>
    <div class="clip {fid}-card {fid}-mail" id="{fid}-mail" data-start="0" data-duration="8" data-track-index="3">
      <div class="{fid}-from">Jonas Becker · 06:02</div>
      <div class="{fid}-sub">Gasgeruch im Treppenhaus!</div>
      <div class="{fid}-body">Im Treppenhaus riecht es stark nach Gas. Was sollen wir tun?</div>
    </div>
    <div class="clip {fid}-card {fid}-alert" id="{fid}-alert" data-start="0" data-duration="8" data-track-index="4">
      <span class="{fid}-tag {fid}-red">ALERT · GAS</span>
      <div class="{fid}-atitle">Safety emergency</div>
      <div class="{fid}-person" id="{fid}-person"><span class="{fid}-chip {fid}-chip-lime">A person is alerted now</span></div>
    </div>
    <div class="clip {fid}-card {fid}-reply" id="{fid}-reply" data-start="0" data-duration="8" data-track-index="5">
      <div class="{fid}-rh">Safety reply · German · waits for approval</div>
      <div class="{fid}-rt"><span id="{fid}-text"></span><span class="{fid}-caret" id="{fid}-caret"></span></div>
    </div>"""
    js = f"""
      tl.fromTo("#{fid}-mail", {{ opacity: 0, x: -80 }}, {{ opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }}, 0.1);
      tl.to("#{fid}-w", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.5, ease: "power2.inOut" }}, 1.3);
      tl.fromTo("#{fid}-alert", {{ opacity: 0, scale: 0.85 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.8)" }}, 1.6);
      tl.fromTo("#{fid}-glow", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4, ease: "power2.out" }}, 1.7);
      tl.to("#{fid}-glow", {{ opacity: 0.35, duration: 1.0, ease: "power2.inOut" }}, 2.2);
      tl.fromTo("#{fid}-person", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }}, 3.0);
      tl.fromTo("#{fid}-reply", {{ opacity: 0, y: 50 }}, {{ opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }}, 4.4);
      typeOn(tl, $("#{fid}-text"), {reply!r}, 4.8, 1.9, $("#{fid}-caret"));
"""
    ev("alert", fid, 1.6)
    ev("pop", fid, 3.0)
    ev("type", fid, 4.8, dur=1.9, text=reply)
    write(fid, frame(fid, 8, css, body, js))


# ---------------------------------------------------------------- 06 approve
def approve() -> None:
    fid = "06-approve"
    css = f"""
.{fid}-head {{ position: absolute; left: 0; right: 0; top: 120px; text-align: center; font-size: 104px; }}
.{fid}-card {{ position: absolute; left: 50%; top: 400px; width: 980px; margin-left: -490px; padding: 36px 44px; }}
.{fid}-line {{ height: 18px; border-radius: 9px; background: rgba(255,255,255,0.10); margin-top: 16px; }}
.{fid}-row {{ display: flex; gap: 18px; margin-top: 34px; align-items: center; }}
.{fid}-btn {{ border-radius: 999px; padding: 16px 30px; font-size: 26px; font-weight: 600; border: 1px solid rgba(255,255,255,0.14); color: #f4f5f8; }}
.{fid}-approve {{ background: #c8f135; color: #15170b; border-color: transparent; }}
.{fid}-sent {{ margin-left: auto; }}
.{fid}-meta {{ display: flex; justify-content: space-between; font-size: 22px; color: #a1a4ae; }}
"""
    body = f"""
    <div class="clip {fid}-display {fid}-head" id="{fid}-head" data-start="0" data-duration="6" data-track-index="1">Nothing is sent <span class="{fid}-lime {fid}-italic">until you approve.</span></div>
    <div class="clip {fid}-card" id="{fid}-card" data-start="0" data-duration="6" data-track-index="2">
      <div class="{fid}-meta"><span>Send reply · Re: Wasserhahn in der Küche tropft</span><span>Waiting for you</span></div>
      <div class="{fid}-line" style="width:92%"></div>
      <div class="{fid}-line" style="width:78%"></div>
      <div class="{fid}-line" style="width:85%"></div>
      <div class="{fid}-row">
        <span class="{fid}-btn {fid}-approve" id="{fid}-approve">✓ Approve</span>
        <span class="{fid}-btn">Edit</span>
        <span class="{fid}-btn">Reject</span>
        <span class="{fid}-sent" id="{fid}-sent"><span class="{fid}-chip {fid}-chip-lime">✓ Sent</span></span>
      </div>
    </div>"""
    js = f"""
      tl.fromTo("#{fid}-head", {{ opacity: 0, y: 50 }}, {{ opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }}, 0.1);
      tl.fromTo("#{fid}-card", {{ opacity: 0, y: 80 }}, {{ opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }}, 1.4);
      tl.to("#{fid}-approve", {{ scale: 0.9, duration: 0.15, ease: "power2.in" }}, 2.8);
      tl.to("#{fid}-approve", {{ scale: 1, duration: 0.35, ease: "back.out(3)" }}, 2.95);
      tl.fromTo("#{fid}-sent", {{ opacity: 0, x: -30 }}, {{ opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }}, 3.6);
"""
    ev("click", fid, 2.8)
    ev("chime", fid, 3.6)
    write(fid, frame(fid, 6, css, body, js))


# ---------------------------------------------------------------- 07 proof
def proof() -> None:
    fid = "07-proof"
    stats = [
        ("a", 0.2, 100, "", "%", 0, "of 32 test emails pass every check"),
        ("b", 1.8, 0.002, "$", "", 3, "per email, Gemini paid-tier prices"),
        ("c", 3.4, 15, "~", "s", 0, "from email in to draft ready"),
    ]
    css = f"""
.{fid}-row {{ position: absolute; left: 120px; right: 120px; top: 270px; display: flex; }}
.{fid}-stat {{ flex: 1; padding: 0 40px; border-left: 1px solid rgba(255,255,255,0.12); }}
.{fid}-stat:first-child {{ border-left: none; }}
.{fid}-num {{ font-size: 190px; color: #f4f5f8; font-variant-numeric: tabular-nums; }}
.{fid}-lab {{ margin-top: 24px; font-size: 30px; color: #a1a4ae; line-height: 1.4; }}
.{fid}-k {{ position: absolute; left: 160px; top: 160px; }}
"""
    cells = "".join(
        f'<div class="{fid}-stat" id="{fid}-s{sid}"><div class="{fid}-display {fid}-num"><span class="{fid}-lime">{pre}</span><span id="{fid}-v{sid}">0</span><span class="{fid}-lime">{suf}</span></div>'
        f'<div class="{fid}-lab">{lab}</div></div>'
        for sid, _at, _v, pre, suf, _d, lab in stats
    )
    body = f"""
    <div class="clip {fid}-kicker {fid}-k" id="{fid}-k" data-start="0" data-duration="6" data-track-index="1">Measured on 32 real-looking tenant emails</div>
    <div class="clip {fid}-row" data-start="0" data-duration="6" data-track-index="2">{cells}</div>"""
    js = [f'tl.fromTo("#{fid}-k", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, 0);']
    for sid, at, val, _pre, _suf, dec, _lab in stats:
        js.append(f'tl.fromTo("#{fid}-s{sid}", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }}, {at});')
        js.append(
            f'(() => {{ const el = $("#{fid}-v{sid}"); const st = {{ v: 0 }}; '
            f'tl.to(st, {{ v: {val}, duration: 1.2, ease: "power3.out", onUpdate() {{ el.textContent = st.v.toFixed({dec}); }} }}, {at}); }})();'
        )
    for sid, at, val, _pre, _suf, dec, _lab in stats:
        ev("count", fid, at, dur=1.2, value=val, decimals=dec)
    write(fid, frame(fid, 6, css, body, "\n      ".join(js)))


# ---------------------------------------------------------------- 08 cta
def cta() -> None:
    fid = "08-cta"
    css = f"""
.{fid}-stack {{ position: absolute; left: 0; right: 0; top: 150px; display: flex; flex-direction: column; align-items: center; }}
.{fid}-tile {{ width: 220px; height: 220px; border-radius: 52px; border: 1px solid rgba(255,255,255,0.14); background: linear-gradient(#1b1b21, #101014); display: flex; align-items: center; justify-content: center; }}
.{fid}-tile svg {{ width: 150px; height: 150px; }}
.{fid}-word {{ margin-top: 50px; font-size: 120px; font-weight: 600; letter-spacing: -0.03em; color: #f4f5f8; }}
.{fid}-word em {{ font-family: "Instrument Serif", serif; font-weight: 400; font-style: italic; font-size: 1.14em; letter-spacing: 0; }}
.{fid}-url {{ margin-top: 30px; font-family: "Geist Mono", monospace; font-size: 34px; color: #a1a4ae; }}
.{fid}-chiprow {{ margin-top: 34px; }}
"""
    body = f"""
    <div class="clip {fid}-stack" id="{fid}-stack" data-start="0" data-duration="6" data-track-index="1">
      <div class="{fid}-tile" id="{fid}-tile">
        <svg viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect id="{fid}-env" x="3" y="10" width="20" height="15" rx="3.2" stroke="#ffffff" stroke-width="1.6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
          <path id="{fid}-flap" d="M4.4 12.2 13 18.6l3.4-2.5" stroke="#ffffff" stroke-width="1.6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
          <path id="{fid}-arc" d="M16.4 16.1c3.6-2.7 6.5-6.2 10.6-10.3" stroke="#c8f135" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
          <path id="{fid}-head" d="M21.6 5.4h5.8v5.8" stroke="#c8f135" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        </svg>
      </div>
      <div class="{fid}-word" id="{fid}-word">Flow<em>Pilot</em></div>
      <div class="{fid}-url" id="{fid}-url">flow-pilot-rose.vercel.app</div>
      <div class="{fid}-chiprow" id="{fid}-chip"><span class="{fid}-chip {fid}-chip-lime">Try the demo →</span></div>
    </div>"""
    js = f"""
      tl.fromTo("#{fid}-tile", {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }}, 0.1);
      tl.to("#{fid}-env", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.7, ease: "power2.inOut" }}, 0.3);
      tl.to("#{fid}-flap", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.4, ease: "power2.inOut" }}, 0.9);
      tl.to("#{fid}-arc", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.45, ease: "power3.out" }}, 1.25);
      tl.to("#{fid}-head", {{ attr: {{ "stroke-dashoffset": 0 }}, duration: 0.3, ease: "power3.out" }}, 1.6);
      tl.fromTo("#{fid}-word", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }}, 1.8);
      tl.fromTo("#{fid}-url", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.7 }}, 3.0);
      tl.fromTo("#{fid}-chip", {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }}, 3.4);
      tl.to("#{fid}-stack", {{ opacity: 0.85, duration: 0.6, ease: "power2.in" }}, 5.4);
"""
    ev("whoosh", fid, 1.25)  # peak as the arrow shoots out of the envelope
    ev("pop", fid, 3.4)
    write(fid, frame(fid, 6, css, body, js))


for build in (hook, email, research, draft, emergency, approve, proof, cta):
    build()

import json

Path("sfx-events.json").write_text(json.dumps(EVENTS, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"wrote sfx-events.json ({len(EVENTS)} events)")
