const Category = require("../models/categoryModel");
const {
    getIconSvg,
    normalizeName,
    sortCategoriesForNav,
    createSlug
} = require("../utils/categoryIcons");

/**
 * Load the storefront category rail.
 *
 * Categories come straight from MongoDB and only listed (status: true)
 * categories are exposed, so admin list/unlist actions are reflected on the
 * storefront on the next page load.
 */
const buildCategoryNav = async () => {
    const categories = await Category.find({ status: true })
        .select("name slug icon")
        .lean();

    return sortCategoriesForNav(categories).map((category) => ({
        id: String(category._id),
        name: category.name,
        slug: category.slug || createSlug(category.name),
        href: `/products?category=${encodeURIComponent(category.slug || createSlug(category.name))}`,
        icon: getIconSvg(category.name, category.icon)
    }));
};

const resolveActiveCategory = (items, rawValue) => {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) return "";

    const normalized = normalizeName(value);
    const match = items.find((item) =>
        item.id === value ||
        item.slug.toLowerCase() === normalized ||
        normalizeName(item.name) === normalized
    );

    return match ? match.slug : "";
};

/**
 * Makes `categoryNav` available to every storefront view through res.locals.
 * Failures never take a page down: the rail simply renders empty.
 */
const loadCategoryNav = async (req, res, next) => {
    const isStorefrontGet = req.method === "GET" && !req.path.startsWith("/admin");

    if (!isStorefrontGet) return next();

    try {
        const items = await buildCategoryNav();
        res.locals.categoryNav = items;
        res.locals.activeCategorySlug = resolveActiveCategory(items, req.query.category);
    } catch (error) {
        console.error("Category navigation could not be loaded:", error.message);
        res.locals.categoryNav = [];
        res.locals.activeCategorySlug = "";
    }

    return next();
};

module.exports = {
    buildCategoryNav,
    loadCategoryNav
};
