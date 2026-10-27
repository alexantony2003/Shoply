/**
 * Category icon registry.
 *
 * The project does not ship an icon library (no Lucide/Font Awesome package),
 * so the Lucide icon geometry we need is vendored here as plain SVG markup.
 * This keeps the storefront dependency-free and allows the icons to be
 * rendered inline by EJS instead of relying on a CDN or client-side JavaScript.
 *
 * Icon geometry: Lucide Static v0.469.0 (ISC licence).
 */

const DEFAULT_ICON_KEY = "layout-grid";

// Inner SVG markup for every icon that may be stored on a Category document.
const ICON_PATHS = {
    shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />',
    refrigerator: '<path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" /><path d="M5 10h14" /><path d="M15 7v6" />',
    baby: '<path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />',
    "heart-pulse": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />',
    dumbbell: '<path d="M14.4 14.4 9.6 9.6" /><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" /><path d="m21.5 21.5-1.4-1.4" /><path d="M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />',
    armchair: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" /><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" /><path d="M5 18v2" /><path d="M19 18v2" />',
    "paw-print": '<circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />',
    bike: '<circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" />',
    watch: '<circle cx="12" cy="12" r="6" /><polyline points="12 10 12 12 13 13" /><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05" /><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05" />',
    "shopping-basket": '<path d="m15 11-1 9" /><path d="m19 11-4-7" /><path d="M2 11h20" /><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" /><path d="M4.5 15.5h15" /><path d="m5 11 4-7" /><path d="m9 11 1 9" />',
    "book-open": '<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
    laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />',
    house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" /><path d="m7.5 4.27 9 5.15" />',
    "layout-grid": '<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />'
};

// Friendly labels used by the admin category form icon picker.
const ICON_LABELS = {
    shirt: "Shirt",
    smartphone: "Smartphone",
    monitor: "Monitor",
    sparkles: "Sparkles",
    refrigerator: "Refrigerator",
    baby: "Baby",
    "heart-pulse": "Heart pulse",
    car: "Car",
    dumbbell: "Dumbbell",
    armchair: "Armchair",
    "paw-print": "Paw print",
    bike: "Bike",
    watch: "Watch",
    "shopping-basket": "Shopping basket",
    "book-open": "Book open",
    laptop: "Laptop",
    headphones: "Headphones",
    house: "House",
    gift: "Gift",
    package: "Package",
    "layout-grid": "Grid"
};

// Requested display order for the 15 storefront categories. Any extra
// category that exists in MongoDB is appended alphabetically afterwards.
const CATEGORY_ORDER = [
    "Fashion",
    "Mobiles",
    "Electronics",
    "Beauty & Personal Care",
    "Home Appliances",
    "Toys & Baby Care",
    "Food & Healthcare",
    "Auto Accessories",
    "Sports & Fitness",
    "Furniture",
    "Pet Store",
    "Bike & Scooters",
    "Smart Gadgets",
    "Grocery",
    "Books"
];

// Default icon for a category name, so a new/renamed category still looks right
// even when no explicit icon has been saved on the document.
const CATEGORY_ICON_BY_NAME = {
    "fashion": "shirt",
    "mobiles": "smartphone",
    "electronics": "monitor",
    "beauty & personal care": "sparkles",
    "home appliances": "refrigerator",
    "toys & baby care": "baby",
    "food & healthcare": "heart-pulse",
    "auto accessories": "car",
    "sports & fitness": "dumbbell",
    "furniture": "armchair",
    "pet store": "paw-print",
    "bike & scooters": "bike",
    "smart gadgets": "watch",
    "grocery": "shopping-basket",
    "books": "book-open",
    "laptop": "laptop",
    "iphone": "smartphone",
    "buds": "headphones",
    "home": "house",
    "appliances": "refrigerator"
};

const normalizeName = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

const isValidIcon = (key) => Object.prototype.hasOwnProperty.call(ICON_PATHS, String(key || ""));

const getDefaultIconKey = (name) => CATEGORY_ICON_BY_NAME[normalizeName(name)] || DEFAULT_ICON_KEY;

// Only registry keys ever reach the SVG string, so database values can never
// inject arbitrary markup into the page.
const resolveIconKey = (name, icon) => {
    if (isValidIcon(icon)) return icon;
    return getDefaultIconKey(name);
};

const getIconSvg = (name, icon) => {
    const key = resolveIconKey(name, icon);
    const paths = ICON_PATHS[key] || ICON_PATHS[DEFAULT_ICON_KEY];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${paths}</svg>`;
};

const getIconOptions = () => Object.keys(ICON_LABELS).map((key) => ({
    key,
    label: ICON_LABELS[key],
    svg: getIconSvg(ICON_LABELS[key], key)
}));

// Sort active categories into the requested storefront order.
const sortCategoriesForNav = (categories) => {
    const orderIndex = new Map(CATEGORY_ORDER.map((name, index) => [name.toLowerCase(), index]));
    return [...categories].sort((a, b) => {
        const aIndex = orderIndex.has(normalizeName(a.name)) ? orderIndex.get(normalizeName(a.name)) : Number.MAX_SAFE_INTEGER;
        const bIndex = orderIndex.has(normalizeName(b.name)) ? orderIndex.get(normalizeName(b.name)) : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" });
    });
};

// Mirrors the slug format already produced by categoryController so existing
// category URLs (for example "beauty-personal-care") keep working.
const createSlug = (name) => String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

module.exports = {
    DEFAULT_ICON_KEY,
    CATEGORY_ORDER,
    ICON_PATHS,
    ICON_LABELS,
    CATEGORY_ICON_BY_NAME,
    normalizeName,
    isValidIcon,
    getDefaultIconKey,
    resolveIconKey,
    getIconSvg,
    getIconOptions,
    sortCategoriesForNav,
    createSlug
};
