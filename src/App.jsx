import { useState, useRef, useEffect } from 'react'
import MermaidRenderer from './MermaidRenderer'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useHistory } from './hooks/useHistory'
import { convertSvgToInkscape } from './utils/inkscapeConverter'
import { assistMermaidCode } from './utils/aiCorrection'
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
  const [showAssistDialog, setShowAssistDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [assistInstruction, setAssistInstruction] = useState('')
  const [isAssisting, setIsAssisting] = useState(false)
  const [pngSize, setPngSize] = useState({ width: 1920, height: 1080 })
  const [aspectRatio, setAspectRatio] = useState(1920 / 1080)
  const [isConverting, setIsConverting] = useState(false)
  const [llmSettings, setLlmSettings] = useLocalStorage('mermaid-llm-settings', {
    apiUrl: '',
    model: '',
    apiKey: ''
  })

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

  const handleFixCode = (newCode) => {
    updateTabCode(newCode)
    history.push(newCode)
  }

  const handleAssist = async () => {
    if (!assistInstruction.trim()) return

    setIsAssisting(true)
    try {
      const activeCode = activeTab?.code || ''
      // Get current error from renderer if any
      const currentError = mermaidRef.current?.getError() || null

      const newCode = await assistMermaidCode(activeCode, assistInstruction, currentError, llmSettings)

      updateTabCode(newCode)
      history.push(newCode)

      // Close dialog and reset
      setShowAssistDialog(false)
      setAssistInstruction('')
    } catch (err) {
      alert(`AI Assistance failed: ${err.message}`)
    } finally {
      setIsAssisting(false)
    }
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
      if (!color || color === 'none') return color
      const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
      }
      return color
    }

    // Extract text and styles from original foreignObjects (while they're still in DOM)
    const BREAK_MARKER = '\u000B'  // vertical tab - won't be collapsed by HTML parsing
    const originalForeignObjects = svgElement.querySelectorAll('foreignObject')
    const textData = Array.from(originalForeignObjects).map(fo => {
      // Extract text by walking DOM nodes to preserve <br> as explicit line breaks
      let textContent = ''

      const walkNodes = (node) => {
        if (node.nodeName === 'BR') {
          textContent += BREAK_MARKER
          return
        }
        if (node.nodeType === Node.TEXT_NODE) {
          textContent += node.textContent
          return
        }
        node.childNodes.forEach(child => walkNodes(child))
      }
      walkNodes(fo)

      // Decode HTML entities
      textContent = textContent.replace(/&nbsp;/g, ' ')
                               .replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')

      textContent = textContent.trim()

      // Get the bounding box which accounts for all transformations
      const bbox = fo.getBBox()
      const x = bbox.x
      const y = bbox.y
      const width = bbox.width
      const height = bbox.height

      // Detect label type by checking parent elements
      let labelType = 'node'
      let parent = fo.parentElement
      while (parent && parent !== svgElement) {
        const cls = parent.getAttribute('class') || ''
        if (cls.includes('edgeLabel')) {
          labelType = 'edge'
          break
        }
        if (cls.includes('cluster-label')) {
          labelType = 'cluster'
          break
        }
        parent = parent.parentElement
      }

      // Get computed styles from the first styled element
      const styledElement = fo.querySelector('div, span, p, body')
      let styles = {
        color: '#333333',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal'
      }
      let bgColor = null

      if (styledElement) {
        const computed = window.getComputedStyle(styledElement)
        styles = {
          color: rgbToHex(computed.color || '#333333'),
          fontSize: computed.fontSize || '14px',
          fontFamily: computed.fontFamily || 'Arial, sans-serif',
          fontWeight: computed.fontWeight || 'normal'
        }
        // Extract background color for edge labels
        if (labelType === 'edge') {
          const bg = computed.backgroundColor
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            bgColor = rgbToHex(bg)
          }
        }
      }

      return { textContent, x, y, width, height, styles, labelType, bgColor }
    })

    // First, extract computed styles from original elements before cloning
    const originalElements = svgElement.querySelectorAll('*')
    const elementStyles = new Map()
    originalElements.forEach((el, index) => {
      const computed = window.getComputedStyle(el)
      const styles = {
        fill: computed.fill,
        stroke: computed.stroke,
        strokeWidth: computed.strokeWidth,
        strokeDasharray: computed.strokeDasharray
      }
      // For native SVG text elements (e.g. sequence diagrams), capture font and alignment
      const tagName = el.tagName?.toLowerCase()
      if (tagName === 'text' || tagName === 'tspan') {
        styles.fontSize = computed.fontSize
        styles.fontFamily = computed.fontFamily
        styles.fontWeight = computed.fontWeight
        styles.textAnchor = computed.textAnchor
        styles.dominantBaseline = computed.dominantBaseline
      }
      elementStyles.set(index, styles)
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

    // Remove ALL CSS rules - computed styles are already inlined as SVG attributes.
    // CSS rules override presentation attributes (even tag-based selectors like
    // #mermaid-id text { fill: ... } beat fill="..." on the element), so they must
    // be removed to prevent wrong colors/alignment in Inkscape and other renderers.
    const styleTags = svgClone.querySelectorAll('style')
    styleTags.forEach(styleTag => {
      styleTag.textContent = ''
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
          const [key, rawValue] = prop.split(':').map(s => s.trim())
          // Strip !important - it's CSS syntax, not valid in SVG attributes
          const value = rawValue ? rawValue.replace(/\s*!important\s*$/, '') : rawValue
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
                        el.classList.contains('messageLine0') ||
                        el.classList.contains('messageLine1') ||
                        el.hasAttribute('marker-end') ||
                        el.hasAttribute('marker-start')

      // Remove class attributes to prevent CSS conflicts in Inkscape
      // After we've converted all styles to explicit attributes, classes are no longer needed
      if (el.hasAttribute('class')) {
        el.removeAttribute('class')
      }

      // Apply computed styles from original element
      // Always apply (even if attribute exists) because CSS class-based styles
      // are the authoritative values and classes are being removed
      const styles = elementStyles.get(index)
      if (styles && styles.fill && styles.fill !== 'none' && styles.fill !== 'rgba(0, 0, 0, 0)') {
        el.setAttribute('fill', rgbToHex(styles.fill))
      }
      if (styles && styles.stroke && styles.stroke !== 'none' && styles.stroke !== 'rgba(0, 0, 0, 0)') {
        el.setAttribute('stroke', rgbToHex(styles.stroke))
      }
      if (styles && styles.strokeWidth && styles.strokeWidth !== '0px') {
        el.setAttribute('stroke-width', styles.strokeWidth)
      }
      if (styles && styles.strokeDasharray && styles.strokeDasharray !== 'none') {
        el.setAttribute('stroke-dasharray', styles.strokeDasharray)
      }

      // For native SVG text/tspan elements (sequence diagrams etc.), inline font & alignment
      // so they survive CSS removal. Also force stroke="none" — text uses fill for color,
      // not stroke. Without this, text inherits the parent's stroke (e.g. actor box outline).
      const tagName = el.tagName?.toLowerCase()
      if ((tagName === 'text' || tagName === 'tspan') && styles) {
        if (styles.fontSize) el.setAttribute('font-size', styles.fontSize)
        if (styles.fontFamily) el.setAttribute('font-family', styles.fontFamily)
        if (styles.fontWeight && styles.fontWeight !== 'normal' && styles.fontWeight !== '400') {
          el.setAttribute('font-weight', styles.fontWeight)
        }
        if (styles.textAnchor && styles.textAnchor !== 'start') {
          el.setAttribute('text-anchor', styles.textAnchor)
        }
        if (styles.dominantBaseline && styles.dominantBaseline !== 'auto') {
          el.setAttribute('dominant-baseline', styles.dominantBaseline)
        }
        el.setAttribute('stroke', 'none')
      }

      // CRITICAL: Edge paths must have fill="none" to render as strokes in Inkscape
      // This must come AFTER computed styles so it overrides the computed fill
      if (isEdgePath) {
        el.setAttribute('fill', 'none')
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

    // Create canvas for accurate text width measurement
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')

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

      // Add emoji font families if text contains emoji characters
      let fontFamily = data.styles.fontFamily
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u
      if (emojiRegex.test(data.textContent)) {
        fontFamily = `${fontFamily}, "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", "Twemoji Mozilla", sans-serif`
      }
      textElement.setAttribute('font-family', fontFamily)

      if (data.styles.fontWeight !== 'normal' && data.styles.fontWeight !== '400') {
        textElement.setAttribute('font-weight', data.styles.fontWeight)
      }

      // Ensure no stroke that might hide the text
      textElement.setAttribute('stroke', 'none')

      // Text wrapping: respect explicit line breaks (BREAK_MARKER), then wrap each segment by width
      const wrapText = (text, maxWidth) => {
        const fontWeight = data.styles.fontWeight || 'normal'
        const fontSize = data.styles.fontSize || '14px'
        const fontFamily = data.styles.fontFamily || 'Arial, sans-serif'
        measureCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`

        // Split on explicit line breaks first
        const segments = text.split(BREAK_MARKER)
        const allLines = []

        segments.forEach(segment => {
          const cleanSegment = segment.replace(/\s+/g, ' ').trim()
          if (!cleanSegment) return
          const words = cleanSegment.split(' ')
          let currentLine = ''

          words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word
            const testWidth = measureCtx.measureText(testLine).width

            if (testWidth > maxWidth && currentLine !== '') {
              allLines.push(currentLine)
              currentLine = word
            } else {
              currentLine = testLine
            }
          })

          if (currentLine) {
            allLines.push(currentLine)
          }
        })

        return allLines.length > 0 ? allLines : [text.replace(new RegExp(BREAK_MARKER, 'g'), ' ').trim()]
      }

      // Add width padding to prevent premature wrapping (Canvas measurement can differ slightly from browser)
      const wrapWidth = data.labelType === 'cluster' ? data.width * 1.5
                       : data.labelType === 'edge' ? data.width * 1.3
                       : data.width * 1.15

      // Apply word wrapping
      const allLines = wrapText(data.textContent, wrapWidth)

      if (allLines.length > 1) {
        const lineHeight = parseFloat(data.styles.fontSize) * 1.2
        const totalHeight = lineHeight * allLines.length
        const startY = centerY - totalHeight / 2 + lineHeight / 2

        allLines.forEach((line, lineIndex) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
          tspan.setAttribute('x', centerX.toString())
          tspan.setAttribute('y', (startY + lineIndex * lineHeight).toString())
          tspan.textContent = line || ' '
          textElement.appendChild(tspan)
        })
      } else if (allLines.length === 1) {
        textElement.textContent = allLines[0]
      } else {
        textElement.textContent = data.textContent
      }

      // For edge labels, add a background rect behind the text
      if (data.labelType === 'edge') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

        // Measure widest line for the background rect
        const fontWeight = data.styles.fontWeight || 'normal'
        const fontSize = data.styles.fontSize || '14px'
        const fontFamily = data.styles.fontFamily || 'Arial, sans-serif'
        measureCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`
        const textWidth = Math.max(...allLines.map(l => measureCtx.measureText(l).width))
        const lineHeight = parseFloat(fontSize) * 1.2
        const totalTextHeight = lineHeight * allLines.length
        const padding = 4

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', (centerX - textWidth / 2 - padding).toString())
        rect.setAttribute('y', (centerY - totalTextHeight / 2 - padding).toString())
        rect.setAttribute('width', (textWidth + padding * 2).toString())
        rect.setAttribute('height', (totalTextHeight + padding * 2).toString())
        rect.setAttribute('fill', data.bgColor || '#ffffff')
        rect.setAttribute('stroke', 'none')

        g.appendChild(rect)
        g.appendChild(textElement)
        fo.parentNode?.replaceChild(g, fo)
      } else {
        // Replace foreignObject with text element (preserve position in DOM)
        fo.parentNode?.replaceChild(textElement, fo)
      }
    })

    // Serialize with proper formatting
    const serializer = new XMLSerializer()
    let svgData = serializer.serializeToString(svgClone)

    // Final cleanup: strip any remaining !important (CSS-only, invalid in SVG attributes)
    svgData = svgData.replace(/\s*!important\s*/g, ' ')

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

  const handleSVGFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsConverting(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const svgContent = event.target.result

        // Convert the SVG
        const convertedSVG = convertSvgToInkscape(svgContent)

        // Automatic download of the converted file
        const blob = new Blob([convertedSVG], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name.replace('.svg', '-inkscape.svg')
        link.click()
        URL.revokeObjectURL(url)

        setIsConverting(false)
      } catch (error) {
        console.error('Error converting SVG:', error)
        alert(`Failed to convert SVG: ${error.message}`)
        setIsConverting(false)
      }
    }

    reader.onerror = () => {
      alert('Failed to read the file')
      setIsConverting(false)
    }

    reader.readAsText(file)

    // Reset input so the same file can be uploaded again
    e.target.value = ''
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
    }, 300)
    return () => clearTimeout(timer)
  }, [(tabs.find(tab => tab.id === activeTabId) || tabs[0])?.code, activeTabId])

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
            <h1>Mermaid Diagram Renderer</h1>
          </div>
          <div className="header-controls">
            <label className={`icon-btn ${isConverting ? 'converting' : ''}`} title="Convert Mermaid SVG to Inkscape">
              <input
                type="file"
                accept=".svg"
                onChange={handleSVGFileUpload}
                style={{ display: 'none' }}
                disabled={isConverting}
              />
              {isConverting ? (
                <svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor" className="spinner">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"></path>
                </svg>
              )}
            </label>
            <button
              onClick={() => setTheme(theme === 'default' ? 'dark' : 'default')}
              className="icon-btn"
              title={theme === 'default' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            >
              {theme === 'default' ? (
                <svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              ) : (
                <svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2"></line>
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowSettingsDialog(true)}
              className="icon-btn"
              title="LLM Settings"
            >
              <svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"></path>
              </svg>
            </button>
            <a
              href="https://github.com/NandaIda/Mermaid_renderer"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="View on GitHub"
            >
              <svg height="24" viewBox="0 0 16 16" width="24" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
            </a>
          </div>
        </div>
        <div className="mobile-notice">
          <p>For best experience on mobile, please enable Desktop Mode in your browser settings</p>
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
            value={(tabs.find(tab => tab.id === activeTabId) || tabs[0])?.code || ''}
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
                onClick={() => setShowAssistDialog(true)}
                className="zoom-btn ai-assist-btn"
                title="Ask AI to improve or fix diagram"
                style={{ 
                  backgroundColor: '#673AB7', 
                  color: 'white', 
                  width: 'auto', 
                  fontWeight: 'bold',
                }}
              >
                ✨ AI Assist
              </button>
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
                <MermaidRenderer
                  ref={mermaidRef}
                  chart={(tabs.find(tab => tab.id === activeTabId) || tabs[0])?.code || ''}
                  theme={theme}
                  onFixCode={handleFixCode}
                  llmSettings={llmSettings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAssistDialog && (
        <div className="dialog-overlay" onClick={() => !isAssisting && setShowAssistDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>AI Assistant</h3>
            <p className="dialog-description">
              Describe what's wrong or what you want to change.
            </p>
            <div className="dialog-content">
              <textarea
                value={assistInstruction}
                onChange={(e) => setAssistInstruction(e.target.value)}
                placeholder="e.g., 'The arrow from B to D is broken', 'Change all rectangles to diamonds', 'Add a new node for Logging'"
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-color)',
                  resize: 'vertical',
                  marginBottom: '10px',
                  fontFamily: 'inherit'
                }}
                disabled={isAssisting}
                autoFocus
              />
            </div>
            <div className="dialog-actions">
              <button 
                onClick={() => setShowAssistDialog(false)} 
                className="dialog-btn cancel-btn"
                disabled={isAssisting}
              >
                Cancel
              </button>
              <button 
                onClick={handleAssist} 
                className="dialog-btn"
                style={{ backgroundColor: '#673AB7', color: 'white' }}
                disabled={isAssisting || !assistInstruction.trim()}
              >
                {isAssisting ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showSettingsDialog && (
        <div className="dialog-overlay" onClick={() => setShowSettingsDialog(false)}>
          <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>LLM Settings</h3>
            <p className="dialog-description">Configure your custom LLM provider (OpenAI API compatible)</p>
            <div className="dialog-content">
              <div className="settings-form">
                <label>
                  API URL:
                  <input
                    type="text"
                    value={llmSettings.apiUrl}
                    onChange={(e) => setLlmSettings({ ...llmSettings, apiUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                    OpenAI API compatible endpoint
                  </span>
                </label>
                <label>
                  Model:
                  <input
                    type="text"
                    value={llmSettings.model}
                    onChange={(e) => setLlmSettings({ ...llmSettings, model: e.target.value })}
                    placeholder="gpt-4"
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}
                  />
                </label>
                <label>
                  API Key:
                  <input
                    type="password"
                    value={llmSettings.apiKey}
                    onChange={(e) => setLlmSettings({ ...llmSettings, apiKey: e.target.value })}
                    placeholder="sk-..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                    Leave empty if not required
                  </span>
                </label>
              </div>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setShowSettingsDialog(false)} className="dialog-btn cancel-btn">
                Cancel
              </button>
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="dialog-btn"
                style={{ backgroundColor: '#667eea', color: 'white' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
