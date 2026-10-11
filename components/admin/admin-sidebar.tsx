"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin", label: "Dashboard", icon: "⌂" },
  { href: "/admin/channels", label: "Channels", icon: "▶" },
  { href: "/admin/meetings", label: "Meetings", icon: "◷" },
  { href: "/admin/library", label: "Library", icon: "▤" },
  { href: "/admin/mailing", label: "Mailing", icon: "✉" },
];

const inbox = [
  { href: "/admin/contacts", label: "Contact & prayer", icon: "✉" },
  { href: "/admin/link-requests", label: "Link requests", icon: "↗" },
];

function NavItems({ items, onNavigate }: { items: typeof sections; onNavigate: () => void }) {
  const pathname = usePathname();
  return items.map((item) => {
    const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link className={active ? "admin-sidebar-link active" : "admin-sidebar-link"} href={item.href} key={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>;
  });
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();

  // Close the drawer automatically whenever the route changes. Deriving this
  // during render (instead of a setState effect) avoids cascading renders.
  if (open && openPath !== pathname) {
    setOpen(false);
    setOpenPath(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const closeSidebar = () => { setOpen(false); setOpenPath(null); };
  const toggleSidebar = () => {
    if (open) { setOpen(false); setOpenPath(null); return; }
    setOpen(true);
    setOpenPath(pathname);
  };

  return <>
    <header className="admin-mobile-bar">
      <button className="admin-menu-button" type="button" aria-label={open ? "Close admin menu" : "Open admin menu"} aria-expanded={open} aria-controls="admin-sidebar" onClick={toggleSidebar}><span aria-hidden="true">{open ? "✕" : "☰"}</span></button>
      <span className="admin-mobile-bar-title">Admin menu</span>
    </header>
    {open && <div className="admin-sidebar-backdrop" aria-hidden="true" onClick={closeSidebar}/>}
    <aside id="admin-sidebar" className={open ? "admin-sidebar open" : "admin-sidebar"}>
      <button className="admin-sidebar-close" type="button" aria-label="Close admin menu" onClick={closeSidebar}><span aria-hidden="true">✕</span></button>
      <Link href="/admin" className="admin-sidebar-brand" onClick={closeSidebar}><span>FAITH OF THE</span><strong>PIONEERS</strong></Link>
      <nav aria-label="Admin navigation"><p>Workspace</p><NavItems items={sections} onNavigate={closeSidebar}/><p>Inbox</p><NavItems items={inbox} onNavigate={closeSidebar}/></nav>
      <Link className="admin-sidebar-public" href="/" target="_blank">View public site <span aria-hidden="true">↗</span></Link>
    </aside>
  </>;
}
