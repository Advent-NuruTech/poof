"use client";
import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { readApiResponse } from "@/lib/api-response";
import { richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import type { Testimony } from "@/lib/testimonies";
import RichTextEditor from "@/components/admin/rich-text-editor";

const blank = { title: "", name: "", content: "", profileUrl: "", beforeImages: [] as string[], afterImages: [] as string[] };
export default function TestimoniesManager() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Testimony[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  async function reload() { const snapshot = await getDocs(query(collection(db, "testimonies"), orderBy("createdAt", "desc"))); setItems(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Testimony)); }
  useEffect(() => { if (!user) return; let active = true; void getDocs(query(collection(db, "testimonies"), orderBy("createdAt", "desc"))).then((snapshot) => { if (active) setItems(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Testimony)); }).catch(() => { if (active) setError("Could not load testimonies."); }); return () => { active = false; }; }, [user]);
  async function upload(file: File) {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Sign in again to upload an image.");
    const body = new FormData(); body.set("file", file);
    const response = await fetch("/api/meetings/poster", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    const result = await readApiResponse<{ secureUrl?: string }>(response, "Image upload");
    if (!result.secureUrl) throw new Error("Image upload did not return a URL.");
    return result.secureUrl;
  }
  async function uploadField(file: File | undefined, field: "profileUrl" | "beforeImages" | "afterImages") {
    if (!file) return;
    setBusy(true); setError("");
    try { const url = await upload(file); setForm((current) => field === "profileUrl" ? { ...current, profileUrl: url } : { ...current, [field]: [...current[field], url] }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload image."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const content = sanitizeRichText(form.content);
    if (!form.title.trim() || !form.name.trim() || !richTextToPlainText(content)) { setError("Enter a title, testimony, and name."); return; }
    if ((content.match(/<img\b/gi)?.length ?? 0) + form.beforeImages.length + form.afterImages.length > 15) { setError("Too many testimony images. Please remove some images before saving."); return; }
    setBusy(true);
    try {
      const data = { ...form, title: form.title.trim(), name: form.name.trim(), content };
      if (editing) await updateDoc(doc(db, "testimonies", editing), data);
      else await addDoc(collection(db, "testimonies"), { ...data, createdAt: new Date().toISOString() });
      setForm(blank); setEditing(null); setNotice("Testimony saved."); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save testimony."); }
    finally { setBusy(false); }
  }
  async function remove(item: Testimony) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setBusy(true); setError("");
    try { await deleteDoc(doc(db, "testimonies", item.id)); if (editing === item.id) { setEditing(null); setForm(blank); } await reload(); setNotice("Testimony deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete testimony."); } finally { setBusy(false); }
  }
  return <main className="admin-shell"><div className="admin-content"><div className="admin-heading"><span className="eyebrow">STORIES OF FAITH</span><h1>Testimonies</h1><p>Share and manage testimonies from the community.</p></div>
    <section className="admin-panel"><h2>{editing ? "Edit testimony" : "Add a testimony"}</h2>{error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      <form className="library-publish-form" onSubmit={(event) => void save(event)}>
        <label>Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
        <label>Name of person giving the testimony<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
        <label>Profile picture<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={(event) => { void uploadField(event.target.files?.[0], "profileUrl"); event.target.value = ""; }}/></label>
        {form.profileUrl && <div className="testimony-admin-images"><img src={form.profileUrl} alt="Profile preview"/><button className="outline-button" type="button" onClick={() => setForm({ ...form, profileUrl: "" })}>Remove profile picture</button></div>}
        {(["beforeImages", "afterImages"] as const).slice(0, 1).map((field) => <div key={field}><label className="testimony-upload-label">Images before content<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={(event) => { void uploadField(event.target.files?.[0], field); event.target.value = ""; }}/></label><div className="testimony-admin-images">{form[field].map((url, index) => <div key={`${url}-${index}`}><img src={url} alt="Uploaded preview"/><button type="button" onClick={() => setForm({ ...form, [field]: form[field].filter((_, i) => i !== index) })}>Remove</button></div>)}</div></div>)}
        <div className="library-editor-label"><strong>Testimony content</strong></div><RichTextEditor label="Testimony content" placeholder="Write the testimony…" value={form.content} onChange={(content) => setForm((current) => ({ ...current, content }))} onUploadImage={async (file) => { setBusy(true); try { return await upload(file); } finally { setBusy(false); } }} allowImages manageInlineImages/>
        <div><label className="testimony-upload-label">Images after content<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy} onChange={(event) => { void uploadField(event.target.files?.[0], "afterImages"); event.target.value = ""; }}/></label><div className="testimony-admin-images">{form.afterImages.map((url, index) => <div key={`${url}-${index}`}><img src={url} alt="Uploaded preview"/><button type="button" onClick={() => setForm({ ...form, afterImages: form.afterImages.filter((_, i) => i !== index) })}>Remove</button></div>)}</div></div>
        <div><button className="primary-button" disabled={busy || !user} type="submit">{editing ? "Save changes" : "Publish testimony"}</button>{editing && <button className="outline-button" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}</div>
      </form></section>
    <section className="admin-panel"><h2>Published testimonies</h2><div className="library-admin-list">{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.name}</span></div><button className="outline-button" type="button" onClick={() => { setEditing(item.id); setForm({ title: item.title, name: item.name, content: item.content, profileUrl: item.profileUrl || "", beforeImages: item.beforeImages || [], afterImages: item.afterImages || [] }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="outline-button" type="button" disabled={busy} onClick={() => void remove(item)}>Delete</button></article>)}</div>{!items.length && <p>No testimonies yet.</p>}</section>
  </div></main>;
}
