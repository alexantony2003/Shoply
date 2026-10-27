require('dotenv').config();

const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const {
    CATEGORY_ORDER,
    createSlug,
    getDefaultIconKey,
    normalizeName
} = require('../utils/categoryIcons');

/**
 * Non-destructive category sync.
 *
 * - Adds the storefront categories that are missing (only when a category with
 *   the same name does not already exist).
 * - Stores the matching icon on categories that do not have one yet.
 * - Fills in a missing slug.
 * - Never renames, merges or deletes an existing category, so category ids and
 *   product relationships stay intact.
 *
 * Usage: npm run categories:sync
 */

const findByName = async (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Category.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
};

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shoply');

    const created = [];
    const updated = [];
    const kept = [];

    for (const name of CATEGORY_ORDER) {
        const existing = await findByName(name);

        if (!existing) {
            const createdCategory = await Category.create({
                name,
                slug: createSlug(name),
                icon: getDefaultIconKey(name),
                status: true
            });
            created.push(`${name} (${createdCategory._id})`);
            continue;
        }

        const changes = {};

        if (!existing.slug) {
            changes.slug = createSlug(existing.name);
        }

        if (!existing.icon) {
            changes.icon = getDefaultIconKey(existing.name);
        }

        if (Object.keys(changes).length) {
            await Category.updateOne({ _id: existing._id }, { $set: changes });
            updated.push(`${existing.name} -> ${Object.keys(changes).join(', ')}`);
        } else {
            kept.push(existing.name);
        }
    }

    // Any other category (added from the admin panel) is left untouched apart
    // from receiving an icon when it has none.
    const extras = await Category.find({}).sort({ name: 1 });
    const extraNames = [];

    for (const category of extras) {
        if (!CATEGORY_ORDER.some(order => normalizeName(order) === normalizeName(category.name))) {
            extraNames.push(category.name);
        }

        if (!category.icon) {
            await Category.updateOne(
                { _id: category._id },
                { $set: { icon: getDefaultIconKey(category.name) } }
            );
            updated.push(`${category.name} -> icon`);
        }
    }

    console.log(`Created ${created.length} category(ies):`);
    created.forEach(entry => console.log(`  + ${entry}`));

    console.log(`Updated ${updated.length} category(ies):`);
    updated.forEach(entry => console.log(`  ~ ${entry}`));

    console.log(`Already up to date: ${kept.length}`);
    kept.forEach(name => console.log(`  = ${name}`));

    console.log(`Other categories kept as they are: ${extraNames.length}`);
    extraNames.forEach(name => console.log(`  · ${name}`));

    console.log(`\nTotal categories in MongoDB: ${await Category.countDocuments({})}`);
};

run()
    .catch(error => {
        console.error(`Category sync failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
