import { Suspense } from "react";
import ProductClient from "./[id]/ProductClient";

export default function ProductEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background-app min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProductClient />
    </Suspense>
  );
}
