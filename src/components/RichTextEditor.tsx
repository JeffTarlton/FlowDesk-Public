import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import suggestion from './mention/suggestion';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Bold, Italic, List, Code, Type, ListOrdered, Paperclip, Loader2
} from 'lucide-react';

interface Props {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ content, onChange, placeholder, className = "" }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      setIsUploading(true);
      // Preserve the original filename — prefix with a short unique ID to avoid collisions
      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `comment-attachments/${uniquePrefix}_${safeFileName}`;

      const { error } = await supabase.storage
        .from('ticket_attachments')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('ticket_attachments')
        .getPublicUrl(filePath);

      if (editor && publicUrl) {
        const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.name);
        if (isImage) {
          editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
        } else {
          // Non-image files: insert as a clickable download link
          editor.chain().focus()
            .insertContent(`<a href="${publicUrl}" target="_blank" rel="noopener noreferrer">📎 ${file.name}</a> `)
            .run();
        }
      }
    } catch (err: any) {
      console.error('File upload err:', err);
      alert('Failed to upload file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-bold px-1.5 py-0.5 rounded-md cursor-pointer',
        },
        suggestion,
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full my-4 border border-gray-200 dark:border-gray-700 max-h-96 object-contain',
        },
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white transition-all focus:ring-2 focus:ring-primary-500/20 ${className}`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div 
      className="relative group w-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <BubbleMenu editor={editor} className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl divide-x divide-gray-100 dark:divide-gray-800">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('bold') ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('italic') ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('bulletList') ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('orderedList') ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('codeBlock') ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <Code size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${editor.isActive('heading', { level: 3 }) ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-500'}`}
        >
          <Type size={16} />
        </button>
      </BubbleMenu>
      
      <div className="relative">
        <EditorContent editor={editor} />
        {editor.isEmpty && placeholder && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm italic">
            {placeholder}
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,.pdf,.doc,.docx"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
              e.target.value = ''; // Reset
            }
          }}
        />
        
        {isUploading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-surface-dark/70 flex items-center justify-center rounded-xl z-10 backdrop-blur-[2px]">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm font-semibold text-primary-700 dark:text-primary-400">Uploading...</span>
          </div>
        )}
      </div>
      
      <div className="mt-1 flex items-center justify-between">
         <div className="flex items-center gap-3 px-2">
           <button 
             type="button" 
             onClick={() => fileInputRef.current?.click()}
             className="text-gray-400 hover:text-primary-500 transition-colors flex items-center gap-1"
           >
             <Paperclip size={14} />
             <span className="text-[10px] font-semibold uppercase tracking-wider">Attach</span>
           </button>
           <div className="text-[10px] text-gray-400 font-medium">Highlight text to format</div>
         </div>
         <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${editor.isFocused ? 'text-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'text-gray-300 dark:text-gray-700'}`}>
           {editor.isFocused ? 'Active' : 'Idle'}
         </div>
      </div>
    </div>
  );
}
