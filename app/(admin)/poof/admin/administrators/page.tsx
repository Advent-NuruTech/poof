import AdminInvites from "@/components/admin/admin-invites";

export default function AdminAdministratorsPage() {
  return (
    <main className="admin-shell admin-access-page">
      <div className="admin-content">
        <header className="admin-heading">
          <span className="eyebrow">WORKSPACE ACCESS</span>
          <h1>Administrators</h1>
          <p>Invite trusted people to help manage the Faith of the Pioneers workspace.</p>
        </header>
        <AdminInvites />
        <p className="admin-access-footnote">Only invite people who should have access to private administrative tools and content controls.</p>
      </div>
    </main>
  );
}
