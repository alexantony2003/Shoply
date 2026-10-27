const User = require("../models/userModel");

const addressFields = body => ({
    label: String(body.label || "Home").trim(),
    fullName: String(body.fullName || "").trim(),
    phone: String(body.phone || "").trim(),
    street: String(body.street || "").trim(),
    city: String(body.city || "").trim(),
    state: String(body.state || "").trim(),
    postalCode: String(body.postalCode || "").trim(),
    country: String(body.country || "India").trim(),
    isDefault: body.isDefault === "true"
});

const isValidAddress = address => Object.entries(address)
    .filter(([key]) => key !== "isDefault")
    .every(([, value]) => value) &&
    address.label.length <= 40 &&
    address.fullName.length <= 100 &&
    address.phone.length <= 20 &&
    address.street.length <= 200 &&
    address.city.length <= 100 &&
    address.state.length <= 100 &&
    address.postalCode.length <= 20 &&
    address.country.length <= 100;

const requireProfileUser = (req, res) => {
    if (req.session && req.session.user && req.session.user.id) return true;
    res.redirect("/login");
    return false;
};

const getEditProfile = async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    try {
        const user = await User.findById(req.session.user.id).select("name email phone");
        if (!user) {
            req.session.user = null;
            return res.redirect("/login");
        }
        return res.render("edit-profile", { user, error: null });
    } catch (error) {
        console.error("Load edit profile error:", error);
        return res.status(500).send("Unable to load your profile for editing.");
    }
};

const updateProfile = async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const formUser = { ...req.session.user, name, email, phone };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || name.length > 100 || !emailRegex.test(email) || email.length > 254 ||
        !/^[+0-9().\-\s]{7,20}$/.test(phone)) {
        return res.status(400).render("edit-profile", {
            user: formUser,
            error: "Enter a name (up to 100 characters), valid email address, and phone number."
        });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { $set: { name, email, phone } },
            { new: true, runValidators: true }
        );

        if (!user) {
            req.session.user = null;
            return res.redirect("/login");
        }

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone,
            memberSince: user.createdAt,
            role: user.role,
            avatar: user.avatar || ""
        };

        return res.redirect("/profile?updated=1");
    } catch (error) {
        const message = error.code === 11000
            ? "That email address is already in use."
            : "Unable to update your profile. Please try again.";

        if (error.code !== 11000) {
            console.error("Profile update error:", error);
        }

        return res.status(error.code === 11000 ? 409 : 500).render("edit-profile", {
            user: formUser,
            error: message
        });
    }
};

const getAddressForm = async (req, res) => {
    if (!requireProfileUser(req, res)) return;
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect("/login");
        const address = req.params.id ? user.addresses.id(req.params.id) : null;
        if (req.params.id && !address) return res.status(404).send("Address not found.");
        return res.render("address-form", {
            address: address || null,
            editMode: Boolean(req.params.id),
            error: null
        });
    } catch (error) {
        console.error("Load address form error:", error);
        return res.status(500).send("Unable to load address form.");
    }
};

const saveAddress = async (req, res) => {
    if (!requireProfileUser(req, res)) return;
    const address = addressFields(req.body);
    if (!isValidAddress(address)) {
        return res.status(400).render("address-form", {
            address: { ...address, _id: req.params.id || null },
            editMode: Boolean(req.params.id),
            error: "Complete each address field using the allowed lengths."
        });
    }
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect("/login");
        if (address.isDefault) user.addresses.forEach(existing => { existing.isDefault = false; });
        if (req.params.id) {
            const existing = user.addresses.id(req.params.id);
            if (!existing) return res.status(404).send("Address not found.");
            existing.set(address);
        } else {
            if (user.addresses.length === 0) address.isDefault = true;
            user.addresses.push(address);
        }
        if (!user.addresses.some(existing => existing.isDefault) && user.addresses.length) {
            user.addresses[0].isDefault = true;
        }
        await user.save();
        return res.redirect("/profile");
    } catch (error) {
        console.error("Save address error:", error);
        return res.status(500).send("Unable to save this address.");
    }
};

const deleteAddress = async (req, res) => {
    if (!requireProfileUser(req, res)) return;
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect("/login");
        const address = user.addresses.id(req.params.id);
        if (!address) return res.status(404).send("Address not found.");
        const wasDefault = address.isDefault;
        address.deleteOne();
        if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
        await user.save();
        return res.redirect("/profile");
    } catch (error) {
        console.error("Delete address error:", error);
        return res.status(500).send("Unable to delete this address.");
    }
};

module.exports = {
    getEditProfile,
    updateProfile,
    getAddressForm,
    saveAddress,
    deleteAddress
};