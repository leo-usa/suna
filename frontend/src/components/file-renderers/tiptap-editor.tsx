import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface TiptapEditorProps {
  initialHtml: string;
  onSave: (html: string) => void;
  onCancel: () => void;
}

function extractBodyContent(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function wrapWithHtmlDoc(bodyContent: string): string {
  return `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>Document</title>\n  </head>\n  <body>\n    ${bodyContent}\n  </body>\n</html>`;
}

export default function TiptapEditor({ initialHtml, onSave, onCancel }: TiptapEditorProps) {
  const [hasSaved, setHasSaved] = React.useState(false);
  const [hasCancelled, setHasCancelled] = React.useState(false);
  const [bodyContent] = React.useState(() => extractBodyContent(initialHtml));
  const editor = useEditor({
    extensions: [StarterKit],
    content: bodyContent,
    editable: true,
  });

  const handleSave = () => {
    if (editor) {
      setHasSaved(true);
      const html = wrapWithHtmlDoc(editor.getHTML());
      onSave(html);
    }
  };

  const handleCancel = () => {
    setHasCancelled(true);
    onCancel();
  };

  // Prevent further editing after save/cancel
  React.useEffect(() => {
    if ((hasSaved || hasCancelled) && editor) {
      editor.setEditable(false);
    }
  }, [hasSaved, hasCancelled, editor]);

  return (
    <div className="tiptap-editor border rounded p-2 bg-white dark:bg-black min-h-[200px] flex flex-col gap-4">
      <EditorContent editor={editor} />
      <div className="flex gap-2 justify-end mt-2">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
          onClick={handleSave}
          disabled={hasSaved || hasCancelled}
        >
          Save
        </button>
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded"
          onClick={handleCancel}
          disabled={hasSaved || hasCancelled}
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 