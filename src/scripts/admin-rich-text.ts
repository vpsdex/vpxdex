import { Editor } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';

type ToolbarAction = {
  label: string;
  title: string;
  group: 'format' | 'insert';
  variant?: 'default' | 'accent';
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void | boolean | Promise<void>;
};

const STYLE_ID = 'admin-rich-text-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tiptap-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }

    .tiptap-toolbar-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 6px;
      border: 1px solid var(--theme-border);
      border-radius: 10px;
      background: var(--theme-surface);
    }

    .tiptap-toolbar button {
      border: 1px solid var(--theme-border);
      background: #fffdf8;
      color: var(--theme-primary);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      line-height: 1.5;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .tiptap-toolbar button:hover {
      background: var(--theme-surface);
      border-color: var(--theme-primary);
    }

    .tiptap-toolbar button.is-active {
      background: var(--theme-primary);
      color: #fff;
      border-color: var(--theme-primary);
    }

    .tiptap-toolbar button.tiptap-toolbar-button-accent {
      background: var(--theme-accent-soft);
      border-color: #f6aa9f;
      color: var(--theme-accent);
    }

    .tiptap-toolbar button.tiptap-toolbar-button-accent:hover {
      background: #ffd0c8;
      border-color: var(--theme-accent);
    }

    .tiptap-toolbar button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .tiptap-editor-shell [data-rich-text-editor] {
      min-height: 240px;
      border: 1px solid var(--theme-border);
      border-radius: 8px;
      background: #fffdf8;
      padding: 12px;
    }

    .tiptap-editor-shell .ProseMirror {
      min-height: 214px;
      outline: none;
    }

    .tiptap-editor-shell .ProseMirror h2 {
      font-size: 1.5rem;
      line-height: 2rem;
      font-weight: 700;
      margin: 1rem 0 0.75rem;
    }

    .tiptap-editor-shell .ProseMirror h3 {
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 700;
      margin: 0.875rem 0 0.625rem;
    }

    .tiptap-editor-shell .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: var(--theme-text-muted);
      float: left;
      height: 0;
      pointer-events: none;
    }

    .tiptap-editor-shell .ProseMirror img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    .tiptap-editor-shell .ProseMirror blockquote {
      border-left: 3px solid var(--theme-border);
      margin: 1rem 0;
      padding-left: 1rem;
      color: var(--theme-text-muted);
    }

    .tiptap-editor-shell .ProseMirror pre {
      background: var(--theme-primary);
      color: #fcf5e2;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
    }

    .tiptap-image-dialog {
      width: min(520px, calc(100vw - 32px));
      border: none;
      border-radius: 10px;
      padding: 0;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
      margin: auto;
    }

    .tiptap-image-dialog::backdrop {
      background: rgba(15, 23, 42, 0.45);
    }

    .tiptap-image-dialog-panel {
      padding: 20px;
      background: #fffdf8;
      border-radius: 10px;
    }

    .tiptap-image-dialog-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--theme-primary);
    }

    .tiptap-image-dialog-header p {
      margin: 6px 0 0;
      color: var(--theme-text-muted);
      font-size: 13px;
    }

    .tiptap-image-dialog-body {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    .tiptap-image-dialog-body label {
      display: grid;
      gap: 6px;
      color: var(--theme-primary);
      font-size: 13px;
      font-weight: 600;
    }

    .tiptap-image-dialog-body input {
      width: 100%;
      border: 1px solid var(--theme-border);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      color: var(--theme-primary);
      background: #fffdf8;
    }

    .tiptap-image-dialog-body input:focus {
      outline: none;
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 3px rgba(241, 12, 0, 0.12);
    }

    .tiptap-image-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .tiptap-image-dialog-footer button {
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--theme-border);
      cursor: pointer;
    }

    .tiptap-image-dialog-cancel {
      background: #fffdf8;
      color: var(--theme-primary);
    }

    .tiptap-image-dialog-submit {
      background: var(--theme-accent);
      color: #fff;
      border-color: var(--theme-accent);
    }
  `;

  document.head.appendChild(style);
}

function getSerializedHtml(editor: Editor): string {
  return editor.isEmpty ? '' : editor.getHTML();
}

function isValidExternalImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/admin/upload-image', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json() as { url?: string; error?: string };
  if (!response.ok || !result?.url) {
    throw new Error(result?.error || 'Image upload failed');
  }

  return result.url as string;
}

function createHiddenFileInput(onSelect: (file: File) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      onSelect(file);
    }
    input.value = '';
  });
  document.body.appendChild(input);
  return input;
}

async function promptExternalImage(): Promise<{ src: string; alt: string } | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'tiptap-image-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="tiptap-image-dialog-panel">
        <div class="tiptap-image-dialog-header">
          <h3>插入图片链接</h3>
          <p>支持外部 http/https 图片地址，可选填写图片说明。</p>
        </div>
        <div class="tiptap-image-dialog-body">
          <label>
            图片链接
            <input name="src" type="url" placeholder="https://example.com/image.jpg" required />
          </label>
          <label>
            图片说明
            <input name="alt" type="text" placeholder="可选" />
          </label>
        </div>
        <div class="tiptap-image-dialog-footer">
          <button type="button" class="tiptap-image-dialog-cancel">取消</button>
          <button type="submit" class="tiptap-image-dialog-submit">插入图片</button>
        </div>
      </form>
    `;

    let settled = false;
    const form = dialog.querySelector('form');
    const urlInput = dialog.querySelector<HTMLInputElement>('input[name="src"]');
    const altInput = dialog.querySelector<HTMLInputElement>('input[name="alt"]');
    const cancelButton = dialog.querySelector<HTMLButtonElement>('.tiptap-image-dialog-cancel');

    const cleanup = (value: { src: string; alt: string } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    cancelButton?.addEventListener('click', () => cleanup(null));
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const src = urlInput?.value.trim() || '';

      if (!isValidExternalImageUrl(src)) {
        urlInput?.focus();
        urlInput?.setCustomValidity('请输入有效的 http 或 https 图片链接');
        urlInput?.reportValidity();
        return;
      }

      urlInput?.setCustomValidity('');
      cleanup({
        src,
        alt: altInput?.value.trim() || '',
      });
    });

    dialog.addEventListener('close', () => cleanup(null));
    document.body.appendChild(dialog);
    dialog.showModal();
    urlInput?.focus();
  });
}

