export const buildDescriptiveAddress = (address: string): string => {
  if (!address || !address.trim()) return "";
  if (address.includes("جاري تحديد العنوان")) return "";

  const parts = address
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "";

  const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
  const cleanParts = parts.filter((part) => !plusCodeRegex.test(part));

  if (cleanParts.length === 0) return "";

  const isGovernorate = (value: string) => value.includes("محافظة");
  const isCountry = (value: string) => value === "العراق";

  const filteredParts = cleanParts.filter(
    (part) => !isCountry(part) && !isGovernorate(part),
  );

  if (filteredParts.length === 0) return cleanParts[0] || "";

  const cityCandidate = filteredParts[filteredParts.length - 1];
  const headParts = filteredParts
    .slice(0, -1)
    .filter((part) => part !== cityCandidate);
  const ordered = cityCandidate ? [...headParts, cityCandidate] : filteredParts;

  if (ordered.length >= 3) return ordered.slice(0, 3).join("، ");
  if (ordered.length === 2) return ordered.join("، ");
  return ordered[0];
};
