export type AdminMenuCategory = {
  id: string;
  slug: string;
  sortOrder: number;
  nameCz: string;
  nameEn: string;
  iconKey: string;
  imageUrl: string | null;
  active: boolean;
};

export type AdminMenuItem = {
  id: string;
  categoryId: string;
  sortOrder: number;
  nameCz: string;
  nameEn: string;
  descCz: string | null;
  descEn: string | null;
  priceCents: number;
  allergenCodes: string | null;
  imageUrl: string | null;
  active: boolean;
};
