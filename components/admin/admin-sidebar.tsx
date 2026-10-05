"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin", label: "Channels", icon: "▶" },
  { href: "/admin/meetings", label: "Meetings", icon: "◷" },
  { href: "/admin/library", label: "Library", icon: "▤" },
];

const inbox = [
  { href: "/admin/contacts", label: "Contact & prayer", icon: "✉" },
  { href: "/admin/link-requests", label: "Link requests", icon: "↗" },
];

function NavItems({ items }: { items: typeof sections }) {
  const pathname = usePathname();
  return items.map((item) => {
    const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link className={active ? "admin-sidebar-link active" : "admin-sidebar-link"} href={item.href} key={item.href} aria-current={active ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>;
  });
}

export default function AdminSidebar() {
  return <aside className="admin-sidebar">
    <Link href="/admin" className="admin-sidebar-brand"><span>FAITH OF THE</span><strong>PIONEERS</strong></Link>
    <nav aria-label="Admin navigation"><p>Workspace</p><NavItems items={sections}/><p>Inbox</p><NavItems items={inbox}/></nav>
    <Link className="admin-sidebar-public" href="/" target="_blank">View public site <span aria-hidden="true">↗</span></Link>
  </aside>;
}
