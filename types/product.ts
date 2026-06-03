// types/product.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price?: number;
  imageUrls: string[];
  createdAt: string; // ISO date string or server timestamp representation
}
