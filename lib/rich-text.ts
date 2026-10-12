const allowedTags = new Set([
  "a", "b", "blockquote", "br", "div", "em", "font", "h1", "h2", "h3", "h4", "img",
  "i", "li", "ol", "p", "span", "strong", "u", "ul",
]);
const allowedFonts = new Set(["Arial", "Georgia", "Times New Roman"]);

function escapeAttribute(value: string) {
  return value.replace(/[&"<>]/g, (character) => ({
    "&": "&amp;",
    '"': "&quot;",
    "<": "&lt;",
    ">": "&gt;",
  })[character] ?? character);
}

export function sanitizeRichText(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|form)\b[^>]*\/?>/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (whole, rawTag: string, attributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (whole.startsWith("</")) return `</${tag === "font" ? "span" : tag}>`;
      if (tag === "br") return "<br>";
      if (tag === "img") {
        const source = attributes.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean);
        const alt = attributes.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean) ?? "";
        if (!source) return "";
        try {
          const url = new URL(source);
          if (url.protocol !== "https:") return "";
          return `<img src="${escapeAttribute(url.toString())}" alt="${escapeAttribute(alt)}">`;
        } catch {
          return "";
        }
      }
      if (tag === "a") {
        const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean);
        if (!href) return "<a>";
        try {
          const url = new URL(href);
          if (url.protocol !== "https:" && url.protocol !== "mailto:") return "<a>";
          return `<a href="${escapeAttribute(url.toString())}" rel="noopener noreferrer">`;
        } catch {
          return "<a>";
        }
      }
      if (tag === "font") {
        const color = attributes.match(/\bcolor\s*=\s*(?:"(#[\da-f]{3,8})"|'(#[\da-f]{3,8})'|(#[\da-f]{3,8}))/i)?.slice(1).find(Boolean);
        const font = attributes.match(/\bface\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean);
        const safeFont = font && allowedFonts.has(font) ? font : "";
        const style = [color ? `color:${color}` : "", safeFont ? `font-family:${safeFont}` : ""].filter(Boolean).join(";");
        return style ? `<span style="${style}">` : "<span>";
      }
      if (tag === "span") {
        const style = attributes.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find(Boolean) ?? "";
        const color = style.match(/\bcolor\s*:\s*(#[\da-f]{3,8})/i)?.[1];
        const font = style.match(/\bfont-family\s*:\s*([^;]+)/i)?.[1]?.replace(/['"]/g, "").trim();
        const safeFont = font && allowedFonts.has(font) ? font : "";
        const safeStyle = [color ? `color:${color}` : "", safeFont ? `font-family:${safeFont}` : ""].filter(Boolean).join(";");
        return safeStyle ? `<span style="${safeStyle}">` : "<span>";
      }
      return `<${tag}>`;
    });
}

export function extractFeaturedVideoUrl(value: string) {
  const candidates = value.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s<>"']*|embed\/|shorts\/)|youtu\.be\/)[^\s<>"']+/gi) ?? [];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[),.;!?]+$/, "").replace(/&amp;/gi, "&");
    try {
      const url = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
      const host = url.hostname.toLowerCase();
      const id = host === "youtu.be"
        ? url.pathname.match(/^\/([\w-]{11})/)?.[1] ?? ""
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
          ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ?? ""
          : "";
      if (/^[\w-]{11}$/.test(id)) return url.toString();
    } catch {
      continue;
    }
  }
  return "";
}

export function personalizedGreeting(name: string | undefined, date = new Date()) {
  const hour = date.getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `${salutation} ${firstName},` : "Hello,";
}

export function inlineVideoLinks(value: string) {
  const preview = (value: string) => {
    const url = extractFeaturedVideoUrl(value);
    const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1];
    if (!id) return "";
    return `<a href="${escapeAttribute(url)}" rel="noopener noreferrer"><img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="Watch the video" width="560"></a>`;
  };
  const replaceUrl = (candidate: string) => {
    const punctuation = candidate.match(/[),.;!?]+$/)?.[0] ?? "";
    const url = candidate.slice(0, candidate.length - punctuation.length);
    const markup = preview(url);
    return markup ? `${markup}${escapeAttribute(punctuation)}` : candidate;
  };
  const linked = value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attributes: string) => {
    const href = attributes.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1];
    if (!href || /<img\b/i.test(whole)) return whole;
    return preview(href) || whole;
  });
  const videoUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s<>"']*|embed\/|shorts\/)|youtu\.be\/)[^\s<>"']+/gi;
  return linked.replace(/>([^<>]+)</g, (whole, text: string) =>
    `>${text.replace(videoUrlPattern, replaceUrl)}<`,
  );
}

export function richTextToPlainText(value: string) {
  return sanitizeRichText(value)
    .replace(/<(?:br|\/(?:p|div|h[1-4]|li|blockquote))\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function automaticPreviewText(value: string, maxLength = 180) {
  const text = richTextToPlainText(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
