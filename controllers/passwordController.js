const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/userModel");
const sendOTP = require("../utils/sendOTP");

const resetCodeHash = code => crypto.createHash("sha256").update(code).digest();

const requestPasswordReset = async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).render("forgot-password", {
            error: "Enter a valid email address.",
            success: ""
        });
    }
    try {
        const user = await User.findOne({ email });
        req.session.passwordReset = null;
        if (user) {
            const code = crypto.randomInt(100000, 1000000).toString();
            await sendOTP.sendPasswordResetOTP(email, code);
            req.session.passwordReset = {
                userId: user._id.toString(),
                email,
                codeHash: resetCodeHash(code).toString("hex"),
                expiresAt: Date.now() + 5 * 60 * 1000,
                attempts: 0
            };
        }
        return res.render("forgot-password", {
            error: "",
            success: "If an account exists for that email, a reset code has been sent."
        });
    } catch (error) {
        console.error("Password reset request error:", error);
        return res.status(500).render("forgot-password", {
            error: "Unable to send a reset code right now. Please try again later.",
            success: ""
        });
    }
};

const getPasswordReset = (req, res) => {
    return res.render("reset-password", {
        email: req.session.passwordReset ? req.session.passwordReset.email : "",
        error: req.query.error || ""
    });
};

const resetPassword = async (req, res) => {
    const reset = req.session.passwordReset;
    const code = String(req.body.code || "").trim();
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    if (!reset || reset.expiresAt < Date.now() || reset.attempts >= 5) {
        req.session.passwordReset = null;
        return res.status(400).render("forgot-password", {
            error: "Your reset code has expired or is no longer valid. Request a new code.",
            success: ""
        });
    }
    if (!/^\d{6}$/.test(code) ||
        !crypto.timingSafeEqual(resetCodeHash(code), Buffer.from(reset.codeHash, "hex"))) {
        reset.attempts += 1;
        return res.status(400).render("reset-password", {
            email: reset.email,
            error: "The reset code is incorrect."
        });
    }
    if (password.length < 8 || password !== confirmPassword) {
        return res.status(400).render("reset-password", {
            email: reset.email,
            error: "Use a password of at least 8 characters and enter it the same way twice."
        });
    }
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.findByIdAndUpdate(
            reset.userId,
            { $set: { passwordHash } },
            { runValidators: true }
        );
        if (!user) {
            req.session.passwordReset = null;
            return res.status(400).render("forgot-password", {
                error: "Unable to reset this account. Request a new code.",
                success: ""
            });
        }
        req.session.passwordReset = null;
        return res.redirect("/login?error=password_reset");
    } catch (error) {
        console.error("Password reset error:", error);
        return res.status(500).render("reset-password", {
            email: reset.email,
            error: "Unable to reset your password right now. Please try again."
        });
    }
};

module.exports = { requestPasswordReset, getPasswordReset, resetPassword };
