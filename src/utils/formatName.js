export const normalizeSpacing = (value = "") =>
  value.toString().replace(/\s+/g, " ").trim();

const toTitleCaseWord = (word) => {
  const lower = word.toLocaleLowerCase("es-AR");
  if (!lower) return "";
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
};

const formatToken = (token) =>
  normalizeSpacing(token)
    .split("-")
    .map((part) => toTitleCaseWord(part))
    .join("-");

export const formatPersonName = (firstName, lastName) => {
  const full = [firstName, lastName].filter(Boolean).join(" ");
  const cleaned = normalizeSpacing(full);
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((token) => formatToken(token))
    .join(" ");
};
