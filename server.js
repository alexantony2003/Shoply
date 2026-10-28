const dotenvConfig = require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const connectDB = require('./config/db');
const configureAdminAccount = require('./config/adminAccount');
const storeRoutes = require('./routes/store');
const adminRoutes = require('./routes/admin');
const User = require('./models/userModel');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const sendOTP = require("./utils/sendOTP");
const categoryRoutes = require("./routes/categoryRoutes");
const profileRoutes = require("./routes/profileRoutes");
const { loadCategoryNav } = require("./middlewares/categoryMiddleware");

const passport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const environmentSessionSecret = process.env.SESSION_SECRET;
const fileSessionSecret = dotenvConfig.parsed && dotenvConfig.parsed.SESSION_SECRET;
const sessionSecret = isProduction
    && Buffer.byteLength(environmentSessionSecret || '', 'utf8') < 32
    && Buffer.byteLength(fileSessionSecret || '', 'utf8') >= 32
    ? fileSessionSecret
    : environmentSessionSecret;

if (isProduction) {
    if (!sessionSecret || Buffer.byteLength(sessionSecret, 'utf8') < 32) {
        throw new Error('Production requires a SESSION_SECRET of at least 32 UTF-8 bytes.');
    }
    app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: sessionSecret || 'shoply-development-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

// Makes the MongoDB-driven category rail available to every storefront view.
app.use(loadCategoryNav);

app.use((req, res, next) => {
    const originalRender = res.render.bind(res);

    res.render = (view, options, callback) => {
        const renderCallback = (error, html) => {
            if (error) {
                return callback ? callback(error) : next(error);
            }

            const assets = [];
            assets.push('<script>(function(){try{var t=localStorage.getItem("shoply-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>');
            if (!html.includes('href="/styles.css"')) {
                assets.push('<link rel="stylesheet" href="/styles.css">');
            }
            if (!html.includes('src="/app.js"')) {
                assets.push('<script defer src="/app.js"></script>');
            }
            if (assets.length > 0) {
                html = html.replace('</head>', `${assets.join('')}</head>`);
            }

            if (req.session && req.session.user && req.session.user.role === 'admin') {
                html = html.replace(/<body(\s|>)/i, '<body data-user-role="admin"$1');
            }

            if (callback) {
                return callback(null, html);
            }

            return res.send(html);
        };

        if (typeof options === 'function') {
            return originalRender(view, renderCallback);
        }

        return originalRender(view, options, renderCallback);
    };

    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/users/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/', storeRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use("/admin/categories", categoryRoutes);

app.use((req, res) => {
    res.status(404).send('Page not found');
});

connectDB()
    .then(configureAdminAccount)
    .then(() => {
        app.listen(port, () => {
            console.log(`Shoply server running at http://localhost:${port}`);
        });
    })
    .catch(error => {
        console.error('Application startup failed:', error.message);
        process.exitCode = 1;
});