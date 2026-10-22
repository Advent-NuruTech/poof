"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import InstallAppButton from "@/components/home/install-app-button";
import { auth } from "@/lib/firebase";
import { endAdminSession } from "@/lib/admin-session";

const sections = [
  { href: "/poof/admin", label: "Dashboard", icon: "⌂" },
  { href: "/poof/admin/channels", label: "Channels", icon: "▶" },
  { href: "/poof/admin/meetings", label: "Meetings", icon: "◷" },
  { href: "/poof/admin/testimonies", label: "Testimonies", icon: "?" },
  { href: "/poof/admin/library", label: "Library", icon: "▤" },
  { href: "/poof/admin/mailing", label: "Mailing", icon: "✉" },
  { href: "/poof/admin/donations", label: "Donations", icon: "$" },
  { href: "/poof/admin/administrators", label: "Administrators", icon: "+" },
];

const inbox = [
  { href: "/poof/admin/contacts", label: "Contact , Meeting & prayer", icon: "✉" },
  
];

function NavItems({ items, onNavigate }: { items: typeof sections; onNavigate: () => void }) {
  const pathname = usePathname();
  return items.map((item) => {
    const active = item.href === "/poof/admin" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link className={active ? "admin-sidebar-link active" : "admin-sidebar-link"} href={item.href} key={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>;
  });
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

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

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await endAdminSession();
      await signOut(auth);
      router.replace("/signin");
      router.refresh();
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : "Could not sign out.");
      setSigningOut(false);
    }
  }

  return <>
    <header className="admin-mobile-bar">
      <button className="admin-menu-button" type="button" aria-label={open ? "Close admin menu" : "Open admin menu"} aria-expanded={open} aria-controls="admin-sidebar" onClick={toggleSidebar}><span aria-hidden="true">{open ? "✕" : "☰"}</span></button>
      <span className="admin-mobile-bar-title">Admin menu</span>
    </header>
    {open && <div className="admin-sidebar-backdrop" aria-hidden="true" onClick={closeSidebar}/>}
    <aside id="admin-sidebar" className={open ? "admin-sidebar open" : "admin-sidebar"}>
      <button className="admin-sidebar-close" type="button" aria-label="Close admin menu" onClick={closeSidebar}><span aria-hidden="true">✕</span></button>
      <Link href="/poof/admin" className="admin-sidebar-brand" onClick={closeSidebar}><span>FAITH OF THE</span><strong>PIONEERS</strong></Link>
      <nav aria-label="Admin navigation"><p>Workspace</p><NavItems items={sections} onNavigate={closeSidebar}/><InstallAppButton variant="admin"/><p>Inbox</p><NavItems items={inbox} onNavigate={closeSidebar}/></nav>
      <div className="admin-sidebar-footer">
        <Link className="admin-sidebar-public" href="/" target="_blank">View public site <span aria-hidden="true">↗</span></Link>
        <button className="admin-sidebar-signout" type="button" disabled={signingOut} onClick={() => void handleSignOut()}><span aria-hidden="true">↪</span>{signingOut ? "Signing out…" : "Sign out"}</button>
        {signOutError && <p role="alert">{signOutError}</p>}
      </div>
    </aside>
  </>;
}
