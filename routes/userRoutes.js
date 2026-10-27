const express = require("express");

const userRouter = express.Router();

const {
    createUser,
    getUsers,
    verifyOTP,
    resendOTP,
    loginUser
} = require("../controllers/userController");


// ========================================
// REGISTER PAGE
// ========================================

const { redirectIfLoggedIn, adminAuth } = require('../middlewares/authMiddleware');
userRouter.get("/register", redirectIfLoggedIn, (req, res) => {
    res.render("register", { error: req.query.error || null, formData: {} });
});

userRouter.get("/login", redirectIfLoggedIn, (req, res) => {
    res.render("login", { error: req.query.error || null, success: req.query.success || null });
});


// ========================================
// REGISTER
// ========================================

userRouter.post(
    "/register",
    createUser
);

// ========================================
// LOGIN
// ========================================

userRouter.post(
    "/login",
    loginUser
);


// ========================================
// OTP PAGE
// ========================================

userRouter.get(
    "/verify-otp",
    (req, res) => {
        res.render("verify-otp", {
            email: req.query.email || "",
            error: req.query.error  || "",
            success: req.query.success || "",
            seconds: Number(req.query.seconds) || 0
        });
    }   
);

// ========================================
// VERIFY OTP
// ========================================

userRouter.post(
    "/verify-otp",
    verifyOTP
);



//resend OTP
userRouter.post(
    "/resend-otp", resendOTP
);



// ========================================
// GET USERS (Protected for Admin only)
// ========================================

userRouter.get(
    "/",
    adminAuth,
    getUsers
);


module.exports = userRouter;