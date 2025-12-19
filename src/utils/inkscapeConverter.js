// Browser-compatible Inkscape SVG converter
// Converts Mermaid-generated SVG to be Inkscape-compatible

// Helper function to convert RGB to hex
const rgbToHex = (color) => {
  if (!color || color === 'none') return color;
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return color;
};

// Parse CSS and create a style map
const parseCSSRules = (cssText) => {
  const rules = new Map();

  // Remove comments and normalize
  cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Match CSS rules
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cssText)) !== null) {
    const selectorList = match[1].trim();
    const declarations = match[2].trim();

    // Parse declarations
    const styles = {};
    declarations.split(';').forEach(decl => {
      const [prop, value] = decl.split(':').map(s => s?.trim());
      if (prop && value) {
        // Remove !important
        styles[prop] = value.replace(/\s*!important\s*$/, '');
      }
    });

    // Split comma-separated selectors and add each one separately
    selectorList.split(',').forEach(selector => {
      const trimmedSelector = selector.trim();
      if (trimmedSelector) {
        rules.set(trimmedSelector, styles);
      }
    });
  }

  return rules;
};

// Get applicable styles for an element
const getApplicableStyles = (element, cssRules, idPrefix) => {
  const styles = {};
  const tagName = element.tagName.toLowerCase();

  // Check if element is a descendant of certain classes (for descendant selectors)
  const hasAncestorWithClass = (className) => {
    let parent = element.parentNode;
    while (parent && parent !== element.ownerDocument) {
      const parentClasses = (parent.getAttribute && parent.getAttribute('class') || '').split(/\s+/);
      if (parentClasses.includes(className)) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  };

  // Check each CSS rule
  for (const [selector, ruleStyles] of cssRules.entries()) {
    let matches = false;

    // Handle descendant selectors like ".node rect" or ".cluster rect"
    if (selector.includes(' ')) {
      const parts = selector.split(/\s+/);

      // Check if last part matches current element
      const lastPart = parts[parts.length - 1];
      const matchesElement = lastPart === tagName ||
                            (lastPart.startsWith('.') &&
                             (element.getAttribute('class') || '').split(/\s+/).includes(lastPart.substring(1)));

      if (matchesElement) {
        // Check if any ancestor matches the parent selector
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (part.startsWith('#') && part !== '#' + idPrefix) continue;
          if (part === '#' + idPrefix) continue;

          if (part.startsWith('.')) {
            const className = part.substring(1);
            if (hasAncestorWithClass(className)) {
              matches = true;
              break;
            }
          }
        }
      }
    } else if (selector.startsWith('.')) {
      // Direct class selector
      const className = selector.substring(1).split(/[\s:,]+/)[0];
      const classes = (element.getAttribute('class') || '').split(/\s+/);
      if (classes.includes(className)) {
        matches = true;
      }
    } else if (selector === tagName) {
      // Direct tag selector
      matches = true;
    }

    if (matches) {
      Object.assign(styles, ruleStyles);
    }
  }

  return styles;
};

