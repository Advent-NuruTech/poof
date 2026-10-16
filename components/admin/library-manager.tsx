"use client";

import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";
import RichTextEditor from "@/components/admin/rich-text-editor";
import { sanitizeRichText } from "@/lib/rich-text";

export default function LibraryManager() {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingDocument, setEditingDocument] = useState<LibraryDocument | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const seededDefaults = useRef(false);

  async function refreshPublicLibrary() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/admin/catalog/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }

  useEffect(() => {
    let active = true;
    void getDocs(collection(db, "libraryCategories")).then((snapshot) => {
      if (!active) return;
      const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryCategory);
      setCategories(rows); setCategoryId((current) => current || rows[0]?.id || ""); setParentId((current) => current || rows.find((item) => !item.parentId)?.id || "");
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load library categories."); });
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
    return () => { active = false; stopAuth(); };
  }, []);
  useEffect(() => { let active = true; void getDocs(query(collection(db, "libraryDocuments"), orderBy("updatedAt", "desc"), limit(200))).then((snapshot) => { if (active) setDocuments(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryDocument).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load library documents."); }); return () => { active = false; }; }, []);

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    try {
      const row = await addDoc(collection(db, "libraryCategories"), { name, parentId: parentId || null });
      await refreshPublicLibrary();
      setCategoryId(row.id); setNewCategory(""); setNotice(`“${name}” is ready to use.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add category."); }
  }

  function startEditing(item: LibraryDocument) {
    setEditingDocument(item);
    setError("");
    setNotice("");
    setTitle(item.title);
    setDescription(item.description ?? "");
    setCategoryId(item.categoryId);
    if (editor.current) editor.current.innerHTML = item.kind === "note" ? sanitizeRichText(item.contentHtml ?? "") : "";
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingDocument(null);
    setTitle("");
    setDescription("");
    if (editor.current) editor.current.innerHTML = "";
    setError("");
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const contentHtml = sanitizeRichText(editor.current?.innerHTML ?? "");
    if (!title.trim() || !categoryId || (editingDocument?.kind === "note" || !editingDocument) && !contentHtml.trim()) { setError("Add a title, category, and note content."); return; }
    const selected = categories.find((item) => item.id === categoryId);
    setBusy(true); setError(""); setNotice("");
    try {
      const updatedAt = new Date().toISOString();
      const note = { title: title.trim(), description: description.trim(), categoryId, categoryName: selected?.name ?? "Library", kind: "note" as const, contentHtml, updatedAt };
      if (editingDocument) {
        const changes = editingDocument.kind === "note" ? note : { title: title.trim(), description: description.trim(), categoryId, categoryName: selected?.name ?? "Library", updatedAt };
        await updateDoc(doc(db, "libraryDocuments", editingDocument.id), changes);
        setEditingDocument(null);
        setNotice("Library resource changes saved.");
      } else {
        await addDoc(collection(db, "libraryDocuments"), { ...note, createdAt: updatedAt });
        setNotice("Note published to the library.");
      }
      await refreshPublicLibrary();
      setTitle(""); setDescription(""); if (editor.current) editor.current.innerHTML = "";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save note."); }
    finally { setBusy(false); }
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const kind = extension === "pdf" ? "pdf" : ["doc", "docx", "ppt", "pptx"].includes(extension ?? "") ? "doc" : null;
    if (!kind) { setError("Choose a PDF, Word, or PowerPoint file."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Files must be 25 MB or smaller."); return; }
    if (!title.trim() || !categoryId) { setError("Add a title and choose a category before uploading."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to upload library files.");
      const response = await fetch("/api/library/upload", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }) });
      const result = await response.json() as { uploadUrl?: string; secureUrl?: string; error?: string };
      if (!response.ok || !result.uploadUrl || !result.secureUrl) throw new Error(result.error ?? "Upload failed.");
      const stored = await fetch(result.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!stored.ok) throw new Error("The file could not be stored. Please try again.");
      const selected = categories.find((item) => item.id === categoryId);
      await addDoc(collection(db, "libraryDocuments"), { title: title.trim(), description: description.trim(), categoryId, categoryName: selected?.name ?? "Library", kind, fileUrl: result.secureUrl, fileName: file.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await refreshPublicLibrary();
      setTitle(""); setDescription(""); setNotice("File uploaded and published.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload file."); }
    finally { setBusy(false); }
  }

  return <main className="admin-content library-admin">
    <header className="admin-heading"><div><span className="eyebrow">PUBLIC READING ROOM</span><h1>Library</h1><p>Publish study notes and downloadable reading materials.</p></div><Link className="outline-button" href="/library">View library</Link></header>
    {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
    <section className="admin-panel"><h2>Categories</h2><p className="library-help">Health and Other Studies are the two main categories. Add topics under either one; new topics remain available for later uploads.</p>
      <form className="library-category-form" onSubmit={addCategory}><input aria-label="Category name" placeholder="New topic, e.g. Diabetes treatment plan" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required/><select aria-label="Parent category" value={parentId} onChange={(e) => setParentId(e.target.value)} required>{categories.filter((item) => !item.parentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button">Add category</button></form>
      <div className="library-category-chips">{categories.map((item) => <span key={item.id}>{item.parentId ? `${categories.find((parent) => parent.id === item.parentId)?.name ?? "Library"} / ` : ""}{item.name}</span>)}</div>
    </section>
    <section className="admin-panel"><h2>{editingDocument ? "Edit library note" : "Publish to the library"}</h2><form className="library-publish-form" onSubmit={saveNote}>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this resource a title" required/></label>
      <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional summary"/></label>
      {(!editingDocument || editingDocument.kind === "note") && <><div className="library-editor-label"><strong>Write a note</strong><span>Paste formatted text from Word or Google Docs. Bold, headings, links, lists, and inline styling are retained.</span></div>
      <RichTextEditor ref={editor} label="Note content" placeholder="Start writing or paste formatted text here…"/></>}
      {editingDocument?.kind !== "doc" && editingDocument?.kind !== "pdf" && <div className="library-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : editingDocument ? "Save changes" : "Publish note"}</button>{editingDocument && <button className="outline-button" type="button" disabled={busy} onClick={cancelEditing}>Cancel edit</button>}</div>}
      {(editingDocument?.kind === "doc" || editingDocument?.kind === "pdf") && <p className="library-help">File contents cannot be replaced here. You can edit the title, description, and category for this resource.</p>}
      {editingDocument?.kind === "doc" || editingDocument?.kind === "pdf" ? <div className="library-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button className="outline-button" type="button" disabled={busy} onClick={cancelEditing}>Cancel edit</button></div> : null}
    </form>{!editingDocument && <div className="library-upload"><div><strong>Or upload a document</strong><span>PDF, Word, and PowerPoint files, up to 25 MB. Readers can preview and download them.</span></div><label className="outline-button">{busy ? "Uploading…" : "Choose file"}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={busy} onChange={(e) => void uploadFile(e.target.files?.[0])}/></label></div>}</section>
    <section className="admin-panel"><h2>Published resources <small>({documents.length})</small></h2>{documents.length ? <div className="library-admin-list">{documents.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.categoryName} · {item.kind === "note" ? "Note" : item.kind.toUpperCase()}</span></div><Link className="outline-button" href={`/library/${encodeURIComponent(item.id)}`}>Preview</Link><button className="outline-button" onClick={() => startEditing(item)}>Edit</button><button className="icon-action remove-action" aria-label={`Delete ${item.title}`} onClick={() => void deleteDoc(doc(db, "libraryDocuments", item.id)).then(async () => { setDocuments((items) => items.filter((entry) => entry.id !== item.id)); await refreshPublicLibrary(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete library resource."))}>×</button></article>)}</div> : <p className="library-help">Your published resources will appear here.</p>}</section>
  </main>;
}
