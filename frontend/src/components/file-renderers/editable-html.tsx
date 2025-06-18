import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';

interface EditableHtmlProps {
  html: string;
  onSave: (newHtml: string) => void;
  onCancel: () => void;
}

// Helper to extract background color from inline body style
function extractBodyBgFromInline(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*style=["'][^"']*background\s*:\s*([^;"']+)/i);
  return bodyMatch ? bodyMatch[1].trim() : null;
}

// Helper to extract background color from <style>body { background: ...; }</style>
function extractBodyBgFromStyle(html: string): string | null {
  const styleMatch = html.match(/<style[^>]*>[\s\S]*?body\s*{[^}]*background\s*:\s*([^;\n]+)[^}]*}/i);
  return styleMatch ? styleMatch[1].trim() : null;
}

// Helper to extract text-align and justify-content from inline body style
function extractBodyTextAlignFromInline(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*style=["'][^"']*text-align\s*:\s*([^;"']+)/i);
  return bodyMatch ? bodyMatch[1].trim() : null;
}
function extractBodyJustifyContentFromInline(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*style=["'][^"']*justify-content\s*:\s*([^;"']+)/i);
  return bodyMatch ? bodyMatch[1].trim() : null;
}

// Helper to extract text-align and justify-content from <style>body { ... }</style>
function extractBodyTextAlignFromStyle(html: string): string | null {
  const styleMatch = html.match(/<style[^>]*>[\s\S]*?body\s*{[^}]*text-align\s*:\s*([^;\n]+)[^}]*}/i);
  return styleMatch ? styleMatch[1].trim() : null;
}
function extractBodyJustifyContentFromStyle(html: string): string | null {
  const styleMatch = html.match(/<style[^>]*>[\s\S]*?body\s*{[^}]*justify-content\s*:\s*([^;\n]+)[^}]*}/i);
  return styleMatch ? styleMatch[1].trim() : null;
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

  // Detect background color and centering styles from HTML
  const bgColor = useMemo(() => {
    return (
      extractBodyBgFromInline(html) ||
      extractBodyBgFromStyle(html) ||
      'white'
    );
  }, [html]);

  const textAlign = useMemo(() => {
    return (
      extractBodyTextAlignFromInline(html) ||
      extractBodyTextAlignFromStyle(html) ||
      undefined
    );
  }, [html]);

  const justifyContent = useMemo(() => {
    return (
      extractBodyJustifyContentFromInline(html) ||
      extractBodyJustifyContentFromStyle(html) ||
      undefined
    );
  }, [html]);

  return (
    <div style={{
      position: 'fixed',
      top: '10vh',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80vw',
      maxWidth: 900,
      zIndex: 2000,
      background: bgColor,
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: 32,
      transition: 'background 0.2s',
    }}>
      <div style={{ overflowAnchor: "none" }}>
        <div
          ref={editableRef}
          className="mb-8 border rounded p-4 focus:outline-none"
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
            background: bgColor,
            transition: 'background 0.2s',
            textAlign: textAlign as any,
            display: justifyContent ? 'flex' : undefined,
            justifyContent: justifyContent,
          }}
        />
        <div style={{ display: "flex", justifyContent: "center", padding: 16, background: "rgba(255,255,255,0.95)", boxShadow: "0 -2px 16px rgba(0,0,0,0.08)", gap: 16, marginTop: 16 }}>
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
    </div>
  );
}

// Add some basic styles for highlighting
// .editable-html-block { transition: outline 0.2s; }
// .editable-html-text { transition: background 0.2s; } 