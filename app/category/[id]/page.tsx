import { Suspense } from "react";
import CategoryClient from "./CategoryClient";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background-app flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <CategoryClient />
    </Suspense>
  );
}
