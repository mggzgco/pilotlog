export const costCategoryValues = [
  "rental",
  "instruction",
  "fuel",
  "fees",
  "other"
] as const;

export const costCategoryOptions = costCategoryValues.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1)
}));

export const getCostCategoryLabel = (category: string) => {
  const normalized = category.trim().toLowerCase();
  const match = costCategoryOptions.find((option) => option.value === normalized);
  return match?.label ?? category;
};
