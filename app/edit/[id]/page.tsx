import { Suspense } from "react";
import EditClient from "./EditClient";
import AdminLayout from "../../(admin)/layout";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <AdminLayout>
        <EditClient />
      </AdminLayout>
    </Suspense>
  );
}
