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

function PdfPageCanvas({ document, pageNumber, width, zoom, onRatio }: { document: PDFDocumentProxy; pageNumber: number; width: number; zoom: number; onRatio: (ratio: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | undefined;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current || !width) return;
      const base = page.getViewport({ scale: 1 });
      onRatio(base.height / base.width);
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
  }, [document, pageNumber, width, zoom, onRatio]);
  return <canvas ref={canvasRef} className="pdf-reader-page" aria-label={`Page ${pageNumber}`} />;
}

function PdfPage({ document, pageNumber, width, zoom, defaultRatio, rootRef }: { document: PDFDocumentProxy; pageNumber: number; width: number; zoom: number; defaultRatio: number; rootRef: React.RefObject<HTMLDivElement | null> }) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    const element = placeholder.current;
    const root = rootRef.current;
    if (!element || !root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root, rootMargin: "1200px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootRef]);
  return <div ref={placeholder} className="pdf-reader-placeholder" style={{ width: width * zoom / 100, height: width * zoom / 100 * (ratio ?? defaultRatio) }}>
    {visible && width > 0 && <PdfPageCanvas key={`${width}-${zoom}`} document={document} pageNumber={pageNumber} width={width} zoom={zoom} onRatio={setRatio} />}
  </div>;
}

export default function PdfDocument({ fileUrl, fileName, zoom }: { fileUrl: string; fileName: string; zoom: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [defaultRatio, setDefaultRatio] = useState(1.414);
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
        const firstPage = await loaded.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        if (active) { setDefaultRatio(firstViewport.height / firstViewport.width); setDocument(loaded); }
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
    {error ? <p className="pdf-reader-message" role="alert">{error}</p> : !document ? <p className="pdf-reader-message" role="status">Loading document…</p> : Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} pageNumber={index + 1} width={width} zoom={zoom} defaultRatio={defaultRatio} rootRef={frame} />)}
  </div>;
}
