import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import mermaid from 'mermaid'

const MermaidRenderer = forwardRef(({ chart, theme = 'default' }, ref) => {
  const mermaidRef = useRef(null)
  const [error, setError] = useState(null)

  useImperativeHandle(ref, () => ({
    getSvgElement: () => mermaidRef.current?.querySelector('svg'),
    getContainer: () => mermaidRef.current
  }))

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true, // Keep HTML labels for now, will convert on export
      },
      sequence: {
        useMaxWidth: true,
      },
      gantt: {
        useMaxWidth: true,
      },
    })
  }, [theme])

  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current || !chart) return

      try {
        setError(null)
        // Clear previous content
        mermaidRef.current.innerHTML = ''

        // Generate unique ID for the diagram
        const id = `mermaid-${Date.now()}`

        // Render the diagram
        const { svg } = await mermaid.render(id, chart)
        mermaidRef.current.innerHTML = svg
      } catch (err) {
        setError(err.message || 'Failed to render diagram')
        console.error('Mermaid rendering error:', err)
      }
    }

    renderDiagram()
  }, [chart])

  if (error) {
    return (
      <div className="error">
        <h3>Error rendering diagram:</h3>
        <pre>{error}</pre>
      </div>
    )
  }

  return <div ref={mermaidRef} className="mermaid-container" />
})

MermaidRenderer.displayName = 'MermaidRenderer'

export default MermaidRenderer
