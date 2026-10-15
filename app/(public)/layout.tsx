import AdminAppAccessProvider from "@/components/app/admin-app-access-provider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <AdminAppAccessProvider>{children}</AdminAppAccessProvider>;
}
