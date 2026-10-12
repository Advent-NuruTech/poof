"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

type RichTextEditorProps = {
  label: string;
  placeholder: string;
  value?: string;
  maxTextLength?: number;
  allowImages?: boolean;
  onChange?: (value: string) => void;
  className?: string;
};

const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(function RichTextEditor(
  { label, placeholder, value, maxTextLength, allowImages = false, onChange, className = "" },
  forwardedRef,
) {
  const editor = useRef<HTMLDivElement>(null);
  const savedSelection = useRef<Range | null>(null);
  useImperativeHandle(forwardedRef, () => editor.current!, []);

  useEffect(() => {
    if (!editor.current || value === undefined) return;
    const safeValue = sanitizeRichText(value);
    if (editor.current.innerHTML !== safeValue) editor.current.innerHTML = safeValue;
  }, [value]);

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount) savedSelection.current = selection.getRangeAt(0).cloneRange();
  }

  function runCommand(command: string, argument?: string) {
    editor.current?.focus();
    if (command === "foreColor" && savedSelection.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection.current);
    }
    document.execCommand(command, false, argument);
  }

  function updateContent(element: HTMLDivElement) {
    const safeValue = sanitizeRichText(element.innerHTML);
    if (safeValue !== element.innerHTML) element.innerHTML = safeValue;
    if (maxTextLength !== undefined && (element.textContent?.length ?? 0) > maxTextLength) {
      element.innerHTML = sanitizeRichText(value ?? "");
      return;
    }
    onChange?.(safeValue);
  }

  function pasteFormattedContent(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboardHtml = event.clipboardData.getData("text/html");
    const clipboardText = event.clipboardData.getData("text/plain");
    const html = clipboardHtml
      ? sanitizeRichText(clipboardHtml)
      : clipboardText.replace(/[&<>"]/g, (character) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
        })[character] ?? character).replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, html);
    if (editor.current) updateContent(editor.current);
  }

  function insertImage() {
    const source = window.prompt("Paste an image URL (HTTPS):")?.trim();
    if (!source) return;
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      window.alert("Enter a valid HTTPS image URL.");
      return;
    }
    if (url.protocol !== "https:") {
      window.alert("Image links must use HTTPS.");
      return;
    }
    editor.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${url.toString()}" alt="">`);
    if (editor.current) updateContent(editor.current);
  }

  return <>
    <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}><b>B</b></button>
      <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}><i>I</i></button>
      <button type="button" title="Underline" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}><u>U</u></button>
      <select aria-label="Text style" defaultValue="p" onMouseDown={(event) => event.preventDefault()} onChange={(event) => runCommand("formatBlock", event.target.value)}>
        <option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option>
      </select>
      <select aria-label="Font family" defaultValue="Times New Roman" onMouseDown={(event) => event.preventDefault()} onChange={(event) => runCommand("fontName", event.target.value)}>
        <option value="Times New Roman">Times New Roman</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option>
      </select>
      <label className="rich-color-control" title="Text color">
        <span aria-hidden="true">A</span>
        <input type="color" aria-label="Text color" defaultValue="#000000" onMouseDown={rememberSelection} onChange={(event) => runCommand("foreColor", event.target.value)}/>
      </label>
      <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>• List</button>
      <button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertOrderedList")}>1. List</button>
      {allowImages && <button type="button" aria-label="Insert image" title="Insert image from an HTTPS URL" onMouseDown={(event) => event.preventDefault()} onClick={insertImage}>Image</button>}
    </div>
    <div
      ref={editor}
      className={`rich-editor ${className}`.trim()}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={(event) => updateContent(event.currentTarget)}
      onPaste={pasteFormattedContent}
    />
  </>;
});

export default RichTextEditor;
