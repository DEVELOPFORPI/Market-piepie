import React from 'react';

type Part = { type: 'text' | 'image'; value: string };

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const STANDALONE_IMAGE_URL_RE =
  /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:\?\S*)?$/i;

const ALLOWED_TAGS = new Set([
  'DIV', 'P', 'BR', 'IMG', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'FONT', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN',
]);

function sanitizeNoticeHtml(html: string): string {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');

  for (const element of Array.from(documentNode.body.querySelectorAll('*'))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const allowed =
        (element.tagName === 'IMG' && ['src', 'alt'].includes(attribute.name)) ||
        (element.tagName === 'FONT' && attribute.name === 'size') ||
        (attribute.name === 'style' &&
          /^(text-align:\s*(left|center|right|justify);?\s*)+$/i.test(attribute.value));
      if (!allowed) element.removeAttribute(attribute.name);
    }

    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? '';
      if (!/^https:\/\//i.test(src)) {
        element.remove();
      } else {
        element.setAttribute('loading', 'lazy');
      }
    }
  }

  return documentNode.body.innerHTML;
}

function parseNoticeContent(content: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_MARKDOWN_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'image', value: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  if (!parts.length) return [{ type: 'text', value: content }];

  const expanded: Part[] = [];
  for (const part of parts) {
    if (part.type !== 'text') {
      expanded.push(part);
      continue;
    }
    const lines = part.value.split('\n');
    let textBuffer = '';
    const flushText = () => {
      if (textBuffer) {
        expanded.push({ type: 'text', value: textBuffer });
        textBuffer = '';
      }
    };
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      if (STANDALONE_IMAGE_URL_RE.test(trimmed)) {
        flushText();
        expanded.push({ type: 'image', value: trimmed });
        if (i < lines.length - 1) textBuffer += '\n';
      } else {
        textBuffer += (textBuffer && i > 0 ? '\n' : '') + line;
      }
    }
    flushText();
  }

  return expanded.length ? expanded : [{ type: 'text', value: content }];
}

type Props = {
  content: string;
  className?: string;
};

export const NoticeContent: React.FC<Props> = ({ content, className = '' }) => {
  const isRichHtml = /<(?:div|p|br|img|strong|b|i|em|u|s|font|h[1-3]|ul|ol|li)\b/i.test(content);
  if (isRichHtml) {
    return (
      <div
        className={`notice-rendered-content text-[15px] leading-relaxed text-gray-800 ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(content) }}
      />
    );
  }

  const parts = parseNoticeContent(content);

  return (
    <div className={`space-y-4 text-[15px] leading-relaxed text-gray-800 ${className}`}>
      {parts.map((part, index) =>
        part.type === 'image' ? (
          <img
            key={`img-${index}`}
            src={part.value}
            alt=""
            className="w-full rounded-xl border border-gray-100 object-cover"
          />
        ) : part.value.trim() ? (
          <div key={`text-${index}`} className="whitespace-pre-wrap">
            {part.value}
          </div>
        ) : null,
      )}
    </div>
  );
};

export function noticeImageMarkdown(url: string): string {
  return `\n\n![image](${url})\n\n`;
}
