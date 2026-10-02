# Build Prompt: Adaptive Study App Generator

Build a web application that turns any uploaded course material into a self-contained, gamified study app with review flashcards and a practice exam — tailored to the student's education level.

## Core user flow

1. User uploads one or more source files (or pastes a YouTube URL).
2. User selects an education level: **Kinder**, **Grade School (K-6)**, **High School (7-12)**, or **College**.
3. The system extracts and normalizes the content, segments it into topical lessons, and generates review material + a practice exam for each lesson, matched to the chosen level.
4. The system outputs a finished, self-contained study web app the student can use immediately — reviewable, downloadable, and shareable via link.

## Supported input formats

Use **[MarkItDown](https://github.com/microsoft/markitdown)** (Microsoft's open-source library) as the extraction/normalization engine — it already converts every format below into clean Markdown, which becomes the single intermediate representation the rest of the pipeline works from. Don't hand-roll per-format parsers; wrap MarkItDown and add the cleanup pass described in the pipeline section.

- **Office & Docs:** PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), EPub
- **Media:** Images (EXIF metadata + OCR text extraction), Audio (speech-to-text transcription)
- **Web & Data:** HTML, CSV, JSON, XML, YouTube URLs (transcript extraction), ZIP (recurses into contents and converts each file)

Validate file type and size at upload; reject or warn on unsupported/corrupt files with a specific, actionable error message (not a generic failure).

## Education-level tiers

The selected level changes vocabulary complexity, sentence length, question format mix, and visual tone — not just difficulty:

| Level | Reading level | Question style | Visual tone |
|---|---|---|---|
| Kinder | Single words / short phrases | Picture-matching, true/false, large tap targets | Bright, playful, heavy illustration, minimal text |
| Grade School (K-6) | Short sentences, plain vocabulary | Multiple-choice + true/false, instant encouraging feedback | Playful but legible, mascot/progress-mechanic driven (see below) |
| High School | Full sentences, subject vocabulary | Multiple-choice, true/false, short-answer/fill-in-the-blank | Clean and modern, less gamified, more like a study tool |
| College | Academic register | Multiple-choice, short-answer, scenario/application questions | Minimal, editorial, exam-like — gamification optional/subtle |

Detect and preserve the **source content's language** (e.g., Filipino-medium material should produce a Filipino-language app, not translate to English).

## Processing pipeline

1. **Extract** — run each uploaded file through MarkItDown to get raw Markdown.
2. **Clean** — slide decks and scanned PDFs convert messily (repeated headers/footers on every slide, spaced-out letters from vector text, broken tables, duplicate boilerplate like prayers/workplans in a lesson deck). Run an LLM cleanup pass that strips this noise and reconstructs the actual teaching content.
3. **Segment into lessons** — don't map files 1:1 to lessons. Group by *topic*, not by source document or slide/day. Pages that are pure activities, assessments, or drawing exercises with no new teachable concept should be folded into the nearest content lesson rather than becoming a thin standalone lesson.
4. **Generate per lesson:**
   - 4-7 flashcards covering the core concepts/vocabulary, each with a short definition grounded in the source text.
   - 8 quiz questions (mix of multiple-choice and true/false, adjusted per the tier table above), each with a distinct, plausible set of wrong answers and a one-line explanation for both correct and incorrect feedback.
5. **Design a visual identity per subject** — do not reuse one generic theme across unrelated subjects. Pick a palette, type pairing, and a progress mechanic *grounded in the subject itself* (e.g., a science unit could grow a plant, a geography unit could build a town, a reading unit could grow a train — the mechanic should mean something, not be arbitrary). Avoid generic AI-app defaults (cream+terracotta, purple gradients, emoji as section headers).
6. **Assemble the app** (see requirements below) and render it.

## Requirements for the generated study app

Each generated app must include:

- **Lesson map / home screen** — list of generated lessons with stars/progress earned so far.
- **Flashcard review screen** — one concept at a time, with a simple icon, term, and definition; previous/next navigation.
- **Quiz screen** — one question at a time, progress indicator, instant feedback per answer (correct/incorrect, with explanation), locked options after answering.
- **Results screen** — score, a star rating, and the subject-grounded progress visual fully or partially complete depending on score; options to retry the lesson or return to the lesson map.
- **Mobile-responsive** — must include a proper viewport meta tag and fluid layout; test down to ~360px width.
- **Light/dark theme support** — respect the user's OS theme preference.
- **Accessible** — real `<button>` elements, visible focus states, `prefers-reduced-motion` respected.
- **Self-contained output** — a single downloadable HTML file with no build step required to run it (inline CSS/JS, Google Fonts is the one external dependency allowed), so a student can save and open it offline.
- **Also shareable via a hosted link** for students who don't want to download a file.

## Suggested architecture

- **Frontend:** upload UI (drag-and-drop + YouTube URL field), level selector, processing-status view (OCR/transcription can take real time — show progress, not a frozen spinner), and a preview/download screen for the generated app.
- **Backend:** a job queue that runs MarkItDown extraction, then an LLM pass (cleanup → segmentation → flashcard/quiz generation → per-subject theme selection), then renders the static HTML output from a template.
- **Storage:** temporary storage for uploaded source files (delete after processing completes, or on a short TTL); persistent storage only for the generated app output and a link/slug to access it.
- **LLM integration:** use the Claude API for the content-understanding steps (cleanup, segmentation, question generation, theme/metaphor selection) — these are exactly the judgment-heavy steps that shouldn't be hardcoded rules.

## Non-functional requirements

- File size limits per upload and a total-per-session cap; clear messaging when exceeded.
- Uploaded source content must not be retained longer than needed to generate the app — this is student material and may include personal data (e.g., handwriting in scanned homework).
- Processing should degrade gracefully: if OCR or transcription confidence is low, flag it in the output rather than silently generating wrong quiz content from garbled text.
- Reasonable generation time; show the student what step is currently running (extracting → cleaning → building lessons → designing → done).

## Acceptance criteria

- Uploading a real multi-file lesson pack (e.g., a term's worth of slide decks) produces a working app with sensibly-grouped lessons, not one lesson per file.
- The four grade-level tiers visibly change question style and visual tone, not just word count.
- Two different subjects uploaded in the same session produce visually distinct generated apps (different palette, type, and progress mechanic) — not the same skin recolored.
- The generated app works fully offline once downloaded, on both desktop and a real phone.
