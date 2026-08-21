import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkObsidianHighlight } from "./markdownPlugins";

export function LiveMarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const lines = useMemo(() => value.split("\n"), [value]);
  const [activeLine, setActiveLine] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const cursor = pendingCursor.current ?? textarea.value.length;
    textarea.setSelectionRange(cursor, cursor);
    pendingCursor.current = null;
    textarea.style.height = "0";
    textarea.style.height = `${Math.max(38, textarea.scrollHeight)}px`;
  }, [activeLine]);

  function updateLine(index: number, nextLine: string) {
    const next = [...lines];
    next[index] = nextLine;
    onChange(next.join("\n"));
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "0";
      textarea.style.height = `${Math.max(38, textarea.scrollHeight)}px`;
    });
  }

  function handleKeys(event: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (event.key === "Escape") event.currentTarget.blur();
    if (event.key === "Backspace" && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0 && index > 0) {
      event.preventDefault();
      const next = [...lines];
      const previous = next[index - 1];
      const current = next[index];
      next.splice(index - 1, 2, previous + current);
      pendingCursor.current = previous.length;
      onChange(next.join("\n"));
      setActiveLine(index - 1);
      return;
    }
    if (event.key === "Delete" && event.currentTarget.selectionStart === event.currentTarget.value.length && event.currentTarget.selectionEnd === event.currentTarget.value.length && index < lines.length - 1) {
      event.preventDefault();
      const next = [...lines];
      next.splice(index, 2, next[index] + next[index + 1]);
      onChange(next.join("\n"));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const position = event.currentTarget.selectionStart;
      const next = [...lines];
      next.splice(index, 1, event.currentTarget.value.slice(0, position), event.currentTarget.value.slice(position));
      onChange(next.join("\n"));
      setActiveLine(index + 1);
      return;
    }
    if (event.key === "ArrowUp" && event.currentTarget.selectionStart === 0 && index > 0) {
      event.preventDefault(); setActiveLine(index - 1);
    }
    if (event.key === "ArrowDown" && event.currentTarget.selectionEnd === event.currentTarget.value.length && index < lines.length - 1) {
      event.preventDefault(); setActiveLine(index + 1);
    }
  }

  return <div className="live-markdown-editor" role="textbox" aria-label="Редактор Markdown">
    {lines.map((line, index) => activeLine === index ?
      <textarea key={`edit-${index}`} ref={textareaRef} className="live-markdown-active-line" value={line} rows={1} spellCheck onChange={(event) => updateLine(index, event.target.value)} onKeyDown={(event) => handleKeys(event, index)} onBlur={() => setActiveLine(-1)}/> :
      <div key={`view-${index}`} className={`live-markdown-rendered-line${line ? "" : " empty"}`} role="button" tabIndex={0} onClick={() => setActiveLine(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveLine(index); } }}>
        {line ? <ReactMarkdown remarkPlugins={[remarkGfm, remarkObsidianHighlight]}>{/^>\s*$/.test(line) ? "> \u00a0" : line}</ReactMarkdown> : <span>&nbsp;</span>}
      </div>
    )}
  </div>;
}
