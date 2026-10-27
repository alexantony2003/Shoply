const Category = require("../models/categoryModel");
const Product = require("../models/productModel");
const {
    getIconOptions,
    getDefaultIconKey,
    getIconSvg,
    isValidIcon,
    createSlug
} = require("../utils/categoryIcons");

// Resolve the icon sent by the admin form. Only keys that exist in the icon
// registry are accepted, so a stored icon can never inject markup.
const resolveIcon = (name, requestedIcon) => {
    const icon = typeof requestedIcon === "string" ? requestedIcon.trim() : "";
    return isValidIcon(icon) ? icon : getDefaultIconKey(name);
};

// Value preselected in the admin icon picker ("" means "automatic").
const formIconValue = (value) => {
    const icon = typeof value === "string" ? value.trim() : "";
    return isValidIcon(icon) ? icon : "";
};

// Show categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });

        // Calculate stock for each category
        const categoriesWithStock = await Promise.all(
            categories.map(async (category) => {
                const result = await Product.aggregate([
                    {
                        $match: {
                            category: category._id,
                            status: "active"
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalStock: {
                                $sum: "$stock"
                            }
                        }
                    }
                ]);

                const stockAvailable = result.length > 0 ? result[0].totalStock : 0;

                return {
                    ...category.toObject(),
                    iconSvg: getIconSvg(category.name, category.icon),
                    stockAvailable
                };
            })
        );

        res.render("admin/categories", {
            categories: categoriesWithStock,
            error: req.query.error || null
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};

// Show add category page
const showAddCategory = (req, res) => {
    res.render("admin/category-form", {
        category: null,
        iconOptions: getIconOptions(),
        selectedIcon: "",
        error: req.query.error || null
    });
};

// Add category with proper validation and case-insensitive uniqueness check
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.render("admin/category-form", {
                category: null,
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category name is required."
            });
        }

        const categoryName = name.trim();

        if (categoryName.length < 2 || categoryName.length > 50) {
            return res.render("admin/category-form", {
                category: { name: categoryName },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category name must be between 2 and 50 characters."
            });
        }

        // Case-insensitive uniqueness check
        const escaped = categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${escaped}$`, "i") }
        });

        if (existingCategory) {
            return res.render("admin/category-form", {
                category: { name: categoryName },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: `A category named "${categoryName}" already exists. Category names must be unique.`
            });
        }

        const slug = createSlug(categoryName);

        await Category.create({
            name: categoryName,
            slug,
            icon: resolveIcon(categoryName, req.body.icon)
        });

        res.redirect("/admin/categories");

    } catch (error) {
        if (error.code === 11000) {
            return res.render("admin/category-form", {
                category: null,
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category already exists."
            });
        }
        res.status(500).send(error.message);
    }
};

// Show edit category page
const showEditCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).send("Category not found");
        }

        res.render("admin/category-form", {
            category,
            iconOptions: getIconOptions(),
            selectedIcon: formIconValue(category.icon),
            error: req.query.error || null
        });

    } catch (error) {
        res.status(500).send(error.message);
    }
};

// Update category with validation and case-insensitive uniqueness check
const updateCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.render("admin/category-form", {
                category: { _id: req.params.id, name: '' },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category name is required."
            });
        }

        const categoryName = name.trim();

        if (categoryName.length < 2 || categoryName.length > 50) {
            return res.render("admin/category-form", {
                category: { _id: req.params.id, name: categoryName },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category name must be between 2 and 50 characters."
            });
        }

        // Case-insensitive uniqueness check excluding the current category
        const escaped = categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const duplicateCategory = await Category.findOne({
            _id: { $ne: req.params.id },
            name: { $regex: new RegExp(`^${escaped}$`, "i") }
        });

        if (duplicateCategory) {
            return res.render("admin/category-form", {
                category: { _id: req.params.id, name: categoryName },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: `A category named "${categoryName}" already exists. Category names must be unique.`
            });
        }

        const slug = createSlug(categoryName);

        await Category.findByIdAndUpdate(
            req.params.id,
            {
                name: categoryName,
                slug,
                icon: resolveIcon(categoryName, req.body.icon)
            },
            {
                runValidators: true
            }
        );

        res.redirect("/admin/categories");

    } catch (error) {
        if (error.code === 11000) {
            return res.render("admin/category-form", {
                category: { _id: req.params.id, name: req.body.name },
                iconOptions: getIconOptions(),
                selectedIcon: formIconValue(req.body.icon),
                error: "Category already exists."
            });
        }
        res.status(500).send(error.message);
    }
};

// Unlist category
const unlistCategory = async (req, res) => {
    try {
        await Category.findByIdAndUpdate(
            req.params.id,
            {
                status: false
            }
        );

        res.redirect("/admin/categories");

    } catch (error) {
        res.status(500).send(error.message);
    }
};

// List category again
const listCategory = async (req, res) => {
    try {
        await Category.findByIdAndUpdate(
            req.params.id,
            {
                status: true
            }
        );

        res.redirect("/admin/categories");

    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    getCategories,
    showAddCategory,
    createCategory,
    showEditCategory,
    updateCategory,
    unlistCategory,
    listCategory
};