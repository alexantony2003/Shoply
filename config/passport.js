const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

const clientID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const callbackURL = (process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback').trim();

if (clientID && clientSecret && !clientID.includes('your-google-client-id')) {
    passport.use(
        new GoogleStrategy(
            {
                clientID,
                clientSecret,
                callbackURL,
                state: true
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;
                    if (!email) {
                        return done(new Error('No email found in your Google account'), null);
                    }

                    // 1. Search by Google ID
                    let user = await User.findOne({ googleId: profile.id });

                    if (!user) {
                        // 2. Search by Email
                        user = await User.findOne({ email });

                        if (user) {
                            // Link existing account with Google ID
                            user.googleId = profile.id;
                            if (!user.avatar && profile.photos && profile.photos[0]) {
                                user.avatar = profile.photos[0].value;
                            }
                            await user.save();
                        } else {
                            // 3. Create new user
                            const name = profile.displayName || (profile.name ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim() : 'Google User');
                            const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

                            user = await User.create({
                                name,
                                email,
                                googleId: profile.id,
                                avatar,
                                phone: '',
                                role: 'customer',
                                status: 'active'
                            });
                        }
                    }

                    if (user.status === 'blocked') {
                        return done(null, false, { message: 'blocked' });
                    }

                    return done(null, user);
                } catch (error) {
                    console.error('Google OAuth verify error:', error);
                    return done(error, null);
                }
            }
        )
    );
}

passport.serializeUser((user, done) => {
    done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
