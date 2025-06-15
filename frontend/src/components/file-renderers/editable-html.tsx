import React, { useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';

interface EditableHtmlProps {
  html: string;
  onSave: (newHtml: string) => void;
  onCancel: () => void;
}

export function EditableHtml({ html, onSave, onCancel }: EditableHtmlProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Only update the DOM when the prop changes (e.g., on open/discard)
  useEffect(() => {
    if (editableRef.current && editableRef.current.innerHTML !== html) {
      editableRef.current.innerHTML = html;
    }
  }, [html]);

  const handleSave = () => {
    const htmlContent = editableRef.current?.innerHTML || "";
    const fullHtml = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>Document</title>\n  </head>\n  <body>\n    ${htmlContent}\n  </body>\n</html>`;
    onSave(fullHtml);
  };

  const handleInput = () => {
    if (editableRef.current) {
      // Save scroll position and selection
      const scrollTop = editableRef.current.scrollTop;
      const selection = window.getSelection();
      let range = null;
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0).cloneRange();
      }
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.scrollTop = scrollTop;
          // Restore selection
          if (range) {
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }, 0);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10vh',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80vw',
      maxWidth: 900,
      zIndex: 2000,
      background: 'white',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: 32,
    }}>
      <div style={{ overflowAnchor: "none" }}>
        <div
          ref={editableRef}
          className="mb-8 border rounded p-4 bg-gray-50 focus:outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{
            outline: "2px solid #667eea",
            borderRadius: 8,
            minHeight: 200,
            height: 400,
            overflow: "auto",
            cursor: "text",
            resize: "vertical",
          }}
        />
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000, display: "flex", justifyContent: "center", padding: 16, background: "rgba(255,255,255,0.95)", boxShadow: "0 -2px 16px rgba(0,0,0,0.08)", gap: 16 }}>
        <button
          style={{ background: "#667eea", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          onClick={handleSave}
        >
          {t('editor.save')}
        </button>
        <button
          style={{ background: "#eee", color: "#333", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          onClick={onCancel}
        >
          {t('editor.discard')}
        </button>
      </div>
    </div>
  );
}

// Add some basic styles for highlighting
// .editable-html-block { transition: outline 0.2s; }
// .editable-html-text { transition: background 0.2s; } 