async function insertExternalImage(editor: Editor) {
  const selection = {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  };

  const image = await promptExternalImage();
  if (!image) {
    return;
  }

  editor
    .chain()
    .focus()
    .setTextSelection(selection)
    .setImage({ src: image.src, alt: image.alt })
    .run();
}

function buildActions(filePicker: HTMLInputElement, editor: Editor): ToolbarAction[] {
  return [
    {
      label: 'H2',
      title: 'Heading 2',
      group: 'format',
      isActive: (editor) => editor.isActive('heading', { level: 2 }),
      run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'H3',
      title: 'Heading 3',
      group: 'format',
      isActive: (editor) => editor.isActive('heading', { level: 3 }),
      run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'B',
      title: 'Bold',
      group: 'format',
      isActive: (editor) => editor.isActive('bold'),
      run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'I',
      title: 'Italic',
      group: 'format',
      isActive: (editor) => editor.isActive('italic'),
      run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'S',
      title: 'Strike',
      group: 'format',
      isActive: (editor) => editor.isActive('strike'),
      run: (editor) => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: 'UL',
      title: 'Bullet List',
      group: 'format',
      isActive: (editor) => editor.isActive('bulletList'),
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'OL',
      title: 'Ordered List',
      group: 'format',
      isActive: (editor) => editor.isActive('orderedList'),
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Quote',
      title: 'Blockquote',
      group: 'format',
      isActive: (editor) => editor.isActive('blockquote'),
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: '</>',
      title: 'Code Block',
      group: 'format',
      isActive: (editor) => editor.isActive('codeBlock'),
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'HR',
      title: 'Horizontal Rule',
      group: 'format',
      run: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: '图片链接',
      title: 'Insert External Image URL',
      group: 'insert',
      variant: 'accent',
      run: () => insertExternalImage(editor),
    },
    {
      label: '上传图片',
      title: 'Upload Local Image',
      group: 'insert',
      variant: 'accent',
      run: () => filePicker.click(),
    },
  ];
}

