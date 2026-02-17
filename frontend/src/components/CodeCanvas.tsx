import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Minus, Maximize2, X } from 'lucide-react';
import './CodeCanvas.css';

interface CodeCanvasProps {
  code: string;
  language: string;
  onClose: () => void;
}

export function CodeCanvas({ code, language, onClose }: CodeCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.left = '-999999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Copy failed:', e);
      }
    }
  };

  const handleMinimize = () => {
    if (isMaximized) setIsMaximized(false);
    setIsMinimized(!isMinimized);
  };

  const handleMaximize = () => {
    if (isMinimized) setIsMinimized(false);
    setIsMaximized(!isMaximized);
  };

  return (
    <div
      className={`code-canvas ${isMinimized ? 'minimized' : ''} ${isMaximized ? 'maximized' : ''}`}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-label={`Code snippet in ${language}`}
    >
      <div className="canvas-header">
        <div className="canvas-left">
          <span className="canvas-lang">{language}</span>
          <span className="canvas-sep">—</span>
          <span className="canvas-label">code</span>
        </div>
        <div className="canvas-controls">
          <button className="canvas-btn" onClick={handleCopy} title={copied ? 'Copied' : 'Copy'}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button className="canvas-btn" onClick={handleMinimize} title={isMinimized ? 'Expand' : 'Minimize'}>
            <Minus size={13} />
          </button>
          <button className="canvas-btn" onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
            <Maximize2 size={13} />
          </button>
          <button className="canvas-btn close" onClick={onClose} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="canvas-body">
          <SyntaxHighlighter
            language={language}
            style={isDark ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              background: 'transparent',
              fontSize: '0.775rem',
              lineHeight: '1.65',
              padding: '1rem',
            }}
            showLineNumbers
            lineNumberStyle={{
              fontSize: '0.65rem',
              minWidth: '2rem',
              paddingRight: '1rem',
              opacity: 0.3,
            }}
            wrapLines
            lineProps={{
              style:{
                background: 'transparent',
                display: 'block',
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}