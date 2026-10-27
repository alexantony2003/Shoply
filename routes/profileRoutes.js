const express = require("express");

const router = express.Router();

const {
    getEditProfile,
    updateProfile,
    getAddressForm,
    saveAddress,
    deleteAddress
} = require("../controllers/profileController");
const { requireLogin } = require('../middlewares/authMiddleware');

router.use(requireLogin);

// Profile information
router.get("/edit", getEditProfile);

router.post("/edit", updateProfile);

router.get("/addresses/new", getAddressForm);
router.post("/addresses", saveAddress);
router.get("/addresses/:id/edit", getAddressForm);
router.post("/addresses/:id/edit", saveAddress);
router.post("/addresses/:id/delete", deleteAddress);


module.exports = router;