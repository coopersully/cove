# Cove — Brand Guidelines

> A community platform should feel like a place you want to be, not a product you're being sold.

---

## The idea

Cove is an open-source, community-focused platform for internet-native people. It exists because the spaces we gather in online have drifted toward noise, engagement metrics, and visual clutter — and away from the people in them.

Cove should feel like a well-lit room with good chairs. Comfortable enough to stay in for hours. Quiet enough to think. Alive enough to not feel sterile.

The brand reflects this. It borrows the trust and restraint of editorial design — think journals, independent magazines, public radio — but leaves room for the people using it to be the personality.

---

## Principles

These guide every design, copy, and product decision.

**1. The platform is the background.**
Cove is infrastructure, not identity. The UI, the brand, the copy — all of it should recede so the people and their conversations come forward. If someone notices the platform more than the community, something is wrong.

**2. Comfort over excitement.**
We're not trying to hype anyone up. We're trying to make a space that feels settled and easy to be in. Warm neutrals over neon. Breathing room over density. Calm over stimulation.

**3. Trust through restraint.**
Credibility comes from what you don't do. No attention-grabbing animations. No dark patterns. No engagement tricks. Cove earns trust the same way a good newspaper does — by being consistent, clear, and respectful of your time.

**4. Simple until proven otherwise.**
Every feature, every UI element, every word should justify its existence. If it doesn't serve the person using it, it doesn't ship. Modularity means people opt into complexity — they're never dropped into it.

**5. People-first, always.**
The humans in the room are more interesting than the room itself. Design and copy should amplify people, not compete with them.

---

## Voice & tone

Cove's voice is the voice of a thoughtful friend who happens to be good at design. Not a brand. Not a mascot. Not a corporation.

### We sound like

- A well-edited independent publication
- A friend explaining something clearly over coffee
- Someone who respects your intelligence and your time

### We don't sound like

- A startup trying to convince you something is revolutionary
- A brand that uses exclamation points to manufacture enthusiasm
- A corporation being casual (the "hey guys!" energy)
- A textbook or a terms-of-service document

### In practice

**Warm, not performative.** We're friendly because we mean it, not because a brand guide told us to be. No forced excitement. No "we're so thrilled to announce."

**Clear, not clever.** If a simpler word works, use it. We'd rather be understood than admired. Jargon is acceptable when it's the actual right word — not when it's filler.

**Confident, not loud.** We state things plainly. We don't hedge everything with "we think" or "we believe" — but we also don't oversell. Let the work speak.

**Honest about limitations.** If something is in beta, say so. If we don't know, say so. Trust is built by being straight with people, not by projecting certainty.

### Capitalization & punctuation

