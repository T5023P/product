import ProductClient from "./ProductClient";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function ProductPage() {
  return <ProductClient />;
}
