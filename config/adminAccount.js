const bcrypt = require("bcrypt");
const User = require("../models/userModel");

const configureAdminAccount = async () => {
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");

    if (!email && !password) {
        console.info("Admin bootstrap skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not configured.");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("ADMIN_EMAIL must be a valid email address.");
    }
    if (password.length < 3 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("ADMIN_PASSWORD must contain at least 3 characters and no more than 72 UTF-8 bytes.");
    }

    const passwordHash = await bcrypt.hash(password, 3);
    let user = await User.findOne({ email });

    if (!user) {
        user = await User.create({
            name: String(process.env.ADMIN_NAME || "Store Admin").trim(),
            email,
            passwordHash,
            role: "admin",
            status: "active"
        });
    } else {
        if (user.status !== "active") {
            throw new Error("The configured admin account is blocked. Unblock it before starting the server.");
        }
        user.passwordHash = passwordHash;
        user.role = "admin";
        await user.save();
    }

    console.info(`Configured admin account is ready for ${email}.`);
};

module.exports = configureAdminAccount;
