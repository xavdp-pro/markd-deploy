import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import TurndownService from 'turndown';
import { createMentionSuggestion } from './mentionSuggestion';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, CheckSquare, Code, Quote, Link as LinkIcon,
  Undo2, Redo2, Image as ImageIcon, Paperclip, Loader2, X,
} from 'lucide-react';

// HTML → Markdown converter
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Task list support for turndown
turndown.addRule('taskListItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.parentElement?.getAttribute('data-type') === 'taskList';
  },
  replacement: (content, node) => {
    const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
    const checked = checkbox?.hasAttribute('checked') ?? false;
    const cleanContent = content.replace(/^\n+/, '').replace(/\n+$/, '');
    return `- [${checked ? 'x' : ' '}] ${cleanContent}\n`;
  },
});

// Mention support for turndown: convert <span data-type="mention"> to @username
turndown.addRule('mention', {
  filter: (node) => {
    return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'mention';
  },
  replacement: (_content, node) => {
    const label = (node as HTMLElement).getAttribute('data-label') || (node as HTMLElement).textContent || '';
    return `@${label.replace(/^@/, '')}`;
  },
});

// Markdown → HTML (simple converter for loading existing markdown into editor)
function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md;
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Task lists
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">$1</li></ul>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">$1</li></ul>');
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Paragraphs (lines not already wrapped)
  html = html.replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p>$1</p>');
  return html;
}

interface WysiwygEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  height?: number;
  onSubmit?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  onUploadFile?: (file: File) => Promise<{ url: string; name: string } | null>;
  workspaceId?: string;
}

// Toolbar button component
const TBtn: React.FC<{
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}> = ({ icon, active, onClick, title, disabled }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    disabled={disabled}
    className={`p-1 rounded transition-colors ${
      active
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    title={title}
  >
    {icon}
  </button>
);

const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something...',
  height = 100,
  onSubmit,
  onCancel,
  autoFocus = false,
  onUploadFile,
  workspaceId,
}) => {
  const mentionSuggestion = useRef(workspaceId ? createMentionSuggestion(workspaceId) : null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const mdRef = useRef(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      ...(mentionSuggestion.current ? [Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: mentionSuggestion.current,
      })] : []),
    ],
    content: markdownToHtml(value),
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[60px] h-full',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          // Flush pending markdown before submit
          if (debounceRef.current) clearTimeout(debounceRef.current);
          onChangeRef.current(mdRef.current);
          setTimeout(() => onSubmit?.(), 0);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const md = turndown.turndown(html);
      mdRef.current = md;
      // Debounce onChange to avoid re-rendering comment list on every keystroke
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(md);
      }, 300);
    },
  });

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Sync external value changes into editor
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const currentMd = turndown.turndown(currentHtml);
    if (currentMd !== value) {
      editor.commands.setContent(markdownToHtml(value));
    }
  }, [value, editor]);

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    setLinkUrl('');
    setShowLinkModal(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }, [editor]);

  const confirmLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    setShowLinkModal(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleFileUpload = useCallback(async (file: File, isImage: boolean) => {
    if (!editor || !onUploadFile) return;
    setUploading(true);
    try {
      const result = await onUploadFile(file);
      if (result) {
        if (isImage && file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: result.url, alt: result.name }).run();
        } else {
          // Insert as a markdown link
          editor.chain().focus().insertContent(`<a href="${result.url}">📎 ${result.name}</a>`).run();
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [editor, onUploadFile]);

  if (!editor) return null;

  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex-wrap">
        <TBtn icon={<Bold size={14} />} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" />
        <TBtn icon={<Italic size={14} />} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" />
        <TBtn icon={<UnderlineIcon size={14} />} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" />
        <TBtn icon={<Strikethrough size={14} />} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough" />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
        <TBtn icon={<List size={14} />} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" />
        <TBtn icon={<ListOrdered size={14} />} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list" />
        <TBtn icon={<CheckSquare size={14} />} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list" />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
        <TBtn icon={<Code size={14} />} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block" />
        <TBtn icon={<Quote size={14} />} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote" />
        <TBtn icon={<LinkIcon size={14} />} active={editor.isActive('link')} onClick={openLinkModal} title="Link" />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
        <TBtn icon={<Undo2 size={14} />} onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()} />
        <TBtn icon={<Redo2 size={14} />} onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()} />
        {onUploadFile && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <TBtn
              icon={uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              onClick={() => imageInputRef.current?.click()}
              title="Upload image"
              disabled={uploading}
            />
            <TBtn
              icon={<Paperclip size={14} />}
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              disabled={uploading}
            />
          </>
        )}
      </div>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, true); e.target.value = ''; }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, false); e.target.value = ''; }}
      />
      {/* Editor content */}
      <div style={{ height: `${height}px`, overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Link modal */}
      {showLinkModal && (
        <div className="absolute z-50 left-0 right-0 top-0 bottom-0 flex items-center justify-center bg-black/20 rounded-xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 mx-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Insert link</span>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={14} />
              </button>
            </div>
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmLink(); } if (e.key === 'Escape') setShowLinkModal(false); }}
              placeholder="https://..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setShowLinkModal(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
              <button onClick={confirmLink} disabled={!linkUrl.trim()} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40">Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WysiwygEditor;
