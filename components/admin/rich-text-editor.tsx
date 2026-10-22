"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

type RichTextEditorProps = {
  label: string;
  placeholder: string;
  value?: string;
  maxTextLength?: number;
  allowImages?: boolean;
  manageInlineImages?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
  onChange?: (value: string) => void;
  className?: string;
};

const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(function RichTextEditor(
  { label, placeholder, value, maxTextLength, allowImages = false, manageInlineImages = false, onUploadImage, onChange, className = "" },
  forwardedRef,
) {
  const editor = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const savedSelection = useRef<Range | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
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

  function removeInlineImage(index: number) {
    const element = editor.current;
    const image = element?.querySelectorAll("img")[index];
    if (!element || !image) return;
    image.remove();
    savedSelection.current = null;
    updateContent(element);
  }

  const inlineImages = manageInlineImages ? [...sanitizeRichText(value ?? "").matchAll(/<img\s+src="([^"]*)"/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")) : [];

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

  async function uploadImage(file: File) {
    if (!onUploadImage) return;
    setImageUploadError("");
    setUploadingImage(true);
    try {
      const source = await onUploadImage(file);
      const image = document.createElement("img");
      image.src = source;
      image.alt = "";
      editor.current?.focus();
      const selection = window.getSelection();
      if (savedSelection.current) {
        selection?.removeAllRanges();
        selection?.addRange(savedSelection.current);
      }
      if (selection?.rangeCount) {
        selection.getRangeAt(0).insertNode(image);
        selection.getRangeAt(0).setStartAfter(image);
        selection.getRangeAt(0).collapse(true);
      } else {
        editor.current?.append(image);
      }
      if (editor.current) updateContent(editor.current);
    } catch (reason) {
      setImageUploadError(reason instanceof Error ? reason.message : "The image could not be uploaded.");
    } finally {
      setUploadingImage(false);
      if (imageInput.current) imageInput.current.value = "";
    }
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
      {allowImages && <button type="button" aria-label="Insert image from URL" title="Insert image from an HTTPS URL" onMouseDown={(event) => event.preventDefault()} onClick={insertImage}>Image URL</button>}
      {onUploadImage && <>
        <button type="button" aria-label="Upload image" title="Upload an image file" disabled={uploadingImage} onMouseDown={(event) => { rememberSelection(); event.preventDefault(); }} onClick={() => imageInput.current?.click()}>{uploadingImage ? "Uploading…" : "Upload image"}</button>
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void uploadImage(file);
        }}/>
      </>}
    </div>
    {imageUploadError && <p role="alert" className="notice error-notice">{imageUploadError}</p>}
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
    {manageInlineImages && <div className="rich-inline-images">
      <p>To remove an image from the testimony, select Remove under its preview, then save your changes.</p>
      {inlineImages.length > 0 && <div className="rich-inline-image-list">{inlineImages.map((src, index) => <div key={`${src}-${index}`}>
        <img src={src} alt={`Inline image ${index + 1} preview`}/>
        <button type="button" aria-label={`Remove inline image ${index + 1}`} onClick={() => removeInlineImage(index)}>Remove</button>
      </div>)}</div>}
    </div>}
  </>;
});

export default RichTextEditor;
