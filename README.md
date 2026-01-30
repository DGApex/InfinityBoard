# ♾️ InfiniteBoard

**InfiniteBoard** is a next-generation visual collaboration tool powered by AI. It combines the flexibility of an infinite canvas with advanced Generative AI capabilities, allowing you to brainstorm, design, and create moodboards with unprecedented speed.

![InfiniteBoard Banner](https://via.placeholder.com/1200x600?text=InfiniteBoard+Preview)

## ✨ Key Features

### 🎨 Infinite Canvas
*   **Boundless Space**: Pan and zoom infinitely to organize massive projects.
*   **Vector Performance**: Built on `Konva` for high-performance rendering of thousands of items.
*   **Grid System**: Customizable "Hatch" grid with snapping capabilities.
*   **Dark Mode**: A sleek, professional dark interface with neon orange accents.

### 🛠️ Creative Tools
*   **Pointer**: Select, move, and transform items (Scale, Rotate).
*   **Shapes**: Quickly add primitive shapes (Rectangles, Circles).
*   **Sticky Noties**: Add rich text notes for brainstorming.
*   **Text Tool**: Typography support for headers and labels.
*   **Drawing**: Freehand pencil, lines, and arrows with adjustable stroke/color.
*   **Z-Index Control**: "Bring to Front" and "Send to Back" layers.

### 🤖 AI Power (Gemini + Imagen)
*   **Panel Creator**: A dedicated AI interface to generate high-quality images.
    *   **Prompt Enhancement**: Uses `Gemini 2.5 Flash` to rewrite simple prompts into professional art descriptions.
    *   **Image Generation**: Uses `Imagen 4.0 Fast` for lightning-fast, high-res results.
    *   **Use as Reference**: Context-aware generation! Right-click any image on the board to use it as a style/structural reference for new generations.
*   **Vision Bridge**: Analyzes existing images to maintain artistic consistency across your board.

### 📂 Board Management
*   **Local Privacy**: All data is saved locally to your machine (JSON format).
*   **Export**: Support for exporting the viewport to High-Res PNG (with watermark option).
*   **Grouping**: Group multiple items to move them as a single unit.
*   **Installers**: Native `.exe` and `.msi` installers for Windows.

## 🧩 Agentic Skills (Power User)

InfiniteBoard is designed to be controlled by AI Agents. It includes two specialized **Skills** that allow for complex workspace manipulation:

### 1. Moodboard Template Creator (`moodboard-template-creator`)
*   **Focus**: Structure & Layout.
*   **Capability**: Generates reusable JSON templates with intelligent layouts (Grid, Masonry, Scatter, Filmstrip) using placeholder elements.
*   **Use Case**: "Create a 3-column masonry layout for 12 items."

### 2. Board Generator (`board-generator`)
*   **Focus**: Content & Orchestration.
*   **Capability**: Generates comprehensive boards with assets. It features **Sequential Consistency** (maintaining style/characters across different images) and **Vision Bridge** (analyzing references).
*   **Use Case**: "Generate a cyberpunk story about a cat."

### ⚡ The "Combo" Workflow
Combine these skills for maximum control:
1.  **Define Structure**: Use the Template Creator to build the perfect skeleton (e.g., `Timeline4Acts.json`).
2.  **Inject Life**: Use the Board Generator to "fill" that specific template with new, context-aware content.
    > *"Take the Timeline4Acts template and fill it with a Samurai story in the style of Persona 3."*

## 🚀 Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` + Drag | Pan Canvas |
| `Wheel` | Zoom In/Out |
| `Del` | Delete Selection |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + G` | Group Selection |

## 📦 Installation

### Prerequisites
*   Windows 10/11
*   [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (Usually pre-installed)

### Running from Source
1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run Development Mode**:
    ```bash
    npm run tauri dev
    ```

### Building Installers
To create the `.exe` and `.msi` installers:

```bash
npm run tauri build
```

The output files will be located in:
*   `src-tauri/target/release/bundle/nsis/*.exe`
*   `src-tauri/target/release/bundle/msi/*.msi`

## 🏗️ Tech Stack

*   **Frontend**: React, Vite, TailwindCSS, Framer Motion
*   **Canvas Engine**: React-Konva (HTML5 Canvas)
*   **Backend / Native**: Tauri (Rust)
*   **AI Models**:
    *   Google Gemini 2.5 Flash (Logic & Vision)
    *   Google Imagen 4.0 Fast (Image Generation)

## 📄 License

This project is free to use in ant scenario, happy to recive opinions and do whatever you like!
