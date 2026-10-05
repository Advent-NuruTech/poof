"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";

export default function LibraryManager() {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const seededDefaults = useRef(false);

  useEffect(() => {
    const stopSnapshot = onSnapshot(collection(db, "libraryCategories"), (snapshot) => {
      const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryCategory);
      setCategories(rows);
      setCategoryId((current) => current || rows[0]?.id || "");
      setParentId((current) => current || rows.find((item) => !item.parentId)?.id || "");
    }, (reason) => setError(reason.message));
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || seededDefaults.current) return;
      seededDefaults.current = true;
      try {
        const existing = await getDocs(collection(db, "libraryCategories"));
        if (!existing.empty) {
          const legacyOtherStudies = existing.docs.find((item) => item.id === "bible-studies");
          if (legacyOtherStudies && !existing.docs.some((item) => item.id === "other-studies")) {
            await updateDoc(doc(db, "libraryCategories", "bible-studies"), { name: "Other Studies" });
          }
          return;
        }
        await Promise.all([
          setDoc(doc(db, "libraryCategories", "health"), { name: "Health", parentId: null }),
          setDoc(doc(db, "libraryCategories", "other-studies"), { name: "Other Studies", parentId: null }),
        ]);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not initialize library categories."); }
    });
    return () => { stopSnapshot(); stopAuth(); };
  }, []);
  useEffect(() => onSnapshot(collection(db, "libraryDocuments"), (snapshot) => {
    setDocuments(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryDocument).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
  }, (reason) => setError(reason.message)), []);

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    try {
      const row = await addDoc(collection(db, "libraryCategories"), { name, parentId: parentId || null });
      setCategoryId(row.id); setNewCategory(""); setNotice(`“${name}” is ready to use.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add category."); }
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const contentHtml = editor.current?.innerHTML ?? "";
    if (!title.trim() || !categoryId || !contentHtml.trim()) { setError("Add a title, category, and note content."); return; }
    const selected = categories.find((item) => item.id === categoryId);
    setBusy(true); setError("");
    try {
      await addDoc(collection(db, "libraryDocuments"), { title: title.trim(), description: description.trim(), categoryId, categoryName: selected?.name ?? "Library", kind: "note", contentHtml, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setTitle(""); setDescription(""); if (editor.current) editor.current.innerHTML = ""; setNotice("Note published to the library.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save note."); }
    finally { setBusy(false); }
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    const kind = file.type === "application/pdf" ? "pdf" : /\.docx?$/i.test(file.name) ? "doc" : null;
    if (!kind) { setError("Choose a PDF, DOC, or DOCX file."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Files must be 25 MB or smaller."); return; }
    if (!title.trim() || !categoryId) { setError("Add a title and choose a category before uploading."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to upload library files.");
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/library/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json() as { secureUrl?: string; error?: string };
      if (!response.ok || !result.secureUrl) throw new Error(result.error ?? "Upload failed.");
      const selected = categories.find((item) => item.id === categoryId);
      await addDoc(collection(db, "libraryDocuments"), { title: title.trim(), description: description.trim(), categoryId, categoryName: selected?.name ?? "Library", kind, fileUrl: result.secureUrl, fileName: file.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setTitle(""); setDescription(""); setNotice("File uploaded and published.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload file."); }
    finally { setBusy(false); }
  }

  return <main className="admin-content library-admin">
    <header className="admin-heading"><div><span className="eyebrow">PUBLIC READING ROOM</span><h1>Library</h1><p>Publish study notes and downloadable reading materials.</p></div><a className="outline-button" href="/library">View library</a></header>
    {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
    <section className="admin-panel"><h2>Categories</h2><p className="library-help">Health and Other Studies are the two main categories. Add topics under either one; new topics remain available for later uploads.</p>
      <form className="library-category-form" onSubmit={addCategory}><input aria-label="Category name" placeholder="New topic, e.g. Diabetes treatment plan" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required/><select aria-label="Parent category" value={parentId} onChange={(e) => setParentId(e.target.value)} required>{categories.filter((item) => !item.parentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button">Add category</button></form>
      <div className="library-category-chips">{categories.map((item) => <span key={item.id}>{item.parentId ? `${categories.find((parent) => parent.id === item.parentId)?.name ?? "Library"} / ` : ""}{item.name}</span>)}</div>
    </section>
    <section className="admin-panel"><h2>Publish to the library</h2><form className="library-publish-form" onSubmit={saveNote}>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this resource a title" required/></label>
      <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional summary"/></label>
      <div className="library-editor-label"><strong>Write a note</strong><span>Paste formatted text from Word or Google Docs. Bold, headings, links, lists, and inline styling are retained.</span></div>
      <div className="rich-toolbar" role="toolbar" aria-label="Note formatting"><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand("bold")}><b>B</b></button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand("italic")}><i>I</i></button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand("underline")}><u>U</u></button><select aria-label="Text style" defaultValue="p" onMouseDown={(e) => e.preventDefault()} onChange={(e) => { editor.current?.focus(); document.execCommand("formatBlock", false, e.target.value); }}><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand("insertUnorderedList")}>• List</button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand("insertOrderedList")}>1. List</button></div>
      <div ref={editor} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note content" aria-multiline="true" data-placeholder="Start writing or paste formatted text here…"/>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Publish note"}</button>
    </form><div className="library-upload"><div><strong>Or upload a document</strong><span>PDF and Word files, up to 25 MB. Readers can preview and download them.</span></div><label className="outline-button">{busy ? "Uploading…" : "Choose file"}<input type="file" accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(e) => void uploadFile(e.target.files?.[0])}/></label></div></section>
    <section className="admin-panel"><h2>Published resources <small>({documents.length})</small></h2>{documents.length ? <div className="library-admin-list">{documents.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.categoryName} · {item.kind === "note" ? "Note" : item.kind.toUpperCase()}</span></div><a className="outline-button" href={`/library/${encodeURIComponent(item.id)}`}>Preview</a><button className="icon-action remove-action" aria-label={`Delete ${item.title}`} onClick={() => void deleteDoc(doc(db, "libraryDocuments", item.id))}>×</button></article>)}</div> : <p className="library-help">Your published resources will appear here.</p>}</section>
  </main>;
}
