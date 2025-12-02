import { useState, useRef, useEffect } from 'react'
import MermaidRenderer from './MermaidRenderer'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useHistory } from './hooks/useHistory'
import './App.css'

const defaultDiagram = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]`

const examples = {
  flowchart: `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]`,
  sequence: `sequenceDiagram
    participant User
    participant Browser
    participant Server
    User->>Browser: Enter URL
    Browser->>Server: HTTP Request
    Server->>Browser: HTTP Response
    Browser->>User: Display Page`,
  classDiagram: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }`,
  pie: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`,
  gantt: `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
    A task           :a1, 2024-01-01, 30d
    Another task     :after a1, 20d
    section Another
    Task in sec      :2024-01-12, 12d
    another task     :24d`,
}

function App() {
  const [tabs, setTabs] = useLocalStorage('mermaid-tabs', [
    { id: 1, name: 'Diagram 1', code: defaultDiagram }
  ])
  const [activeTabId, setActiveTabId] = useLocalStorage('mermaid-active-tab', 1)
  const [theme, setTheme] = useLocalStorage('mermaid-theme', 'default')
  const [zoom, setZoom] = useState(1)
  const [nextId, setNextId] = useState(2)
  const [showPngDialog, setShowPngDialog] = useState(false)
  const [pngSize, setPngSize] = useState({ width: 1920, height: 1080 })
  const [aspectRatio, setAspectRatio] = useState(1920 / 1080)

  const mermaidRef = useRef(null)
  const textareaRef = useRef(null)
  const previewContentRef = useRef(null)

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]
  const history = useHistory(activeTab?.code || defaultDiagram)

  // Update history when active tab changes
  useEffect(() => {
    if (activeTab && history.current !== activeTab.code) {
      history.push(activeTab.code)
    }
  }, [activeTabId])

  // Sync code changes to localStorage
  const updateTabCode = (code) => {
    setTabs(tabs.map(tab =>
      tab.id === activeTabId ? { ...tab, code } : tab
    ))
  }

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.1, 5))
  }

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.1, 0.3))
  }

  const handleRecenter = () => {
    if (previewContentRef.current) {
      const element = previewContentRef.current
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
    }
  }

  const handleZoomReset = () => {
    setZoom(1)
    setTimeout(handleRecenter, 50) // Small delay to allow zoom to apply first
  }

  const handleCodeChange = (e) => {
    const newCode = e.target.value
    updateTabCode(newCode)
    history.push(newCode)
  }

  const handleUndo = () => {
    if (history.canUndo) {
      history.undo()
      updateTabCode(history.current)
    }
  }

  const handleRedo = () => {
    if (history.canRedo) {
      history.redo()
      updateTabCode(history.current)
    }
  }

  const handleExampleClick = (exampleKey) => {
    const newCode = examples[exampleKey]
    updateTabCode(newCode)
    history.push(newCode)
  }

  const addTab = () => {
    const newTab = {
      id: nextId,
      name: `Diagram ${nextId}`,
      code: defaultDiagram
    }
    setTabs([...tabs, newTab])
    setActiveTabId(nextId)
    setNextId(nextId + 1)
  }

  const closeTab = (tabId) => {
    if (tabs.length === 1) return // Keep at least one tab

    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id)
    }
  }

  const renameTab = (tabId, newName) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, name: newName } : tab
    ))
  }

  const exportSVG = () => {
    const svgElement = mermaidRef.current?.getSvgElement()
    if (!svgElement) return

    // Helper function to convert RGB to hex
    const rgbToHex = (color) => {
      const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
      }
      return color
    }

    // Extract text and styles from original foreignObjects (while they're still in DOM)
    const originalForeignObjects = svgElement.querySelectorAll('foreignObject')
    const textData = Array.from(originalForeignObjects).map(fo => {
      const textContent = fo.textContent?.trim() || ''

      // Get the bounding box which accounts for all transformations
      const bbox = fo.getBBox()
      const x = bbox.x
      const y = bbox.y
      const width = bbox.width
      const height = bbox.height

      // Get computed styles from the first styled element
      const styledElement = fo.querySelector('div, span, p, body')
      let styles = {
        color: '#333333',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal'
      }

      if (styledElement) {
        const computed = window.getComputedStyle(styledElement)
        styles = {
          color: rgbToHex(computed.color || '#333333'),
          fontSize: computed.fontSize || '14px',
          fontFamily: computed.fontFamily || 'Arial, sans-serif',
          fontWeight: computed.fontWeight || 'normal'
        }
      }

      return { textContent, x, y, width, height, styles }
    })

    // First, extract computed styles from original elements before cloning
    const originalElements = svgElement.querySelectorAll('*')
    const elementStyles = new Map()
    originalElements.forEach((el, index) => {
      const computed = window.getComputedStyle(el)
      elementStyles.set(index, {
        fill: computed.fill,
        stroke: computed.stroke
      })
    })

    // Extract marker colors from paths in ORIGINAL SVG
    const markerColors = new Map()
    const pathsWithMarkers = svgElement.querySelectorAll('[marker-end], [marker-start], [marker-mid]')

    pathsWithMarkers.forEach(path => {
      const computed = window.getComputedStyle(path)
      const strokeColor = computed.stroke && computed.stroke !== 'none' ? rgbToHex(computed.stroke) : '#333333'

      // Check all marker types
      const markerEnd = path.getAttribute('marker-end')
      const markerStart = path.getAttribute('marker-start')
      const markerMid = path.getAttribute('marker-mid')

      // Extract marker ID from url(#markerId) format
      const extractMarkerId = (markerAttr) => {
        if (!markerAttr) return null
        const match = markerAttr.match(/url\(#([^)]+)\)/)
        return match ? match[1] : null
      }

      const markerIds = [
        extractMarkerId(markerEnd),
        extractMarkerId(markerStart),
        extractMarkerId(markerMid)
      ].filter(Boolean)

      markerIds.forEach(markerId => {
        markerColors.set(markerId, strokeColor)
      })
    })

    // Clone the SVG
    const svgClone = svgElement.cloneNode(true)

    // Add XML namespace
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

    // Remove marker-specific CSS rules that can override explicit SVG attributes in Inkscape
    const styleTags = svgClone.querySelectorAll('style')
    styleTags.forEach(styleTag => {
      let css = styleTag.textContent || ''

      // Remove CSS rules for markers and arrowheads
      css = css.replace(/[^}]*\.marker[^{]*\{[^}]*\}/gi, '')
      css = css.replace(/[^}]*\.arrowhead[^{]*\{[^}]*\}/gi, '')
      css = css.replace(/[^}]*\.arrowMarker[^{]*\{[^}]*\}/gi, '')

      styleTag.textContent = css
    })

    // Process all style attributes to convert inline styles to attributes
    const allElements = svgClone.querySelectorAll('*')
    allElements.forEach((el, index) => {
      // Skip elements inside marker definitions - they'll be handled separately
      if (el.closest('marker')) {
        return
      }

      if (el.hasAttribute('style')) {
        const style = el.getAttribute('style')
        const styleProps = style.split(';').map(s => s.trim()).filter(Boolean)

        styleProps.forEach(prop => {
          const [key, value] = prop.split(':').map(s => s.trim())
          if (key && value) {
            // Convert common CSS properties to SVG attributes
            if (key === 'fill') {
              el.setAttribute('fill', value === 'none' ? 'none' : rgbToHex(value))
            } else if (key === 'stroke') {
              el.setAttribute('stroke', value === 'none' ? 'none' : rgbToHex(value))
            } else if (key === 'stroke-width') {
              el.setAttribute('stroke-width', value)
            } else if (key === 'opacity') {
              el.setAttribute('opacity', value)
            } else if (key === 'stroke-dasharray') {
              el.setAttribute('stroke-dasharray', value)
            } else if (key === 'stroke-linecap') {
              el.setAttribute('stroke-linecap', value)
            } else if (key === 'stroke-linejoin') {
              el.setAttribute('stroke-linejoin', value)
            }
          }
        })

        // Remove the style attribute after converting to attributes
        el.removeAttribute('style')
      }

      // Check if this is an edge/connection path BEFORE removing classes
      const isEdgePath = el.classList.contains('flowchart-link') ||
                        el.classList.contains('edgePath') ||
                        el.hasAttribute('marker-end') ||
                        el.hasAttribute('marker-start')

      // Remove class attributes to prevent CSS conflicts in Inkscape
      // After we've converted all styles to explicit attributes, classes are no longer needed
      if (el.hasAttribute('class')) {
        el.removeAttribute('class')
      }

      // CRITICAL: Edge paths must have fill="none" to render as strokes in Inkscape
      if (isEdgePath) {
        el.setAttribute('fill', 'none')
      }

      // Apply computed styles from original element if no explicit attribute
      const styles = elementStyles.get(index)
      if (styles && !el.hasAttribute('fill') && styles.fill && styles.fill !== 'none' && styles.fill !== 'rgba(0, 0, 0, 0)') {
        el.setAttribute('fill', rgbToHex(styles.fill))
      }
      if (styles && !el.hasAttribute('stroke') && styles.stroke && styles.stroke !== 'none' && styles.stroke !== 'rgba(0, 0, 0, 0)') {
        el.setAttribute('stroke', rgbToHex(styles.stroke))
      }
    })

    // Apply colors to cloned markers - process these AFTER all other style conversions
    const markers = svgClone.querySelectorAll('defs marker')
    markers.forEach(marker => {
      const markerId = marker.getAttribute('id')
      const color = markerColors.get(markerId) || '#333333'

      const markerShapes = marker.querySelectorAll('path, polygon, circle, polyline')
      markerShapes.forEach(shape => {
        // Set fill to the path stroke color for consistent rendering in Inkscape
        shape.setAttribute('fill', color)
        shape.setAttribute('stroke', 'none')

        // Remove style and class attributes to prevent CSS conflicts
        shape.removeAttribute('style')
        shape.removeAttribute('class')
      })
    })

    // Replace foreignObjects with text elements in-place
    const clonedForeignObjects = Array.from(svgClone.querySelectorAll('foreignObject'))
    clonedForeignObjects.forEach((fo, index) => {
      const data = textData[index]
      if (!data || !data.textContent) {
        fo.parentNode?.removeChild(fo)
        return
      }

      // Create SVG text element
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text')

      // Position in center of bounding box
      const centerX = data.x + data.width / 2
      const centerY = data.y + data.height / 2

      textElement.setAttribute('x', centerX.toString())
      textElement.setAttribute('y', centerY.toString())
      textElement.setAttribute('text-anchor', 'middle')
      textElement.setAttribute('dominant-baseline', 'middle')

      // Apply styles - ensure text is visible with explicit color
      textElement.setAttribute('fill', data.styles.color)
      textElement.setAttribute('font-size', data.styles.fontSize)
      textElement.setAttribute('font-family', data.styles.fontFamily)
      if (data.styles.fontWeight !== 'normal' && data.styles.fontWeight !== '400') {
        textElement.setAttribute('font-weight', data.styles.fontWeight)
      }

      // Ensure no stroke that might hide the text
      textElement.setAttribute('stroke', 'none')

      // Handle multi-line text
      const lines = data.textContent.split('\n').filter(l => l.trim())
      if (lines.length > 1) {
        const lineHeight = parseFloat(data.styles.fontSize) * 1.2
        const totalHeight = lineHeight * lines.length
        const startY = centerY - totalHeight / 2 + lineHeight / 2

        lines.forEach((line, lineIndex) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
          tspan.setAttribute('x', centerX.toString())
          tspan.setAttribute('y', (startY + lineIndex * lineHeight).toString())
          tspan.textContent = line.trim()
          textElement.appendChild(tspan)
        })
      } else {
        textElement.textContent = data.textContent
      }

      // Replace foreignObject with text element (preserve position in DOM)
      fo.parentNode?.replaceChild(textElement, fo)
    })

    // Serialize with proper formatting
    const serializer = new XMLSerializer()
    let svgData = serializer.serializeToString(svgClone)

    // Add XML declaration
    svgData = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgData

    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeTab.name}.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const openPngDialog = () => {
    const svgElement = mermaidRef.current?.getSvgElement()
    if (!svgElement) return

    // Get current SVG dimensions
    const bbox = svgElement.getBBox()
    const width = Math.round(bbox.width * 2)
    const height = Math.round(bbox.height * 2)

    setPngSize({ width, height })
    setAspectRatio(width / height)
    setShowPngDialog(true)
  }

  const handlePngWidthChange = (newWidth) => {
    const width = parseInt(newWidth) || 100
    const height = Math.round(width / aspectRatio)
    setPngSize({ width, height })
  }

  const handlePngHeightChange = (newHeight) => {
    const height = parseInt(newHeight) || 100
    const width = Math.round(height * aspectRatio)
    setPngSize({ width, height })
  }

  const exportPNG = () => {
    const svgElement = mermaidRef.current?.getSvgElement()
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = pngSize.width
      canvas.height = pngSize.height
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${activeTab.name}.png`
        link.click()
        URL.revokeObjectURL(url)
        setShowPngDialog(false)
      })
    }

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.src = url
  }

  // Auto-recenter when diagram changes or on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRecenter()
    }, 100)
    return () => clearTimeout(timer)
  }, [activeTab?.code, activeTabId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        exportSVG()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handleZoomIn()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        handleZoomOut()
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        handleZoomReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [history.canUndo, history.canRedo])

  return (
    <div className={`app theme-${theme}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <img src="/trident.svg" alt="Trident Logo" className="header-logo" />
            <div>
              <h1>Mermaid Diagram Renderer</h1>
              <p>Create and visualize diagrams with Mermaid syntax</p>
            </div>
          </div>
          <div className="header-controls">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="theme-selector"
            >
              <option value="default">Light Theme</option>
              <option value="dark">Dark Theme</option>
            </select>
          </div>
        </div>
      </header>

      <div className="tabs">
        <div className="tabs-list">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            >
              <input
                type="text"
                value={tab.name}
                onChange={(e) => renameTab(tab.id, e.target.value)}
                className="tab-name"
                onClick={() => setActiveTabId(tab.id)}
              />
              {tabs.length > 1 && (
                <button
                  onClick={() => closeTab(tab.id)}
                  className="tab-close"
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addTab} className="tab-add" title="New tab">
            +
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-section">
          <span className="toolbar-label">Examples: </span>
          {Object.keys(examples).map((key) => (
            <button
              key={key}
              onClick={() => handleExampleClick(key)}
              className="example-btn"
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="toolbar-section">
          <button
            onClick={handleUndo}
            disabled={!history.canUndo}
            className="toolbar-btn"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!history.canRedo}
            className="toolbar-btn"
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          <button
            onClick={exportSVG}
            className="toolbar-btn export-btn"
            title="Export as SVG (Ctrl+S)"
          >
            ⬇ SVG
          </button>
          <button
            onClick={openPngDialog}
            className="toolbar-btn export-btn"
          >
            ⬇ PNG
          </button>
        </div>
      </div>

      <div className="content">
        <div className="editor-panel">
          <h2>Mermaid Code</h2>
          <textarea
            ref={textareaRef}
            value={activeTab?.code || ''}
            onChange={handleCodeChange}
            placeholder="Enter your mermaid diagram code here..."
            spellCheck="false"
          />
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <h2>Preview</h2>
            <div className="zoom-controls">
              <button
                onClick={handleZoomOut}
                className="zoom-btn"
                title="Zoom Out (Ctrl+-)"
              >
                −
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="zoom-btn"
                title="Zoom In (Ctrl++)"
              >
                +
              </button>
              <button
                onClick={handleZoomReset}
                className="zoom-btn reset-btn"
                title="Reset Zoom (Ctrl+0)"
              >
                Reset
              </button>
              <button
                onClick={handleRecenter}
                className="zoom-btn recenter-btn"
                title="Recenter View"
              >
                ⊙
              </button>
            </div>
          </div>
          <div ref={previewContentRef} className="preview-content">
            <div className="preview-zoom-container">
              <div
                className="preview-zoom-wrapper"
                style={{ transform: `scale(${zoom})` }}
              >
                <MermaidRenderer ref={mermaidRef} chart={activeTab?.code || ''} theme={theme} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPngDialog && (
        <div className="dialog-overlay" onClick={() => setShowPngDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Export PNG</h3>
            <p className="dialog-description">Set the size for your PNG export (aspect ratio locked)</p>
            <div className="dialog-content">
              <div className="size-input-group">
                <label>
                  Width (px):
                  <input
                    type="number"
                    value={pngSize.width}
                    onChange={(e) => handlePngWidthChange(e.target.value)}
                    min="100"
                    max="10000"
                  />
                </label>
                <label>
                  Height (px):
                  <input
                    type="number"
                    value={pngSize.height}
                    onChange={(e) => handlePngHeightChange(e.target.value)}
                    min="100"
                    max="10000"
                  />
                </label>
              </div>
              <p className="size-info">Aspect Ratio: {aspectRatio.toFixed(2)}:1</p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setShowPngDialog(false)} className="dialog-btn cancel-btn">
                Cancel
              </button>
              <button onClick={exportPNG} className="dialog-btn export-btn">
                Export PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
