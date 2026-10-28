const express = require('express');
const passport = require('../config/passport');

const router = express.Router();

// Helper to check if Google OAuth credentials are set
const isGoogleConfigured = () => {
    const id = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const secret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    return Boolean(id && secret && !id.includes('your-google-client-id') && !secret.includes('your-google-client-secret'));
};

const getGoogleErrorCode = (error) => {
    const code = error && (
        error.code
        || (error.oauthError && error.oauthError.code)
        || (error.oauthError && error.oauthError.error)
    );

    return typeof code === 'string' && /^[a-z0-9_-]+$/i.test(code) ? code : 'unknown';
};

const getLoginErrorForGoogleCode = (code) => {
    if (code === 'redirect_uri_mismatch') return 'google_redirect_uri_mismatch';
    if (code === 'access_denied') return 'google_cancelled';
    if (code === 'invalid_client') return 'google_invalid_client';
    return 'google_failed';
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

    if (typeof req.query.error === 'string') {
        const code = getGoogleErrorCode({ code: req.query.error });
        console.warn(`Google OAuth provider rejected authorization: ${code}`);
        return res.redirect(`/login?error=${getLoginErrorForGoogleCode(code)}`);
    }

    passport.authenticate('google', (err, user, info) => {
        if (err) {
            const code = getGoogleErrorCode(err);
            console.error(`Google OAuth callback failed: ${err.name || 'Error'} (${code})`);
            return res.redirect(`/login?error=${getLoginErrorForGoogleCode(code)}`);
        }

        if (!user) {
            if (info && info.message === 'blocked') {
                return res.redirect('/login?error=blocked');
            }
            console.warn(`Google OAuth did not authenticate a user: ${getGoogleErrorCode(info)}`);
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
