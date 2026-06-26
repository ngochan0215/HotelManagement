const FALLBACK_VISUALS = {
  food: {
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80",
    label: "Ăn uống",
  },
  cultural: {
    image:
      "https://images.unsplash.com/photo-1539650116574-75c0c6d5bfe8?auto=format&fit=crop&w=1400&q=80",
    label: "Tham quan",
  },
  natural: {
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    label: "Thiên nhiên",
  },
  entertainment: {
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
    label: "Giải trí",
  },
  sport: {
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=80",
    label: "Vận động",
  },
  other: {
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80",
    label: "Khác",
  },
};

const ATTRACTION_IMAGE_BY_NAME = [
  {
    keywords: ["23/9 park", "23 9 park", "cong vien 23", "cong vien 23/9", "park 23/9"],
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80",
  },
  {
    keywords: ["sacred heart church", "nha tho duc ba", "notre dame cathedral", "church", "nha tho"],
    image:
      "https://images.unsplash.com/photo-1520106212299-d99c443e4568?auto=format&fit=crop&w=1400&q=80",
  },
  {
    keywords: ["mariamman hindu temple", "sri mariamman temple", "mariamman", "hindu temple", "temple", "chua"],
    image:
      "https://images.unsplash.com/photo-1524492449090-2d0f0b46bbdb?auto=format&fit=crop&w=1400&q=80",
  },
  {
    keywords: ["museum of fine arts", "bao tang my thuat", "museum", "gallery", "fine arts"],
    image:
      "https://images.unsplash.com/photo-1566127992631-137a642a90f4?auto=format&fit=crop&w=1400&q=80",
  },
  {
    keywords: ["mong bridge", "cau mong", "bridge", "cau"],
    image:
      "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1400&q=80",
  },
  {
    keywords: ["cafe", "coffee", "restaurant", "food", "eating"],
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=80",
  },
];

const CATEGORY_ALIASES = {
  food: "food",
  food_and_drink: "food",
  restaurant: "food",
  cafe: "food",
  culinary: "food",
  cultural: "cultural",
  culture: "cultural",
  sightseeing: "cultural",
  heritage: "cultural",
  natural: "natural",
  nature: "natural",
  park: "natural",
  entertainment: "entertainment",
  nightlife: "entertainment",
  leisure: "entertainment",
  sport: "sport",
  sports: "sport",
  other: "other",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getAttractionCategory(attraction = {}) {
  const raw = String(attraction.category || attraction.kind || attraction.type || "other")
    .trim()
    .toLowerCase();

  return CATEGORY_ALIASES[raw] || raw || "other";
}

function getNameBasedAttractionImage(attraction = {}) {
  const normalizedName = normalizeText(attraction.name);
  if (!normalizedName) return "";

  const matched = ATTRACTION_IMAGE_BY_NAME.find((entry) =>
    entry.keywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      return normalizedKeyword && normalizedName.includes(normalizedKeyword);
    }),
  );

  return matched?.image || "";
}

export function getAttractionImage(attraction = {}) {
  const candidates = [
    attraction.photo_url,
    attraction.image_url,
    attraction.image,
    attraction.thumbnail,
    attraction.cover_image,
    attraction.cover,
  ];

  const direct = candidates.find((value) => typeof value === "string" && value.trim());
  if (direct) return direct;

  const byName = getNameBasedAttractionImage(attraction);
  if (byName) return byName;

  const category = getAttractionCategory(attraction);
  return FALLBACK_VISUALS[category]?.image || FALLBACK_VISUALS.other.image;
}

export function getAttractionCategoryLabel(attraction = {}) {
  const category = getAttractionCategory(attraction);
  return FALLBACK_VISUALS[category]?.label || FALLBACK_VISUALS.other.label;
}

export function getAttractionVisual(attraction = {}) {
  const category = getAttractionCategory(attraction);
  return {
    category,
    categoryLabel: getAttractionCategoryLabel(attraction),
    image: getAttractionImage(attraction),
  };
}

export function getAttractionFallbackImage(category = "other") {
  return FALLBACK_VISUALS[CATEGORY_ALIASES[String(category || "other").trim().toLowerCase()] || category || "other"]?.image || FALLBACK_VISUALS.other.image;
}
