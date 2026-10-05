"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

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
      const pixelRatio = window.devicePixelRatio || 1;
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
        const response = await fetch(`/api/library/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`);
        if (!response.ok) throw new Error("Could not load this document.");
        const bytes = await response.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
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
    {error ? <p className="pdf-reader-message" role="alert">{error}</p> : !document ? <p className="pdf-reader-message" role="status">Loading document…</p> : Array.from({ length: document.numPages }, (_, index) => <PdfPage key={`${fileUrl}-${index + 1}`} document={document} pageNumber={index + 1} width={width} zoom={zoom} />)}
  </div>;
}
