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

    let user = await User.findOne({ email });

    if (user) {
        if (user.status !== "active") {
            throw new Error("The configured admin account is blocked. Unblock it before starting the server.");
        }
        if (user.role !== "admin") {
            throw new Error("The configured admin email belongs to a non-admin account. Promote it explicitly with npm run admin:promote.");
        }

        console.info(`Configured admin account is ready for ${email}.`);
        return;
    }

    if (password.length < 16 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("Creating the admin account requires an ADMIN_PASSWORD of at least 16 characters and no more than 72 UTF-8 bytes.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
        name: String(process.env.ADMIN_NAME || "Store Admin").trim(),
        email,
        passwordHash,
        role: "admin",
        status: "active"
    });

    console.info(`Configured admin account is ready for ${email}.`);
};

module.exports = configureAdminAccount;
