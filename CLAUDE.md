# Mermaid Diagram Renderer

## Project Overview

**Mermaid Diagram Renderer** is a modern, interactive web application built with **React** and **Vite** that allows users to create, visualize, and export Mermaid diagrams in real-time.

It distinguishes itself with a focus on **usability** (multi-tab workspaces, auto-save, undo/redo), **export quality** (Inkscape-compatible SVGs), and **AI-powered assistance** for fixing syntax errors and modifying diagrams.

### Tech Stack

*   **Core:** React 18, Vite
*   **Diagramming:** `mermaid.js` (v11)
*   **AI Integration:** DeepInfra API (`openai/gpt-oss-20b`)
*   **State Management:** React Hooks + Custom Hooks (`useHistory`, `useLocalStorage`)
*   **Styling:** CSS (App.css, index.css)

### Key Features

*   **Live Preview:** Real-time rendering of Mermaid syntax.
*   **AI Error Correction:** 
    *   **Fix with AI:** Automatically appears when a syntax error occurs. It sends the broken code and error log to the AI for an immediate fix.
    *   **AI Assist:** A dedicated tool in the preview header that allows users to describe visual issues (e.g., "the arrow is broken") or requested changes. It includes the current error log to provide context to the AI.
*   **Enhanced Export:**
    *   **SVG:** Optimized for Inkscape (CSS variables resolved to attributes, `foreignObject` converted to `<text>`).
    *   **PNG:** Custom resolution/dimensions with aspect ratio locking.
*   **Productivity:** Multiple tabs, auto-save (localStorage), and History API (Undo/Redo).
*   **UX:** Auto-centering, Zoom controls, Dark/Light themes.
*   **Custom LLM:** Settings dialog for configuring custom OpenAI-compatible API providers (URL, model, API key).

## Building and Running

### Prerequisites
*   Node.js (v16+)
*   npm or yarn

### Configuration
Create a `.env` file in the root directory:
```env
VITE_DEEPINFRA_API_KEY=your_api_key_here
```
*Note: If the API key is empty, the AI features will attempt to call the API without a Bearer token, which may fail depending on provider restrictions.*

### Commands
*   **Install Dependencies:** `npm install`
*   **Start Dev Server:** `npm run dev`
*   **Build Production:** `npm run build`

## Development Conventions

### AI Correction Utility (`src/utils/aiCorrection.js`)

This utility centralizes all AI logic. It uses a **Knowledge Base** to help the AI navigate common Mermaid pitfalls:

1.  **Knowledge Base:** A string constant `ERROR_KNOWLEDGE_BASE` containing specific error patterns and their fixes (e.g., wrapping flowchart labels in quotes when parentheses are used, or removing `style` keywords from sequence diagrams).
    *   **Convention:** To ensure stable parsing and avoid JS syntax errors during build, **always write this constant as a single-line string** using `\n` for newlines instead of multi-line template literals.
2.  **Prompt Engineering:** Both `fixMermaidCode` and `assistMermaidCode` inject this knowledge base into the system prompt to ensure high-quality, valid Mermaid output.
3.  **Future Updates:** As new Mermaid syntax edge cases or common AI failures are identified, they should be added to the `ERROR_KNOWLEDGE_BASE` in `aiCorrection.js`.
4.  **Custom LLM Settings:**
    *   Users can configure custom LLM providers via the settings dialog (gear icon in header).
    *   Default settings (DeepInfra API, `openai/gpt-oss-20b` model, API key from `.env`) are hidden from client-side code.
    *   If ALL fields in settings are empty, defaults are used server-side.
    *   If ANY field is modified (URL, model, or API key), the app switches to custom settings.
    *   Custom settings are stored in localStorage as `mermaid-llm-settings`.
    *   `callAI()` accepts optional `customSettings` parameter and passes to OpenAI-compatible endpoint.

### Component Architecture

*   **`src/MermaidRenderer.jsx`**:
    *   Handles the core rendering logic.
    *   Exposes `getError()` via `useImperativeHandle` so the parent can pass error context to the AI.
    *   Displays the "Fix with AI" button directly in the error state.
    *   Accepts `llmSettings` prop and passes to `fixMermaidCode()`.
*   **`src/App.jsx`**:
    *   Manages the global state, tabs, history, and LLM settings.
    *   Implements the "AI Assist" dialog, settings dialog, and toolbar integration.
    *   Stores LLM settings in localStorage with default empty values.
    *   Passes `llmSettings` to both `MermaidRenderer` and `assistMermaidCode()`.

### SVG Export Logic

Three parallel implementations exist for SVG-to-Inkscape conversion:
*   **`src/App.jsx` (`exportSVG()`)** — Main in-app export (Ctrl+S). Uses live DOM + Canvas API for text measurement.
*   **`src/utils/inkscapeConverter.js`** — Browser-based converter for uploaded SVG files. Uses DOMParser + Canvas API.
*   **`svg_files/convert-to-inkscape.js`** — Node.js CLI tool using JSDOM (no Canvas; uses `fontSize * 0.42` char width estimate).

**All three must be kept in sync** when changing export behavior.

#### Key Conversion Steps
1.  CSS rules → inline SVG attributes (fill, stroke, etc.)
2.  `foreignObject` (HTML labels) → native SVG `<text>` elements
3.  Marker/arrowhead color extraction and reapplication
4.  ViewBox/bounding box recalculation (inkscapeConverter + CLI only)

#### `!important` Stripping
Mermaid's CSS sometimes includes `!important` on style values (e.g., `fill: #f99 !important`). When inlining CSS as SVG attributes, `!important` must be stripped — it is CSS-only syntax and invalid in SVG attribute values. Renderers like Inkscape are lenient and ignore it, but strict renderers like **WeasyPrint** fail to parse the color and default to black, breaking colored nodes in PDF output.

All three export files must:
1.  Strip `!important` from each value when converting inline `style` properties to SVG attributes (`.replace(/\s*!important\s*$/, '')`).
2.  Apply a final blanket cleanup on the serialized SVG string (`.replace(/\s*!important\s*/g, ' ')`) as a safety net for any values missed by per-property stripping.

#### Text Wrapping Rules
*   **`<br>` tags** are preserved as explicit line breaks using DOM tree walking (`walkNodes`) with a vertical tab marker (`\u000B`). The wrapping function splits on this marker first, then wraps each segment by width. Do NOT use innerHTML-based `<br>` replacement — HTML collapses `\n` whitespace.
*   **Width padding** prevents premature wrapping due to Canvas vs browser measurement differences:
    *   Cluster/subgraph labels: `width * 1.5`
    *   Edge labels: `width * 1.3`
    *   Node labels: `width * 1.15`
*   Canvas `measureText()` is used in browser exports for accurate width; the CLI fallback uses `fontSize * 0.42`.

#### Edge Label Background
Edge labels (parent has `edgeLabel` class) get a white/background-colored `<rect>` behind the `<text>` element, wrapped in a `<g>`. Background color is extracted from the HTML element's computed/inline `background-color`.

#### Emoji Support
When text contains emoji characters, emoji-capable fonts (`Noto Color Emoji`, `Segoe UI Emoji`, `Apple Color Emoji`) are appended to `font-family`. Requires `fonts-noto-color-emoji` package on Linux for Inkscape rendering.

#### Label Type Detection
Each `foreignObject` is classified by walking parent elements:
*   `edgeLabel` class → edge label
*   `cluster-label` class → cluster/subgraph label
*   Otherwise → node label