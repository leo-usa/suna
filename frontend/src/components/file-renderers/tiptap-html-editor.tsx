import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { useTranslation } from 'react-i18next';

interface TiptapHtmlEditorProps {
  html: string;
  onSave: (newHtml: string) => void;
  onCancel: () => void;
}

export function TiptapHtmlEditor({ html, onSave, onCancel }: TiptapHtmlEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class: 'prose max-w-full min-h-[200px] h-[400px] overflow-auto p-4 border rounded bg-gray-50 focus:outline-none',
        style: 'resize: vertical; outline: 2px solid #667eea; border-radius: 8px;',
      },
    },
  });

  // Update content if html prop changes (e.g. on discard)
  useEffect(() => {
    if (editor && html !== editor.getHTML()) {
      editor.commands.setContent(html, false);
    }
  }, [html, editor]);

  if (!editor) return null;

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
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'font-bold text-blue-600' : ''}>{t('editor.bold', 'Bold')}</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'italic text-blue-600' : ''}>{t('editor.italic', 'Italic')}</button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'underline text-blue-600' : ''}>{t('editor.underline', 'Underline')}</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'font-bold text-lg text-blue-600' : ''}>{t('editor.h1', 'H1')}</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'font-bold text-blue-600' : ''}>{t('editor.h2', 'H2')}</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'text-blue-600' : ''}>{t('editor.bulletList', 'Bullet List')}</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'text-blue-600' : ''}>{t('editor.orderedList', 'Ordered List')}</button>
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'text-blue-600' : ''}>{t('editor.alignLeft', 'Left')}</button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'text-blue-600' : ''}>{t('editor.alignCenter', 'Center')}</button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'text-blue-600' : ''}>{t('editor.alignRight', 'Right')}</button>
        <button onClick={() => editor.chain().focus().undo().run()}>{t('editor.undo', 'Undo')}</button>
        <button onClick={() => editor.chain().focus().redo().run()}>{t('editor.redo', 'Redo')}</button>
        <button onClick={() => {
          const url = window.prompt(t('editor.enterImageUrl', 'Enter image URL'));
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}>{t('editor.image', 'Image')}</button>
        <button onClick={() => {
          const url = window.prompt(t('editor.enterLinkUrl', 'Enter link URL'));
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}>{t('editor.link', 'Link')}</button>
      </div>
      <EditorContent editor={editor} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 32 }}>
        <button
          style={{ background: "#667eea", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          onClick={() => onSave(editor.getHTML())}
        >
          {t('editor.save', 'Save')}
        </button>
        <button
          style={{ background: "#eee", color: "#333", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          onClick={onCancel}
        >
          {t('editor.discard', 'Discard')}
        </button>
      </div>
    </div>
  );
} 