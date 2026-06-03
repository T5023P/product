import EditClient from "./EditClient";
import AdminLayout from "../../(admin)/layout";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EditPage() {
  return (
    <AdminLayout>
      <EditClient />
    </AdminLayout>
  );
}
