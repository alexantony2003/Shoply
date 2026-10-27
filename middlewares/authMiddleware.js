const User = require('../models/userModel');

const userAuth = async (req, res, next) => {
    if (!req.session || !req.session.user || !req.session.user.id) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(401).json({ error: 'Please log in to continue.' });
        }
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.user.id).select('role status');
        if (!user || user.status === 'blocked') {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                    return res.status(403).json({ error: 'Your account has been blocked.' });
                }
                return res.redirect('/login?error=blocked');
            });
            return;
        }

        req.session.user.role = user.role;
        return next();
    } catch (error) {
        console.error('User authorization error:', error);
        return res.status(500).send('Unable to verify user access.');
    }
};

const requireLogin = userAuth;
const isLoggedIn = userAuth;

const adminAuth = async (req, res, next) => {
    if (!req.session || !req.session.user || !req.session.user.id) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(401).json({ error: 'Admin authentication required.' });
        }
        return res.redirect('/login?error=admin_required');
    }

    try {
        const user = await User.findById(req.session.user.id).select('role status');
        if (!user || user.status !== 'active') {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                return res.status(403).send('This account is not authorized to access the admin area.');
            });
            return;
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

const redirectIfLoggedIn = async (req, res, next) => {
    if (req.session && req.session.user && req.session.user.id) {
        try {
            const user = await User.findById(req.session.user.id).select('role status');
            if (user && user.status === 'active') {
                if (user.role === 'admin') {
                    return res.redirect('/admin');
                }
                return res.redirect('/');
            }
            // User was blocked or deleted, clear invalid session
            req.session.user = null;
        } catch (error) {
            console.error('Redirect check error:', error);
        }
    }
    return next();
};

module.exports = {
    requireLogin,
    isLoggedIn,
    userAuth,
    adminAuth,
    redirectIfLoggedIn
};