---
format: 1920x1080
duration: 53s
message: "Every tenant email researched and drafted before you open it, and nothing is sent until you approve."
arc: Hook → The email → The research → The draft → The emergency → Your call → Proof → CTA
audience: Property managers; recruiters and engineers viewing the portfolio
mode: autonomous
music: none
captions: skipped (no narration; on-screen type carries the story)
---

## Video direction

- **Palette (frame.md roles):** canvas `ink-black` #0b0b0f everywhere; text `cream` #f4f5f8; secondary text `cream-muted`; the single accent `fire-orange` (here signal lime #c8f135) for the hero word, wires, chips and the logo arrow; `violet` #a78bfa only for "model" tags; a warm red only on the emergency frame.
- **Type:** display = Instrument Serif (one weight, sentence case, italic for emphasis); UI / body = Geist; chrome, tags and glyphs = Geist Mono uppercase 0.14em.
- **Motif:** the product's glyph field (@ € § letters) appears only where a reveal happens, never as wallpaper.
- **Motion grammar:** long-tail `power3` eases, smooth over bouncy. Every frame reveals piece by piece across its duration (silent film, so reveals land on the beat, about every 0.8–1.4 s). Typing is the signature move of the product and recurs in frames 2, 3, 5.
- **Rhythm:** frames 1–3 build, 4 is a calmer push on a real screen, 5 is the tense peak (red), 6 is the release, 7 is a held read on the numbers, 8 resolves.
- **Never:** front-load then freeze (slideshow); everything floating independently (screensaver); purple-blue AI gradients; real email addresses; text in the bottom 17%.

## Frame 1 — Hook

- scene: Glyph field flickers, then "Tenant email," and a scrambling lime word settle into "before you open it."
- duration: 5s
- poster: 4s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- blueprint: compose

Scene 1 (0.0–1.2s): black; a loose band of glyphs (@ € § letters, lime / violet / white) flickers in across the middle third. Scene 2 (1.2–2.6s): display line "Tenant email," rises in, centered upper-middle. Scene 3 (2.6–4.0s): beneath it a lime italic word scrambles through glyphs and resolves "researched" → "drafted"; glyph band fades as the word lands. Scene 4 (4.0–5.0s): "before you open it." fades up under it; hold.

## Frame 2 — The email

- scene: A tenant email card slides into an empty inbox and its body types itself.
- duration: 6s
- poster: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-email.html
- type: problem
- blueprint: compose

Scene 1 (0.0–1.0s): mono kicker "INBOX · 1 NEW" top-left of a centered column. Scene 2 (1.0–2.0s): an email card (avatar "AS", Anna Schneider, subject "Wasserhahn in der Küche tropft") slides up into the column, ~55% width. Scene 3 (2.0–4.6s): the German body types out with a lime caret. Scene 4 (4.6–6.0s): a lime chip "Agent run started" pops at the card's top-right; hold.

## Frame 3 — The research

- scene: Agent steps appear one by one on a dotted canvas, joined by lime wires, each typing its result.
- duration: 9s
- poster: 8.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-research.html
- type: solution
- blueprint: compose

Scene 1 (0.0–1.0s): dotted canvas panel fills ~80% of frame; kicker "THE AGENT" top-left. Scene 2 (1.0–2.8s): node "Classify" (violet tag "MODEL") appears left-top and types "Repair · medium · German". Scene 3 (2.8–4.6s): node "Find tenant" left-bottom types "Anna Schneider · Lindenhof 2.04". Scene 4 (4.6–6.6s): wires draw from both to the center node "Search her lease" which types "§7 Small repairs: up to €100". Scene 5 (6.6–9.0s): a wire draws right to node "Draft reply" (lime tag "DRAFT") typing "Guten Tag Frau Schneider…"; hold.

## Frame 4 — The draft

- scene: The real app screen with the agent's German draft, pushing in slowly; a lime label names what happened.
- duration: 7s
- poster: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-draft.html
- type: demo
- blueprint: compose
- asset_candidates: assets/draft.jpg — app: the agent's German draft under the email; assets/run-timeline.jpg — app: the run's steps
- focal: assets/draft.jpg
- roles: draft = cutout (framed screen) · run-timeline = supporting (smaller tilted card)

Scene 1 (0.0–1.6s): draft.jpg in a rounded screen frame enters from below, centered right, ~62% width; slow push-in runs under the whole shot. Scene 2 (1.6–3.4s): run-timeline.jpg card slides in behind-left, tilted, dimmed. Scene 3 (3.4–5.2s): display line "In their language." rises on the left. Scene 4 (5.2–7.0s): lime chip "Draft ready in ~15s" lands under it; hold.

## Frame 5 — The emergency

- scene: A gas email arrives; a red alert node fires, a person is alerted, and the safety reply types.
- duration: 8s
- poster: 7.5s
- transition_in: cut
- status: animated
- src: compositions/frames/05-emergency.html
- type: differentiator
- blueprint: compose

Scene 1 (0.0–1.4s): email card left (Jonas Becker, "Gasgeruch im Treppenhaus!") snaps in. Scene 2 (1.4–3.0s): a red "ALERT · GAS" node fires right of it with a red wire; a soft red pulse once. Scene 3 (3.0–4.6s): chip "A person is alerted now" appears under the node. Scene 4 (4.6–8.0s): a reply card types the safety lines: "Leave the building · No switches · Call 112 · Hotline +49 30 5550 9999"; hold.

## Frame 6 — Your call

- scene: Approve / Edit / Reject; the Approve button presses and the draft turns into "Sent".
- duration: 6s
- poster: 5.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-approve.html
- type: solution
- blueprint: compose

Scene 1 (0.0–1.4s): display line "Nothing is sent" + italic lime "until you approve." top-center. Scene 2 (1.4–2.6s): a draft card with three buttons (Approve lime, Edit, Reject) rises center. Scene 3 (2.6–3.6s): Approve presses (scale dip + flash). Scene 4 (3.6–6.0s): the card's status flips to a lime "Sent" chip with a check; hold.

## Frame 7 — Proof

- scene: Three numbers count up: 100%, $0.002, ~15s.
- duration: 6s
- poster: 5.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-proof.html
- type: proof
- blueprint: compose

Scene 1 (0.0–1.8s): "100%" counts up left, label "of 32 test emails pass every check". Scene 2 (1.8–3.4s): "$0.002" counts up center, label "per email". Scene 3 (3.4–6.0s): "~15s" counts up right, label "email in → draft ready"; hairlines between; held read.

## Frame 8 — CTA

- scene: The logo mark draws itself, the FlowPilot wordmark and the URL appear.
- duration: 6s
- poster: 5.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/08-cta.html
- type: cta
- blueprint: compose
- asset_candidates: assets/logo-mark.svg — the FlowPilot mark
- focal: assets/logo-mark.svg
- roles: logo-mark = cutout (centered)

Scene 1 (0.0–1.6s): the envelope outline draws, then the lime flight-path arrow shoots out of the flap, centered upper-middle. Scene 2 (1.6–3.0s): wordmark "Flow" (Geist) + "Pilot" (serif italic) fades up under it. Scene 3 (3.0–4.4s): URL "flow-pilot-rose.vercel.app" in mono + lime chip "Try the demo". Scene 4 (4.4–6.0s): hold; final frame fades slightly at the very end.
