import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import mermaid from 'mermaid'
import { fixMermaidCode } from './utils/aiCorrection'

const MermaidRenderer = forwardRef(({ chart, theme = 'default', onFixCode }, ref) => {
  const mermaidRef = useRef(null)
  const [error, setError] = useState(null)
  const [isFixing, setIsFixing] = useState(false)

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

  const handleFix = async () => {
    if (!chart || !error) return
    
    setIsFixing(true)
    try {
      const fixedCode = await fixMermaidCode(chart, error)
      if (onFixCode) {
        onFixCode(fixedCode)
      }
    } catch (err) {
      alert(`Failed to fix code: ${err.message}`)
    } finally {
      setIsFixing(false)
    }
  }

  if (error) {
    return (
      <div className="error">
        <h3>Error rendering diagram:</h3>
        <pre>{error}</pre>
        <button 
          onClick={handleFix} 
          disabled={isFixing}
          className="fix-btn"
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isFixing ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold'
          }}
        >
          {isFixing ? (
            <>
              <span className="spinner-small" style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                borderTopColor: 'white',
                animation: 'spin 1s linear infinite',
                display: 'inline-block'
              }}></span>
              Fixing with AI...
            </>
          ) : (
            <>
              <span>✨</span> Fix with AI
            </>
          )}
        </button>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return <div ref={mermaidRef} className="mermaid-container" />
})

MermaidRenderer.displayName = 'MermaidRenderer'

export default MermaidRenderer
