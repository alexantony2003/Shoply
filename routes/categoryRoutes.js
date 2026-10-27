const express = require("express");

const router = express.Router();

const {
    getCategories,
    showAddCategory,
    createCategory,
    showEditCategory,
    updateCategory,
    unlistCategory,
    listCategory
} = require("../controllers/categoryController");


const { adminAuth } = require('../middlewares/authMiddleware');
router.use(adminAuth);

// All categories
router.get("/", getCategories);


// Add category page
router.get("/new", showAddCategory);


// Create category
router.post("/", createCategory);


// Edit category page
router.get("/:id/edit", showEditCategory);


// Update category
router.post("/:id/edit", updateCategory);


// Unlist category
router.get("/:id/unlist", unlistCategory);


// List category again
router.get("/:id/list", listCategory);


module.exports = router;