- Sentence case everywhere. Not Title Case. Not ALL CAPS.
- Cove is always capitalized (it's a name).
- No periods on headlines or buttons.
- Oxford comma, always.
- Em dashes are fine — we like them.

---

## Visual identity

### Philosophy

Cove's visual language borrows from editorial and print design traditions. Clean grids. Generous whitespace. Typography that does the heavy lifting. The goal is a UI that feels like a well-typeset page — structured but not rigid, minimal but not cold.

### Color

The palette is warm and neutral with a single accent for interactive elements. Think parchment, ink, and a fireplace glow.

```
Background       #FAFAF7    warm off-white, the color of good paper
Surface          #F2F0EB    slightly darker, for cards and panels
Border           #E2DFD8    soft, warm gray for separation
Text primary     #1C1917    near-black with warmth, not pure #000
Text secondary   #78716C    muted warm gray for supporting text
Accent           #B45309    amber/cove-glow, used sparingly
Accent hover     #92400E    deeper amber for interactive states
Danger           #B91C1C    muted red, only for destructive actions
Success          #15803D    muted green, only for confirmations
```

**Usage rules:**
- The accent color is for interactive elements only — links, buttons, active states. It should feel like a small, warm light in a calm room. Not a siren.
- Avoid pure black (`#000`) and pure white (`#FFF`). They feel harsh. The warm variants above are intentional.
- When in doubt, use less color. Let the typography and whitespace carry the design.

### Dark mode

```
Background       #1C1917    warm near-black
Surface          #292524    slightly lifted
Border           #44403C    warm dark gray
Text primary     #FAFAF7    warm off-white
Text secondary   #A8A29E    muted warm gray
Accent           #D97706    slightly brighter amber for visibility
Accent hover     #F59E0B    lighter amber on hover
```

Dark mode should feel like the same room with the lights dimmed — not a different room entirely. Same warmth, same proportions, just inverted.

### Typography

**Primary typeface: a humanist sans-serif.**
We recommend [Inter](https://rsms.me/inter/) as the default. It's open-source, highly legible, has excellent variable font support, and reads well at every size. It's quietly good — you don't notice it, which is the point.

**Monospace: for code and technical contexts.**
[JetBrains Mono](https://www.jetbrains.com/lp/mono/) or [Berkeley Mono](https://berkeleygraphics.com/typefaces/berkeley-mono/) if licensing allows. For open-source fallback, JetBrains Mono is the move.

**Type scale:**

```
xs       0.75rem / 12px    Fine print, metadata
sm       0.875rem / 14px   Secondary text, captions
base     1rem / 16px       Body text, the default
lg       1.125rem / 18px   Slightly emphasized body
xl       1.25rem / 20px    Section headers
2xl      1.5rem / 24px     Page headers
3xl      1.875rem / 30px   Hero text (rare)
```

**Line height:** 1.5 for body text, 1.25 for headings. Generous line height is non-negotiable — it's where the "comfortable" feeling comes from.

**Font weight:** Regular (400) for body, Medium (500) for emphasis and labels, Semibold (600) for headings. Bold (700) exists but should be used rarely. If everything is bold, nothing is.

### Spacing & layout

- Use a 4px base grid. All spacing values should be multiples of 4.
- Default content max-width: 640px for text-heavy views (readable line length).
- Generous padding on containers. When in doubt, add more space, not more decoration.
- Avoid visual borders where whitespace alone can create separation.

### Iconography

- Line icons only, consistent stroke width (1.5px–2px).
- [Lucide](https://lucide.dev/) is the recommended icon set — it's open-source, clean, and well-maintained.
- Icons support text; they don't replace it. Always pair icons with labels in navigation and actions.

### Radius & shape

```
Subtle rounding:  4px–6px for small elements (badges, inputs)
Moderate:         8px for cards and containers
None:             0px for full-width sections and large layout blocks
```

Avoid pill shapes (full-radius buttons) and heavy rounding. Cove should feel grounded and editorial, not bubbly.

---

## Logo usage

*[Placeholder — logo to be designed]*

Guiding constraints for the eventual logo:

- Should work as a small favicon and a large header mark.
- Wordmark preferred over an abstract symbol. The name "Cove" carries meaning — let it be read.
- No gradients, no shadows, no effects. Flat, single-color, works in monochrome.
- Should feel like it belongs on the masthead of a journal, not on a tech startup's pitch deck.

---

## Writing for Cove

### UI copy

- Labels and buttons should be verbs when possible: "Create," "Save," "Leave" — not "Submit" or "Confirm."
- Error messages should say what happened and what to do about it. No "Something went wrong."
- Empty states are an opportunity to be helpful, not cute. Tell people what goes here and how to fill it.
- Tooltips and help text should be one sentence. If it takes more than one sentence to explain, the feature is too complicated.

### Documentation

- Write for someone who is smart but unfamiliar with the project.
- Lead with what something does and why someone would want it. Save how it works for second.
- Code examples over long explanations.
- Keep pages short. Link to related pages rather than trying to cover everything in one place.

### Community communication

- Changelogs should be honest and scannable. What changed, what it affects, and any breaking changes — in plain language.
- Don't say "exciting" about your own work. Let people decide if they're excited.
- Acknowledge contributions publicly and specifically. "Thanks to @name for this" > "Thanks to our amazing community."

---

## What Cove is not

Defining edges helps as much as defining the center.

- **Not a brand with personality.** Cove's personality is the absence of a performed personality. The personality comes from the people.
- **Not minimal for aesthetics.** We're minimal because every unnecessary element is a small tax on attention. Simplicity is functional.
- **Not neutral on values.** We are opinionated about respecting people's time, attention, and autonomy. That's a position, and we hold it.
- **Not trying to be cool.** Cool alienates. Comfortable includes.

---

## Contributing to the brand

If you're contributing to Cove — code, design, docs, or community — these guidelines are here to help, not restrict. The goal is coherence, not conformity.

When making a decision the guidelines don't cover, ask: *Does this make the space more comfortable and trustworthy for the person using it?* If yes, you're probably fine.

If you think the guidelines are wrong about something, open an issue. The brand is open-source too.
