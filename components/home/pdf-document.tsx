"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

export function PdfCover({ fileUrl, title, previewUrl }: { fileUrl: string; title: string; previewUrl?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || (previewUrl && !imageFailed)) return;
    let active = true;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    let render: ReturnType<PDFPageProxy["render"]> | undefined;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ url: `/api/library/download?url=${encodeURIComponent(fileUrl)}`, disableAutoFetch: true, disableStream: true });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        if (!active || !canvas.current) return;
        const viewport = page.getViewport({ scale: 400 / page.getViewport({ scale: 1 }).width });
        const context = canvas.current.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        render = page.render({ canvas: canvas.current, canvasContext: context, viewport });
        await render.promise;
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; render?.cancel(); if (task) void task.destroy(); };
  }, [fileUrl, visible, previewUrl, imageFailed]);
  return <div ref={container} className="pdf-cover">{previewUrl && !imageFailed ? <img src={previewUrl} alt={`${title}, page 1`} loading="lazy" onError={() => setImageFailed(true)} /> : failed ? <span>PDF document</span> : <canvas ref={canvas} role="img" aria-label={`${title}, page 1`} />}</div>;
}

function PdfPage({ document, pageNumber, width, zoom }: { document: PDFDocumentProxy; pageNumber: number; width: number; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | undefined;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current || !width) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width * zoom / 100 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      return renderTask.promise;
    }).catch(() => undefined);
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [document, pageNumber, width, zoom]);
  return <canvas ref={canvasRef} className="pdf-reader-page" aria-label={`Page ${pageNumber}`} />;
}

export default function PdfDocument({ fileUrl, fileName, zoom }: { fileUrl: string; fileName: string; zoom: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(0, element.clientWidth - 24)));
    observer.observe(element);
    setWidth(Math.max(0, element.clientWidth - 24));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let loadingTask: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({ url: `/api/library/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`, disableAutoFetch: true, disableStream: true });
        const loaded = await loadingTask.promise;
        if (active) setDocument(loaded);
        else await loadingTask?.destroy();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not display this document.");
      }
    })();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [fileUrl, fileName]);
  return <div className="pdf-reader-frame" ref={frame}>
    {error ? <p className="pdf-reader-message" role="alert">{error}</p> : !document ? <p className="pdf-reader-message" role="status">Loading document…</p> : <>
      <nav className="pdf-reader-navigation" aria-label="PDF pages">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <label>Page <input type="number" min={1} max={document.numPages} value={page} onChange={(event) => { const value = Number(event.target.value); if (value >= 1 && value <= document.numPages) setPage(value); }} /> of {document.numPages}</label>
        <button type="button" disabled={page >= document.numPages} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
      <PdfPage document={document} pageNumber={page} width={width} zoom={zoom} />
    </>}
  </div>;
}
