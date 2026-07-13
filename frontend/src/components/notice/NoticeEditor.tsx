import React, { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<string>;
};

const toolbarButton =
  'min-w-8 rounded px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40';

export const NoticeEditor: React.FC<Props> = ({ value, onChange, onUploadImage }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount) savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const runCommand = (command: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emitChange();
    rememberSelection();
  };

  const openImagePicker = () => {
    rememberSelection();
    imageInputRef.current?.click();
  };

  const insertImageAtSelection = (url: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    const range = savedRangeRef.current;
    if (selection && range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.className = 'notice-editor-image';

    const imageBlock = document.createElement('div');
    imageBlock.appendChild(image);
    const nextLine = document.createElement('div');
    nextLine.appendChild(document.createElement('br'));

    const currentSelection = window.getSelection();
    if (currentSelection?.rangeCount) {
      const currentRange = currentSelection.getRangeAt(0);
      currentRange.deleteContents();
      const fragment = document.createDocumentFragment();
      fragment.append(imageBlock, nextLine);
      currentRange.insertNode(fragment);
      currentRange.setStart(nextLine, 0);
      currentRange.collapse(true);
      currentSelection.removeAllRanges();
      currentSelection.addRange(currentRange);
    } else {
      editor.append(imageBlock, nextLine);
    }

    emitChange();
    rememberSelection();
  };

  const handleImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    setUploading(true);
    try {
      const url = await onUploadImage(file);
      insertImageAtSelection(url);
    } catch {
      alert('이미지를 업로드하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (!imageFiles.length) return;

    event.preventDefault();
    rememberSelection();
    setUploading(true);
    try {
      for (const file of imageFiles) {
        const url = await onUploadImage(file);
        insertImageAtSelection(url);
      }
    } catch {
      alert('붙여넣은 이미지를 업로드하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-[#00A8A3] focus-within:ring-1 focus-within:ring-[#00A8A3]">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <select
          aria-label="글자 크기"
          defaultValue="3"
          onChange={(event) => runCommand('fontSize', event.target.value)}
          className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600"
        >
          <option value="2">13px</option>
          <option value="3">16px</option>
          <option value="4">18px</option>
          <option value="5">24px</option>
        </select>
        <button type="button" className={toolbarButton} onClick={() => runCommand('bold')} aria-label="굵게">B</button>
        <button type="button" className={`${toolbarButton} italic`} onClick={() => runCommand('italic')} aria-label="기울임">I</button>
        <button type="button" className={`${toolbarButton} underline`} onClick={() => runCommand('underline')} aria-label="밑줄">U</button>
        <button type="button" className={`${toolbarButton} line-through`} onClick={() => runCommand('strikeThrough')} aria-label="취소선">S</button>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" className={toolbarButton} onClick={() => runCommand('justifyLeft')} aria-label="왼쪽 정렬">≡</button>
        <button type="button" className={toolbarButton} onClick={() => runCommand('justifyCenter')} aria-label="가운데 정렬">≣</button>
        <button type="button" className={toolbarButton} onClick={() => runCommand('justifyRight')} aria-label="오른쪽 정렬">≡</button>
        <button type="button" className={toolbarButton} onClick={() => runCommand('insertUnorderedList')} aria-label="목록">☷</button>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleImage}
        />
        <button
          type="button"
          className={`${toolbarButton} ml-auto`}
          onMouseDown={rememberSelection}
          onClick={openImagePicker}
          disabled={uploading}
          aria-label="이미지 삽입"
        >
          {uploading ? '업로드 중…' : '▧ 이미지'}
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="공지 내용을 입력하세요"
        onInput={emitChange}
        onPaste={(event) => void handlePaste(event)}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        className="notice-rich-editor min-h-[320px] px-4 py-3 text-[15px] leading-relaxed text-gray-800 outline-none"
      />
    </div>
  );
};
