export type LibraryCategory = { id: string; name: string; parentId: string | null };
export type LibraryDocument = {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  kind: "note" | "pdf" | "doc";
  contentHtml?: string;
  fileUrl?: string;
  /** Listing-only image of the document's first page. Never used by the reader or the download route. */
  previewUrl?: string;
  fileName?: string;
  createdAt?: string;
  updatedAt?: string;
};
