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
  fileName?: string;
  createdAt?: string;
  updatedAt?: string;
};
