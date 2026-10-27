const User = require('../models/userModel');

const requireLogin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.id) {
        return next ? next() : true;
    }
    if (next) {
        return res.redirect('/login');
    }
    res.redirect('/login');
    return false;
};

const isLoggedIn = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.id) {
        return next ? next() : true;
    }
    if (next) {
        return res.redirect('/login');
    }
    return false;
};

const adminAuth = async (req, res, next) => {
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.user.id).select('role status');
        if (!user || user.status !== 'active') {
            req.session.user = null;
            return res.status(403).send('This account is not authorized to access the admin area.');
        }
        if (user.role !== 'admin') {
            return res.status(403).send('Administrator access required. Sign in with an admin account.');
        }
        req.session.user.role = user.role;
        return next();
    } catch (error) {
        console.error('Admin authorization error:', error);
        return res.status(500).send('Unable to verify admin access right now.');
    }
};

module.exports = {
    requireLogin,
    isLoggedIn,
    adminAuth
};