async function insertUploadedImage(editor: Editor, file: File) {
  const imageUrl = await uploadImage(file);
  editor.chain().focus().setImage({ src: imageUrl, alt: file.name }).run();
}

function attachImageTransferHandlers(editor: Editor, editorElement: HTMLElement) {
  const uploadFiles = async (files: FileList | null | undefined) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      return;
    }

    for (const file of imageFiles) {
      try {
        await insertUploadedImage(editor, file);
      } catch (error) {
        console.error('Failed to upload editor image:', error);
        alert(error instanceof Error ? error.message : 'Image upload failed');
        break;
      }
    }
  };

  editorElement.addEventListener('drop', async (event) => {
    if (!event.dataTransfer?.files?.length) {
      return;
    }

    event.preventDefault();
    await uploadFiles(event.dataTransfer.files);
  });

  editorElement.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
    }
  });

  editorElement.addEventListener('paste', async (event) => {
    const files = event.clipboardData?.files;
    if (!files?.length) {
      return;
    }

    const hasImageFile = Array.from(files).some((file) => file.type.startsWith('image/'));
    if (!hasImageFile) {
      return;
    }

    event.preventDefault();
    await uploadFiles(files);
  });
}

function mountEditor(root: HTMLElement) {
  if (root.dataset.richTextInitialized === 'true') {
    return;
  }

  const input = root.querySelector<HTMLInputElement>('[data-rich-text-input]');
  const toolbar = root.querySelector<HTMLElement>('[data-rich-text-toolbar]');
  const editorElement = root.querySelector<HTMLElement>('[data-rich-text-editor]');

  if (!input || !toolbar || !editorElement) {
    return;
  }

  root.dataset.richTextInitialized = 'true';

  const placeholder = root.getAttribute('data-placeholder') || '';
  const editor = new Editor({
    element: editorElement,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({
        levels: [2, 3],
      }),
      Image,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: input.value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none',
      },
    },
    onCreate: ({ editor }) => {
      input.value = getSerializedHtml(editor);
    },
    onUpdate: ({ editor }) => {
      input.value = getSerializedHtml(editor);
    },
  });

  const filePicker = createHiddenFileInput(async (file) => {
    try {
      await insertUploadedImage(editor, file);
    } catch (error) {
      console.error('Failed to upload editor image:', error);
      alert(error instanceof Error ? error.message : 'Image upload failed');
    }
  });

  attachImageTransferHandlers(editor, editorElement);

  const actions = buildActions(filePicker, editor);
  const toolbarGroups = new Map<string, HTMLDivElement>();
  const buttons = actions.map((action) => {
    let groupElement = toolbarGroups.get(action.group);
    if (!groupElement) {
      groupElement = document.createElement('div');
      groupElement.className = 'tiptap-toolbar-group';
      toolbarGroups.set(action.group, groupElement);
      toolbar.appendChild(groupElement);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.title = action.title;
    if (action.variant === 'accent') {
      button.classList.add('tiptap-toolbar-button-accent');
    }
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    button.addEventListener('click', async () => {
      await action.run(editor);
      updateActiveStates();
    });
    groupElement.appendChild(button);
    return { button, action };
  });

  const updateActiveStates = () => {
    for (const { button, action } of buttons) {
      button.classList.toggle('is-active', action.isActive ? action.isActive(editor) : false);
    }
  };

  editor.on('selectionUpdate', updateActiveStates);
  editor.on('transaction', updateActiveStates);
  updateActiveStates();
}

export function initAdminRichTextEditors() {
  if (typeof document === 'undefined') {
    return;
  }

  ensureStyles();
  document.querySelectorAll<HTMLElement>('[data-rich-text-root]').forEach(mountEditor);
}
