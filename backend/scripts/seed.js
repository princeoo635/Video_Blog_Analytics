/**
 * seed.js
 * Generates realistic test data for the Video Blog Platform so the
 * dataset supports meaningful analyst-style insights (growth trends,
 * skewed creator activity, category breakdowns, view distributions).
 *
 * HOW TO USE
 * 1. Place this file in your backend project (e.g. /scripts/seed.js)
 * 2. Fix the two import paths below to match your project structure
 * 3. Run:  node scripts/seed.js
 *
 * Requires: mongoose, @faker-js/faker
 *   npm install @faker-js/faker --save-dev
 */

import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

// ⚠️ Adjust these two paths to match your project structure
import { User } from "../src/models/user.model.js";
import { Video } from "../src/models/video.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URL ;

const NUM_USERS = 80;
const NUM_VIDEOS = 450;
const CATEGORIES = ["Tech", "Gaming", "Music", "Education", "Vlog", "Comedy", "Sports", "News"];
// Categories aren't equally popular in real platforms — weight them
const CATEGORY_WEIGHTS = [25, 20, 15, 12, 10, 8, 6, 4];

// ---- helpers ----------------------------------------------------------

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    if (r < weights[i]) return items[i];
    r -= weights[i];
  }
  return items[items.length - 1];
}

// Signup dates trending upward over the last 10 months, not a flat line
function randomSignupDate() {
  const now = new Date();
  const monthsAgo = Math.floor(Math.pow(Math.random(), 1.5) * 10); // skew recent
  const date = new Date(now);
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(1 + Math.floor(Math.random() * 28));
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return date;
}

// A small set of power users post a lot; most post once or twice
function buildCreatorDistribution(users) {
  const shuffled = [...users].sort(() => Math.random() - 0.5);
  const powerUsers = shuffled.slice(0, Math.round(users.length * 0.15));   // 15% power users
  const casualUsers = shuffled.slice(Math.round(users.length * 0.15));     // 85% casual

  const weighted = [];
  powerUsers.forEach((u) => weighted.push(...Array(15).fill(u)));  // heavy weight
  casualUsers.forEach((u) => weighted.push(...Array(2).fill(u)));  // light weight
  return weighted;
}

function randomVideoDate(ownerSignupDate) {
  // video must be published after the owner signed up
  const now = new Date();
  const earliest = ownerSignupDate.getTime();
  const latest = now.getTime();
  return new Date(earliest + Math.random() * (latest - earliest));
}

function correlatedViews(publishedDate, category) {
  const daysOld = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
  const categoryBoost = { Tech: 1.4, Gaming: 1.6, Music: 1.8, Education: 1.0, Vlog: 0.8, Comedy: 1.3, Sports: 1.1, News: 0.9 };
  const base = daysOld * (5 + Math.random() * 15); // older videos accumulate more views
  const noise = Math.random() * 200;
  return Math.round(base * (categoryBoost[category] || 1) + noise);
}

// ---- main ---------------------------------------------------------------

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  console.log(`Clearing existing test collections...`);
  await User.deleteMany({});
  await Video.deleteMany({});

  // 1. Create users with staggered signup dates
  console.log(`Creating ${NUM_USERS} users...`);
  const userDocs = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const signupDate = randomSignupDate();
    userDocs.push({
      username: faker.internet.username().toLowerCase() + i,
      email: faker.internet.email().toLowerCase(),
      fullname: faker.person.fullName(),
      avatar: faker.image.avatar(),
      password: "TestPassword123", // will be hashed by the pre-save hook
      createdAt: signupDate,
      updatedAt: signupDate,
    });
  }

  // Insert one by one so the pre-save password hash hook runs
  const users = [];
  for (const doc of userDocs) {
    const user = new User(doc);
    await user.save();
    // overwrite Mongoose's auto-generated createdAt back to our staggered date
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { createdAt: doc.createdAt, updatedAt: doc.updatedAt } }
    );
    users.push({ ...user.toObject(), createdAt: doc.createdAt });
  }

  // 2. Create videos with skewed creator distribution + category weighting
  console.log(`Creating ${NUM_VIDEOS} videos...`);
  const creatorPool = buildCreatorDistribution(users);
  const videoDocs = [];

  for (let i = 0; i < NUM_VIDEOS; i++) {
    const owner = creatorPool[Math.floor(Math.random() * creatorPool.length)];
    const category = pickWeighted(CATEGORIES, CATEGORY_WEIGHTS);
    const publishedDate = randomVideoDate(owner.createdAt);

    videoDocs.push({
      videofile: faker.internet.url() + "/video.mp4",
      thumbnail: faker.image.urlPicsumPhotos(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraph(),
      duration: Math.round(60 + Math.random() * 1200), // 1–20 min
      views: correlatedViews(publishedDate, category),
      category,
      ispublished: Math.random() > 0.05, // 95% published
      owner: owner._id,
      createdAt: publishedDate,
      updatedAt: publishedDate,
    });
  }

  await Video.insertMany(videoDocs);
  // Fix timestamps directly since insertMany bypasses schema-level auto timestamps
  const bulkOps = videoDocs.map((v, idx) => ({
    updateOne: {
      filter: { title: v.title, owner: v.owner },
      update: { $set: { createdAt: v.createdAt, updatedAt: v.updatedAt } },
    },
  }));
  if (bulkOps.length) await Video.collection.bulkWrite(bulkOps);

  console.log("Seeding complete:");
  console.log(`  Users:  ${users.length}`);
  console.log(`  Videos: ${videoDocs.length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});