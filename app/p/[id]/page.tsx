import { Suspense } from "react";
import ProductClient from "./ProductClient";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function ProductPage() {
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
