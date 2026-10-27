const express = require('express');
const passport = require('../config/passport');

const router = express.Router();

// Helper to check if Google OAuth credentials are set
const isGoogleConfigured = () => {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    return Boolean(id && secret && !id.includes('your-google-client-id') && !secret.includes('your-google-client-secret'));
};

// ========================================
// 1. INITIATE GOOGLE AUTH
// ========================================
router.get('/google', (req, res, next) => {
    if (!isGoogleConfigured()) {
        return res.redirect('/login?error=google_not_configured');
    }

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});

// ========================================
// 2. GOOGLE AUTH CALLBACK
// ========================================
router.get('/google/callback', (req, res, next) => {
    if (!isGoogleConfigured()) {
        return res.redirect('/login?error=google_not_configured');
    }

    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error('Google OAuth callback error:', err);
            return res.redirect('/login?error=google_failed');
        }

        if (!user) {
            if (info && info.message === 'blocked') {
                return res.redirect('/login?error=blocked');
            }
            return res.redirect('/login?error=google_failed');
        }

        // Establish user session
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
                console.error('Session save error:', saveErr);
                return res.redirect('/login?error=session_error');
            }
            return res.redirect('/');
        });
    })(req, res, next);
});

module.exports = router;