// Main conversion function - accepts SVG content string, returns converted SVG string
export const convertSvgToInkscape = (svgContent) => {
  // Parse SVG using DOMParser (browser API)
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');

  if (!svgElement) {
    throw new Error('No SVG element found');
  }

  // Get the ID prefix for scoped CSS rules
  const svgId = svgElement.getAttribute('id') || '';

  // Parse all CSS rules from style tags
  let allCSS = '';
  const styleTags = svgElement.querySelectorAll('style');
  styleTags.forEach(styleTag => {
    allCSS += (styleTag.textContent || '') + '\n';
  });

  const cssRules = parseCSSRules(allCSS);
  console.log(`Parsed ${cssRules.size} CSS rules`);

  // Extract text and styles from original foreignObjects
  const originalForeignObjects = svgElement.querySelectorAll('foreignObject');
  const textData = Array.from(originalForeignObjects).map((fo, idx) => {
    // Extract text by processing the raw innerHTML of foreignObject
    // This ensures we catch <br/> tags before normalization
    let textContent = '';

    // Get the raw HTML content of the foreignObject
    let rawHTML = fo.innerHTML || '';

    // Replace <br> and <br/> with spaces BEFORE any other processing
    rawHTML = rawHTML.replace(/<br\s*\/?>/gi, ' ');

    // Now parse it to extract text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHTML;
    textContent = tempDiv.textContent || '';

    // Decode HTML entities
    textContent = textContent.replace(/&nbsp;/g, ' ')
                             .replace(/&amp;/g, '&')
                             .replace(/&lt;/g, '<')
                             .replace(/&gt;/g, '>');

    textContent = textContent.trim();

    const x = parseFloat(fo.getAttribute('x')) || 0;
    const y = parseFloat(fo.getAttribute('y')) || 0;
    const width = parseFloat(fo.getAttribute('width')) || 0;
    const height = parseFloat(fo.getAttribute('height')) || 0;

    let styles = {
      color: '#333333',
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal'
    };

    // Check for inherited styles from the root SVG element
    const rootSvgStyles = cssRules.get(`#${svgId}`) || {};

    // Try to get styles from CSS rules or inline styles
    const styledElement = fo.querySelector('div, span, p');
    if (styledElement) {
      const cssStyles = getApplicableStyles(styledElement, cssRules, svgId);
      const inlineStyle = styledElement.getAttribute('style') || '';

      // Parse inline styles
      const inlineStyles = {};
      inlineStyle.split(';').forEach(prop => {
        const [key, value] = prop.split(':').map(s => s?.trim());
        if (key && value) inlineStyles[key] = value;
      });

      styles = {
        color: rgbToHex(inlineStyles.color || cssStyles.color || cssStyles.fill || rootSvgStyles['fill'] || '#333333'),
        fontSize: inlineStyles['font-size'] || cssStyles['font-size'] || rootSvgStyles['font-size'] || '16px',
        fontFamily: inlineStyles['font-family'] || cssStyles['font-family'] || rootSvgStyles['font-family'] || 'Arial, sans-serif',
        fontWeight: inlineStyles['font-weight'] || cssStyles['font-weight'] || rootSvgStyles['font-weight'] || 'normal'
      };
    }

    return { textContent, x, y, width, height, styles };
  });

  // Extract marker colors from paths BEFORE processing
  const markerColors = new Map();
  const pathsWithMarkers = svgElement.querySelectorAll('[marker-end], [marker-start], [marker-mid]');

  pathsWithMarkers.forEach(path => {
    // Get stroke color from CSS rules, inline styles, or attributes
    const cssStyles = getApplicableStyles(path, cssRules, svgId);
    const inlineStyle = path.getAttribute('style') || '';
    const inlineStyles = {};
    inlineStyle.split(';').forEach(prop => {
      const [key, value] = prop.split(':').map(s => s?.trim());
      if (key && value) inlineStyles[key] = value;
    });

    let strokeColor = rgbToHex(
      inlineStyles.stroke ||
      path.getAttribute('stroke') ||
      cssStyles.stroke ||
      '#333333'
    );

    // Extract marker IDs
    const extractMarkerId = (markerAttr) => {
      if (!markerAttr) return null;
      const match = markerAttr.match(/url\(#([^)]+)\)/);
      return match ? match[1] : null;
    };

    [path.getAttribute('marker-end'),
     path.getAttribute('marker-start'),
     path.getAttribute('marker-mid')]
      .map(extractMarkerId)
      .filter(Boolean)
      .forEach(markerId => {
        markerColors.set(markerId, strokeColor);
      });
  });

  console.log(`Extracted colors for ${markerColors.size} markers`);

  // Add XML namespaces
  svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Remove marker/arrowhead CSS rules
  styleTags.forEach(styleTag => {
    let css = styleTag.textContent || '';
    css = css.replace(/[^}]*\.marker[^{]*\{[^}]*\}/gi, '');
    css = css.replace(/[^}]*\.arrowhead[^{]*\{[^}]*\}/gi, '');
    css = css.replace(/[^}]*\.arrowMarker[^{]*\{[^}]*\}/gi, '');
    styleTag.textContent = css;
  });

  // FIRST PASS: Apply all CSS/inline styles to attributes
  // We need to do this BEFORE removing class attributes because descendant selectors
  // like ".node rect" need the parent's class attribute to still be present
  const allElements = Array.from(svgElement.querySelectorAll('*'));

  allElements.forEach((el) => {
    // Skip marker children (handle separately)
    if (el.closest('marker')) {
      return;
    }

    // Get applicable CSS styles for this element
    const cssStyles = getApplicableStyles(el, cssRules, svgId);

    // Parse inline styles
    const inlineStyle = el.getAttribute('style') || '';
    const inlineStyles = {};
    inlineStyle.split(';').forEach(prop => {
      const [key, value] = prop.split(':').map(s => s?.trim());
      if (key && value) {
        inlineStyles[key] = value;
      }
    });

    // Determine if this is an edge path
    const classAttr = el.getAttribute('class') || '';
    const isEdgePath = classAttr.includes('flowchart-link') ||
                      classAttr.includes('edgePath') ||
                      el.hasAttribute('marker-end') ||
                      el.hasAttribute('marker-start');

    // Store edge path info for later
    if (isEdgePath) {
      el.setAttribute('data-is-edge-path', 'true');
    }

    // Apply styles as attributes (inline > CSS > existing attribute)
    const applyStyle = (svgAttr, cssProps) => {
      for (const cssProp of cssProps) {
        const inlineValue = inlineStyles[cssProp];
        const cssValue = cssStyles[cssProp];

        // Inline styles have highest priority - ALWAYS override
        if (inlineValue && inlineValue !== 'none') {
          const cleanValue = inlineValue.replace(/\s*!important\s*$/, '');
          el.setAttribute(svgAttr, rgbToHex(cleanValue));
          return;
        }

        if (inlineValue === 'none') {
          el.setAttribute(svgAttr, 'none');
          return;
        }

        // CSS styles override existing attributes
        if (cssValue && cssValue !== 'none') {
          const cleanValue = cssValue.replace(/\s*!important\s*$/, '');
          el.setAttribute(svgAttr, rgbToHex(cleanValue));
          return;
        } else if (cssValue === 'none') {
          el.setAttribute(svgAttr, 'none');
          return;
        }

        // If no inline or CSS value, keep existing attribute (do nothing)
      }
    };

    applyStyle('fill', ['fill']);
    applyStyle('stroke', ['stroke']);

    // Apply other attributes
    if (!el.hasAttribute('stroke-width') && (inlineStyles['stroke-width'] || cssStyles['stroke-width'])) {
      const strokeWidth = inlineStyles['stroke-width'] || cssStyles['stroke-width'];
      // Don't set stroke-width to 0 for edge paths
      if (strokeWidth !== '0' && strokeWidth !== '0px') {
        el.setAttribute('stroke-width', strokeWidth);
      } else if (isEdgePath) {
        // Edge paths need visible stroke
        el.setAttribute('stroke-width', '2px');
      }
    }
    if (!el.hasAttribute('opacity') && (inlineStyles['opacity'] || cssStyles['opacity'])) {
      el.setAttribute('opacity', inlineStyles['opacity'] || cssStyles['opacity']);
    }
  });

  // SECOND PASS: Remove class and style attributes, apply final fixes
  allElements.forEach((el) => {
    if (el.closest('marker')) {
      return;
    }

    // CRITICAL: Edge paths must have fill="none"
    if (el.getAttribute('data-is-edge-path') === 'true') {
      if (el.getAttribute('fill') !== 'none') {
        el.setAttribute('fill', 'none');
      }
      el.removeAttribute('data-is-edge-path');
    }

    // Remove inline style and class
    el.removeAttribute('style');
    el.removeAttribute('class');
  });

  // Process markers - must happen AFTER main element processing
  // Use getElementsByTagName to avoid namespace issues with querySelector
  const markers = Array.from(svgElement.getElementsByTagName('marker'));
  markers.forEach(marker => {
    const markerId = marker.getAttribute('id');
    const color = markerColors.get(markerId) || '#333333';

    // Remove all class and style from marker element itself
    marker.removeAttribute('class');
    marker.removeAttribute('style');

    // Process all shapes inside markers - use getElementsByTagName for each type
    const paths = Array.from(marker.getElementsByTagName('path'));
    const polygons = Array.from(marker.getElementsByTagName('polygon'));
    const circles = Array.from(marker.getElementsByTagName('circle'));
    const polylines = Array.from(marker.getElementsByTagName('polyline'));
    const markerShapes = [...paths, ...polygons, ...circles, ...polylines];

    markerShapes.forEach(shape => {
      shape.setAttribute('fill', color);
      shape.setAttribute('stroke', 'none');

      // Remove all style-related attributes
      shape.removeAttribute('style');
      shape.removeAttribute('class');
      shape.removeAttribute('stroke-width');
      shape.removeAttribute('stroke-dasharray');
    });
  });

  // Replace foreignObjects with text elements
  const foreignObjects = Array.from(svgElement.querySelectorAll('foreignObject'));
  foreignObjects.forEach((fo, index) => {
    const data = textData[index];
    if (!data || !data.textContent) {
      fo.parentNode?.removeChild(fo);
      return;
    }

    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const centerX = data.x + data.width / 2;
    const centerY = data.y + data.height / 2;
    textElement.setAttribute('x', centerX.toString());
    textElement.setAttribute('y', centerY.toString());
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.setAttribute('fill', data.styles.color);
    textElement.setAttribute('font-size', data.styles.fontSize);
    textElement.setAttribute('font-family', data.styles.fontFamily);

    if (data.styles.fontWeight !== 'normal' && data.styles.fontWeight !== '400') {
      textElement.setAttribute('font-weight', data.styles.fontWeight);
    }

    textElement.setAttribute('stroke', 'none');

    // Simple word wrapping - just wrap based on width
    const wrapText = (text, maxWidth) => {
      // Clean and normalize the text first
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const words = cleanText.split(' ');
      const lines = [];
      let currentLine = '';

      const fontSize = parseFloat(data.styles.fontSize) || 16;
      const avgCharWidth = fontSize * 0.5; // Approximate character width (reduced for less aggressive wrapping)

      words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testWidth = testLine.length * avgCharWidth;

        if (testWidth > maxWidth && currentLine !== '') {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.length > 0 ? lines : [cleanText];
    };

    // Apply word wrapping to the entire text
    const allLines = wrapText(data.textContent, data.width);

    if (allLines.length > 1) {
      const lineHeight = parseFloat(data.styles.fontSize) * 1.2;
      const totalHeight = lineHeight * allLines.length;
      const startY = centerY - totalHeight / 2 + lineHeight / 2;

      allLines.forEach((line, lineIndex) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', centerX.toString());
        tspan.setAttribute('y', (startY + lineIndex * lineHeight).toString());
        // Use a space for empty lines to preserve line height
        tspan.textContent = line || ' ';
        textElement.appendChild(tspan);
      });
    } else if (allLines.length === 1) {
      textElement.textContent = allLines[0];
    } else {
      textElement.textContent = data.textContent;
    }

    fo.parentNode?.replaceChild(textElement, fo);
  });

  // CANVAS EXPANSION: Calculate bounding box AFTER foreignObject conversion
  const calculateBoundingBox = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Helper to parse transform attribute and get full transformation
    const getTransform = (element) => {
      let scaleX = 1, scaleY = 1, tx = 0, ty = 0;
      let current = element;

      while (current && current !== svgElement) {
        const transform = current.getAttribute('transform');
        if (transform) {
          // Parse matrix(a, b, c, d, e, f) where a=scaleX, d=scaleY, e=tx, f=ty (for simple scale+translate)
          const matrixMatch = transform.match(/matrix\(([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\)/);
          if (matrixMatch) {
            const a = parseFloat(matrixMatch[1]) || 1;  // scaleX
            const d = parseFloat(matrixMatch[4]) || 1;  // scaleY
            const e = parseFloat(matrixMatch[5]) || 0;  // tx
            const f = parseFloat(matrixMatch[6]) || 0;  // ty

            // Apply transform: new_point = scale * old_point + translate
            tx = tx * a + e;
            ty = ty * d + f;
            scaleX *= a;
            scaleY *= d;
          }

          // Parse translate(x, y)
          const translateMatch = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
          if (translateMatch) {
            tx += (parseFloat(translateMatch[1]) || 0) * scaleX;
            ty += (parseFloat(translateMatch[2]) || 0) * scaleY;
          }
        }
        current = current.parentElement;
      }

      return { tx, ty, scaleX, scaleY };
    };

    // Function to update bounds from a coordinate/dimension
    const updateBounds = (x, y, width, height, element = null) => {
      if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
        if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
          // Apply transforms if element is provided
          if (element) {
            const { tx, ty, scaleX, scaleY } = getTransform(element);
            // Transform: point' = scale * point + translate
            const x1 = x * scaleX + tx;
            const y1 = y * scaleY + ty;
            const x2 = (x + width) * scaleX + tx;
            const y2 = (y + height) * scaleY + ty;

            minX = Math.min(minX, x1, x2);
            minY = Math.min(minY, y1, y2);
            maxX = Math.max(maxX, x1, x2);
            maxY = Math.max(maxY, y1, y2);
            hasContent = true;
            return;
          }

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
          hasContent = true;
        }
      }
    };

    // Get rectangles (nodes)
    Array.from(svgElement.querySelectorAll('rect')).forEach(rect => {
      if (rect.closest('marker')) return;
      const x = parseFloat(rect.getAttribute('x')) || 0;
      const y = parseFloat(rect.getAttribute('y')) || 0;
      const width = parseFloat(rect.getAttribute('width')) || 0;
      const height = parseFloat(rect.getAttribute('height')) || 0;
      updateBounds(x, y, width, height, rect);
    });

    // Get circles
    Array.from(svgElement.querySelectorAll('circle')).forEach(circle => {
      if (circle.closest('marker')) return;
      const cx = parseFloat(circle.getAttribute('cx')) || 0;
      const cy = parseFloat(circle.getAttribute('cy')) || 0;
      const r = parseFloat(circle.getAttribute('r')) || 0;
      updateBounds(cx - r, cy - r, r * 2, r * 2, circle);
    });

    // Get ellipses
    Array.from(svgElement.querySelectorAll('ellipse')).forEach(ellipse => {
      if (ellipse.closest('marker')) return;
      const cx = parseFloat(ellipse.getAttribute('cx')) || 0;
      const cy = parseFloat(ellipse.getAttribute('cy')) || 0;
      const rx = parseFloat(ellipse.getAttribute('rx')) || 0;
      const ry = parseFloat(ellipse.getAttribute('ry')) || 0;
      updateBounds(cx - rx, cy - ry, rx * 2, ry * 2, ellipse);
    });

    // Get text elements (from converted foreignObjects)
    Array.from(svgElement.querySelectorAll('text')).forEach(text => {
      if (text.closest('marker')) return;
      const x = parseFloat(text.getAttribute('x')) || 0;
      const y = parseFloat(text.getAttribute('y')) || 0;
      const fontSize = parseFloat(text.getAttribute('font-size')) || 16;
      // Better estimate: ~0.6em per character width, 1.2em line height
      const textContent = text.textContent || '';
      const estimatedWidth = textContent.length * fontSize * 0.6;
      const estimatedHeight = fontSize * 1.2;
      updateBounds(x - estimatedWidth / 2, y - estimatedHeight / 2, estimatedWidth, estimatedHeight, text);
    });

    // Get paths (edges)
    Array.from(svgElement.querySelectorAll('path')).forEach(path => {
      if (path.closest('marker')) return;
      const { tx, ty, scaleX, scaleY } = getTransform(path);
      const d = path.getAttribute('d') || '';
      // Extract numeric coordinates from path data
      const coords = d.match(/[\d.-]+/g) || [];
      for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]) * scaleX + tx;
        const y = parseFloat(coords[i + 1]) * scaleY + ty;
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hasContent = true;
        }
      }
    });

    // Get polygons
    Array.from(svgElement.querySelectorAll('polygon')).forEach(polygon => {
      if (polygon.closest('marker')) return;
      const { tx, ty, scaleX, scaleY } = getTransform(polygon);
      const points = polygon.getAttribute('points') || '';
      const coords = points.match(/[\d.-]+/g) || [];
      for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]) * scaleX + tx;
        const y = parseFloat(coords[i + 1]) * scaleY + ty;
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hasContent = true;
        }
      }
    });

    // Get polylines
    Array.from(svgElement.querySelectorAll('polyline')).forEach(polyline => {
      if (polyline.closest('marker')) return;
      const { tx, ty, scaleX, scaleY } = getTransform(polyline);
      const points = polyline.getAttribute('points') || '';
      const coords = points.match(/[\d.-]+/g) || [];
      for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]) * scaleX + tx;
        const y = parseFloat(coords[i + 1]) * scaleY + ty;
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hasContent = true;
        }
      }
    });

    console.log(`Bounding box calculation: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
    return hasContent ? { minX, minY, maxX, maxY } : null;
  };

  const bbox = calculateBoundingBox();
  if (bbox) {
    // Add 10px padding around content
    const padding = 10;
    const contentWidth = bbox.maxX - bbox.minX;
    const contentHeight = bbox.maxY - bbox.minY;
    const newWidth = Math.ceil(contentWidth + padding * 2);
    const newHeight = Math.ceil(contentHeight + padding * 2);

    console.log(`Content bounds: ${bbox.minX}, ${bbox.minY} to ${bbox.maxX}, ${bbox.maxY}`);
    console.log(`Content size: ${contentWidth} x ${contentHeight}`);

    // Set viewBox to tightly fit content with padding
    // ViewBox: x, y (top-left corner), width, height
    const viewBoxX = bbox.minX - padding;
    const viewBoxY = bbox.minY - padding;
    const newViewBox = `${viewBoxX} ${viewBoxY} ${newWidth} ${newHeight}`;

    svgElement.setAttribute('viewBox', newViewBox);
    svgElement.setAttribute('width', newWidth.toString());
    svgElement.setAttribute('height', newHeight.toString());

    console.log(`✓ Canvas adjusted to fit content: viewBox="${newViewBox}" (${newWidth}x${newHeight}px)`);
  }

  // Remove remaining class and style attributes from SVG root
  svgElement.removeAttribute('class');
  const rootStyle = svgElement.getAttribute('style');
  if (rootStyle) {
    // Keep only max-width if present
    const maxWidthMatch = rootStyle.match(/max-width:\s*([^;]+)/);
    if (maxWidthMatch) {
      svgElement.setAttribute('style', `max-width: ${maxWidthMatch[1]}`);
    } else {
      svgElement.removeAttribute('style');
    }
  }

  // Serialize
  const serializer = new XMLSerializer();
  let svgData = serializer.serializeToString(svgElement);

  // Final cleanup: remove any remaining !important and class/style in attributes
  svgData = svgData.replace(/\s*!important\s*/g, ' ');
  svgData = svgData.replace(/fill="([^"]*)\s+"/g, 'fill="$1"'); // Clean up extra spaces
  svgData = svgData.replace(/stroke="([^"]*)\s+"/g, 'stroke="$1"');

  // Remove class and style from markers
  svgData = svgData.replace(/<marker([^>]*)\s+class="[^"]*"/g, '<marker$1');
  svgData = svgData.replace(/<marker([^>]*)\s+style="[^"]*"/g, '<marker$1');

  // Remove class and style from elements inside markers
  svgData = svgData.replace(/(<marker[^>]*>[\s\S]*?<\/marker>)/g, (markerBlock) => {
    return markerBlock
      .replace(/\s+class="[^"]*"/g, '')
      .replace(/\s+style="[^"]*"/g, '');
  });

  svgData = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgData;

  console.log(`✓ Converted SVG successfully`);
  console.log(`  - Replaced ${textData.length} foreignObjects with text elements`);
  console.log(`  - Applied colors to ${markerColors.size} markers`);

  return svgData;
};
