const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const sendOTP = require("../utils/sendOTP");


// ===============================
// REGISTER USER
// ===============================

const createUser = async (req, res) => {
    try {

        const {
            name,
            email,
            password,
            confirmPassword,
            phone,
            address
        } = req.body;


        // Password validation
        if (!password || password.length < 3) {
            return res.send(
                "Password must be at least 3 characters"
            );
        }


        // Confirm password
        if (password !== confirmPassword) {
            return res.send(
                "Passwords do not match"
            );
        }


        // Check if email already exists
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.send(
                "Email is already registered"
            );
        }


        // Generate 6 digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();


        // Store registration information temporarily
        // in the session
        req.session.registration = {

            name,

            email: email.toLowerCase(),

            password,

            phone,

            address,

            otp,

            otpExpires: Date.now() + (5 * 60 * 1000)

        };


        // Send OTP to Gmail
        await sendOTP(
            email,
            otp
        );


        console.log(
            `OTP sent to ${email}: ${otp}`
        );


        // Open OTP page
        res.redirect(
            `/users/verify-otp?email=${encodeURIComponent(email)}`
        );


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        res.status(500).send(
            error.message
        );
    }
};


// ===============================
// VERIFY OTP
// ===============================

const verifyOTP = async (req, res) => {
    try {

        const { otp } = req.body;


        // Get registration data from session
        const registration =
            req.session.registration;


        // Check registration session
        if (!registration) {

            return res.send(
                "Registration session expired. Please register again."
            );

        }


        // Check OTP
        if (registration.otp !== otp) {

            return res.send(
                "Invalid OTP"
            );

        }


        // Check OTP expiry
        if (
            Date.now() >
            registration.otpExpires
        ) {

            req.session.registration = null;

            return res.send(
                "OTP expired. Please register again."
            );

        }


        // Hash password
        const passwordHash =
            await bcrypt.hash(
                registration.password,
                10
            );


        // =================================
        // NOW SAVE USER TO MONGODB
        // =================================

        const user = await User.create({

            name: registration.name,

            email: registration.email,

            passwordHash,

            phone: registration.phone,

            address: registration.address,

            role: "customer",

            status: "active"

        });


        console.log(
            "User saved to MongoDB:",
            user.email
        );


        // Remove registration data from session
        req.session.registration = null;


        // Registration completed
        res.redirect("/login");


    } catch (error) {

        console.error(
            "OTP verification error:",
            error
        );

        res.status(500).send(
            error.message
        );
    }
};


// ===============================
// GET USERS
// ===============================

const getUsers = async (req, res) => {
    try {

        const users = await User.find();

        res.json(users);

    } catch (error) {

        res.status(500).send(
            error.message
        );
    }
};


// ===============================
// LOGIN
// ===============================

const loginUser = async (req, res) => {
    try {

        const {
            email,
            password
        } = req.body;


        // Find registered email
        const user = await User.findOne({
            email: email.toLowerCase()
        });


        if (!user) {

            return res.send(
                "Email is not registered"
            );

        }


        // Check password
        const passwordMatch =
            await bcrypt.compare(
                password,
                user.passwordHash
            );


        if (!passwordMatch) {

            return res.send(
                "Incorrect password"
            );

        }


        // Store user in session
        req.session.user = {

            id: user._id.toString(),

            name: user.name,

            email: user.email,

            phone: user.phone,

            memberSince: user.createdAt

        };


        res.redirect("/");


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).send(
            error.message
        );
    }
};


// ===============================
// EXPORT
// ===============================

module.exports = {

    createUser,

    getUsers,

    loginUser,

    verifyOTP

};