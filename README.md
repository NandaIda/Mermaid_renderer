# Mermaid Diagram Renderer

A modern, interactive web application for creating and visualizing Mermaid diagrams in real-time.

## Features

- **Live Preview**: See your diagrams update in real-time as you type
- **Multiple Workspaces**: Create and manage multiple diagram tabs/workspaces
- **Export Options**: Export diagrams as PNG or SVG files
- **Auto-Save**: All diagrams automatically saved to localStorage
- **Undo/Redo**: Full history support with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- **Theme Support**: Choose from 4 different Mermaid themes (Light, Dark, Forest, Neutral)
- **Example Templates**: Quick-start with pre-built diagram examples
- **Keyboard Shortcuts**: Efficient workflow with Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+S (export SVG)
- **Modern UI**: Clean, responsive interface built with React and Vite
- **Error Handling**: Helpful error messages when diagram syntax is invalid

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Write Mermaid Code**: Enter your Mermaid diagram syntax in the left editor panel
2. **View Preview**: The diagram renders automatically in the right preview panel
3. **Try Examples**: Click on example buttons to load pre-built diagram templates
4. **Multiple Tabs**: Click the "+" button to create new workspaces for different diagrams
5. **Rename Tabs**: Click on the tab name to rename your diagrams
6. **Export**: Click "SVG" or "PNG" buttons to download your diagrams
7. **Undo/Redo**: Use Ctrl+Z and Ctrl+Y to navigate through your edit history
8. **Change Theme**: Select different themes from the dropdown in the header
9. **Auto-Save**: All your work is automatically saved and persists between sessions

## Supported Diagram Types

- Flowcharts
- Sequence Diagrams
- Class Diagrams
- State Diagrams
- Pie Charts
- Gantt Charts
- Git Graphs
- Entity Relationship Diagrams
- And more!

## Keyboard Shortcuts

- **Ctrl+Z / Cmd+Z**: Undo last change
- **Ctrl+Y / Cmd+Y**: Redo last undone change
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo (alternative)
- **Ctrl+S / Cmd+S**: Export as SVG

## Technologies Used

- **React 18**: Modern UI library with hooks
- **Vite**: Fast build tool and dev server
- **Mermaid.js v11**: Diagram rendering library
- **LocalStorage API**: For automatic persistence

## Learn More

- [Mermaid Documentation](https://mermaid.js.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
