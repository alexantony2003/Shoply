const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sendOTP = require("../utils/sendOTP");

// Helper to render register with error and preserved form data
const renderRegisterError = (res, error, formData = {}) => {
    return res.render("register", {
        error,
        formData
    });
};

// ========================================
// REGISTER USER (STEP 1: Validate & Send OTP)
// ========================================
const createUser = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            confirmPassword,
            phone
        } = req.body;

        const formData = {
            name: name || '',
            email: email || '',
            phone: phone || ''
        };

        // Name validation
        if (!name || name.trim().length < 2) {
            return renderRegisterError(res, "Full name must be at least 2 characters.", formData);
        }
        if (name.trim().length > 60) {
            return renderRegisterError(res, "Full name cannot exceed 60 characters.", formData);
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return renderRegisterError(res, "Please enter a valid email address.", formData);
        }
        const cleanEmail = email.trim().toLowerCase();

        // Phone validation (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        const cleanPhone = String(phone || '').trim().replace(/[^0-9]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            return renderRegisterError(res, "Please enter a valid 10-digit phone number.", formData);
        }

        // Password validation
        if (!password || password.length < 6) {
            return renderRegisterError(res, "Password must be at least 6 characters long.", formData);
        }
        if (password !== confirmPassword) {
            return renderRegisterError(res, "Passwords do not match.", formData);
        }

        // Check existing user
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return renderRegisterError(res, "An account with this email address already exists. Please log in.", formData);
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Store registration data in session
        req.session.registration = {
            name: name.trim(),
            email: cleanEmail,
            password,
            phone: cleanPhone,
            otp,
            otpExpires: Date.now() + (5 * 60 * 1000), // 5 minutes
            otpLastSent: Date.now()
        };

        // Send OTP to email
        try {
            await sendOTP(cleanEmail, otp);
            console.log(`Verification OTP sent to ${cleanEmail}`);
        } catch (emailErr) {
            console.error("Failed to send OTP email:", emailErr);
            return renderRegisterError(
                res,
                "Unable to send verification OTP to this email. Please check the address or try again.",
                formData
            );
        }

        // Save session before redirecting to ensure data is in store
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during registration:", saveErr);
                return renderRegisterError(res, "Session error. Please try again.", formData);
            }
            return res.redirect(`/users/verify-otp?email=${encodeURIComponent(cleanEmail)}`);
        });

    } catch (error) {
        console.error("Registration error:", error);
        return renderRegisterError(res, "Registration failed: " + error.message, req.body);
    }
};

// ========================================
// VERIFY OTP (STEP 2: Verify & Create User in DB)
// ========================================
const verifyOTP = async (req, res) => {
    try {
        const submittedOtp = String(req.body.otp || '').trim();
        const registration = req.session.registration;

        if (!registration || !registration.email) {
            return res.redirect("/users/register?error=" + encodeURIComponent("Registration session expired. Please register again."));
        }

        if (Date.now() > registration.otpExpires) {
            req.session.registration = null;
            return res.redirect("/users/register?error=" + encodeURIComponent("Your OTP expired. Please register again."));
        }

        if (!submittedOtp || submittedOtp !== registration.otp) {
            return res.redirect(`/users/verify-otp?email=${encodeURIComponent(registration.email)}&error=invalid`);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(registration.password, 10);

        // Save user to MongoDB ONLY AFTER valid OTP verification
        const user = await User.create({
            name: registration.name,
            email: registration.email,
            passwordHash,
            phone: registration.phone || '',
            role: "customer",
            status: "active"
        });

        console.log("User successfully created and verified:", user.email);

        // Clear temporary registration data from session
        req.session.registration = null;

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after verify:", saveErr);
            }
            return res.redirect("/login?success=registered");
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        return res.redirect("/users/register?error=" + encodeURIComponent("Verification failed: " + error.message));
    }
};

// ========================================
// RESEND OTP
// ========================================
const resendOTP = async (req, res) => {
    try {
        const registration = req.session.registration;

        if (!registration || !registration.email) {
            return res.redirect("/users/register?error=" + encodeURIComponent("Session expired. Please fill in your registration details again."));
        }

        const now = Date.now();
        const lastSent = registration.otpLastSent || 0;
        const cooldown = 30 * 1000; // 30 seconds cooldown

        if (now - lastSent < cooldown) {
            const remaining = Math.ceil((cooldown - (now - lastSent)) / 1000);
            return res.redirect(`/users/verify-otp?email=${encodeURIComponent(registration.email)}&error=wait&seconds=${remaining}`);
        }

        const otp = crypto.randomInt(100000, 1000000).toString();

        try {
            await sendOTP(registration.email, otp);
            console.log(`Resent OTP to ${registration.email}`);
        } catch (emailError) {
            console.error("OTP resend email error:", emailError);
            return res.redirect(`/users/verify-otp?email=${encodeURIComponent(registration.email)}&error=sendfailed`);
        }

        registration.otp = otp;
        registration.otpExpires = Date.now() + (5 * 60 * 1000);
        registration.otpLastSent = Date.now();
        req.session.registration = registration;

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error on resend:", saveErr);
            }
            return res.redirect(`/users/verify-otp?email=${encodeURIComponent(registration.email)}&success=resent`);
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.redirect("/users/verify-otp?error=sendfailed");
    }
};

// ========================================
// LOGIN USER
// ========================================
const loginUser = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.render("login", {
                error: "Please enter a valid email address.",
                email
            });
        }

        if (!password) {
            return res.render("login", {
                error: "Please enter your password.",
                email
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.render("login", {
                error: "No account found with this email address.",
                email
            });
        }

        if (user.status === "blocked") {
            return res.render("login", {
                error: "This account has been blocked. Please contact support.",
                email
            });
        }

        // If user registered with Google OAuth and has no password
        if (!user.passwordHash && user.googleId) {
            return res.render("login", {
                error: "This account was registered using Google. Please sign in with Google.",
                email
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return res.render("login", {
                error: "Incorrect password. Please try again.",
                email
            });
        }

        // Create login session
        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            avatar: user.avatar || '',
            memberSince: user.createdAt,
            role: user.role
        };

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during login:", saveErr);
                return res.render("login", { error: "Session error. Please try again." });
            }
            if (user.role === "admin") {
                return res.redirect("/admin");
            }
            return res.redirect("/");
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.render("login", {
            error: "Login failed: " + error.message,
            email: req.body.email || ''
        });
    }
};

// ========================================
// ADMIN USER MANAGEMENT
// ========================================
const getUsers = async (req, res) => {
    try {
        const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
        res.render("admin/users", { users });
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).send(error.message);
    }
};

const blockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: "blocked" },
            { runValidators: true, new: true }
        );

        if (!user) {
            return res.status(404).send("User not found");
        }

        res.redirect("/admin/users");
    } catch (error) {
        console.error("Block user error:", error);
        res.status(500).send(error.message);
    }
};

const unblockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: "active" },
            { runValidators: true, new: true }
        );

        if (!user) {
            return res.status(404).send("User not found");
        }

        res.redirect("/admin/users");
    } catch (error) {
        console.error("Unblock user error:", error);
        res.status(500).send(error.message);
    }
};

module.exports = {
    createUser,
    getUsers,
    verifyOTP,
    resendOTP,
    loginUser,
    getAllUsers,
    blockUser,
    unblockUser
};