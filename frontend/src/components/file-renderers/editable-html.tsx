import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';

interface EditableHtmlProps {
  html: string;
  onSave: (newHtml: string) => void;
  onCancel: () => void;
}

export function EditableHtml({ html, onSave, onCancel }: EditableHtmlProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const [currentHtml, setCurrentHtml] = useState<string>("");
  const { t } = useTranslation();

  useEffect(() => {
    setCurrentHtml(html);
  }, [html]);

  const handleInput = () => {
    if (editableRef.current) {
      setCurrentHtml(editableRef.current.innerHTML);
    }
  };

  const handleSave = () => {
    // Wrap in a full HTML document for consistency with preview
    const fullHtml = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>Document</title>\n  </head>\n  <body>\n    ${currentHtml}\n  </body>\n</html>`;
    onSave(fullHtml);
  };

  return (
    <div className="relative p-4 bg-white min-h-[400px]">
      <div
        ref={editableRef}
        className="mb-8 border rounded min-h-[200px] p-4 bg-gray-50 focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: currentHtml }}
        onInput={handleInput}
        style={{ outline: "2px solid #667eea", borderRadius: 8, minHeight: 200, cursor: "text" }}
      />
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