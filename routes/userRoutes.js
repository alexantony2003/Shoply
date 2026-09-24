const express = require("express");

const userRouter = express.Router();

const {
    createUser,
    getUsers,
    loginUser,
    verifyOTP
} = require("../controllers/userController");


/* REGISTER PAGE */
userRouter.get("/register", (req, res) => {
    res.render("register");
});


/* REGISTER USER */
userRouter.post("/register", createUser);


/* OTP VERIFICATION PAGE */
userRouter.get("/verify-otp", (req, res) => {
    res.render("verify-otp", {
        email: req.query.email
    });
});


/* VERIFY OTP */
userRouter.post("/verify-otp", verifyOTP);


/* LOGIN */
userRouter.post("/login", loginUser);


/* GET USERS */
userRouter.get("/", getUsers);


module.exports = userRouter;