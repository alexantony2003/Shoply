require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const connectDB = require('./config/db');
const storeRoutes = require('./routes/store');
const adminRoutes = require('./routes/admin');
const User = require('./models/userModel');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
const port = process.env.PORT || 3000;

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'shoply-development-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    const originalRender = res.render.bind(res);

    res.render = (view, options, callback) => {
        const renderCallback = (error, html) => {
            if (error) {
                return callback ? callback(error) : next(error);
            }

            if (!html.includes('href="/styles.css"')) {
                html = html.replace(
                    '</head>',
                    '<link rel="stylesheet" href="/styles.css"><script defer src="/app.js"></script></head>'
                );
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
app.use('/', storeRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);

app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(port, () => {
    console.log(`Shoply server running at http://localhost:${port}`);
});