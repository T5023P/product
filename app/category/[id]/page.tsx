
import CategoryClient from "./CategoryClient";

export async function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function CategoryPage() {
  return <CategoryClient />;
}
