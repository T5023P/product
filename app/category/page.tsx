import { Suspense } from "react";
import CategoryClient from "./[id]/CategoryClient";

export default function CategoryEntryPage() {
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
