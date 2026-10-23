---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Every tenant email researched and drafted before you open it, and nothing is sent until you approve."
destination: linkedin
aspect: 1920x1080
language: en
audience: "Property managers, and recruiters/engineers viewing the portfolio"
length: 50s
angle: one-email-journey
---

## Intent

A 45–60 second promo for FlowPilot, an AI email agent for property managers,
for LinkedIn and the top of the GitHub README. Sell the product (a promo, not a
tour). The user asked me to make it ("saweb nta") and will record the real
screen demo separately.

Story: one tenant email arrives → the agent researches it (classify, find the
tenant, search the tenant's own lease) → drafts the reply in the tenant's
language → a gas emergency is escalated to a person with safety steps → the
manager approves; nothing is sent without approval. Proof: 100% of 32 eval
emails pass every check, about $0.002 per email. Close on the logo and
flow-pilot-rose.vercel.app.

## Assets

- ../../public/landing/conversation.jpg — app: a tenant conversation (demo data)
- ../../public/landing/draft.jpg — app: the agent's draft reply under the email
- ../../public/landing/run-timeline.jpg — app: one agent run, step by step
- ../../public/landing/buildings.jpg — app: buildings list
- ../../public/landing/documents.jpg — app: lease documents and search
- ../../src/app/icon.svg — the logo mark (envelope whose flap becomes a lime flight path)

## Customizations

- Glyph motif from the product's background: @ € § and letters, revealed around a moving point.
- Wordmark: "Flow" in Geist semibold, "Pilot" in Instrument Serif italic.
- Quiet, sample-accurate sound track (user: "not too loud", "make it pro"): one real keystroke per typed character at the instant it appears, a digital blip on each glyph change of the scrambling headline word, ticks on the count-ups, pops on chips and nodes, a soft two-tone alert, a click + chime on Approve, two low whooshes peaking on the emergency cut and the logo. Built by scripts/build-sfx.py from sfx-events.json (written by scripts/build-frames.py from the same timings), mounted as assets/sfx/track.wav.

## Notes

- Brand: black canvas, signal lime #c8f135 accent, violet #a78bfa second, white text.
- Fonts: Instrument Serif (display), Geist (sans), Geist Mono (glyphs).
- On-screen type only, no voiceover, no music bed (no offline music engine); quiet SFX only.
- Use only demo data; never show the real Gmail address.
