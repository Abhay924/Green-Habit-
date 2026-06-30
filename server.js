const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "Green Ecosystem")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
const APP_ID = "default-green-habit-app";

const getPaths = (userId) => {
  const userPath = `artifacts/${APP_ID}/users/${userId}`;
  const publicPath = `artifacts/${APP_ID}/public/data`;

  return {
    profile: `${userPath}/profile/data`,
    habits: `${userPath}/habits`,
    pointHistory: `${userPath}/pointHistory`,
    challenges: `${publicPath}/challenges`,
    library: `${publicPath}/library`,
    events: `${publicPath}/events`,
  };
};
const awardPoints = async (userId, amount, reason) => {
  const paths = getPaths(userId);
  const profileRef = db.doc(paths.profile);
  const historyRef = db.collection(paths.pointHistory);

  return await db.runTransaction(async (tx) => {
    const profileDoc = await tx.get(profileRef);

    let currentPoints = 0;
    let badges = [];

    if (profileDoc.exists) {
      const data = profileDoc.data();
      currentPoints = data.points || 0;
      badges = data.badges || [];
    }

    const newTotal = currentPoints + amount;
    const newBadges = [];
    if (newTotal >= 10 && !badges.find((b) => b.name === "Bronze Beginner"))
      newBadges.push({ name: "Bronze Beginner", icon: "🥉", minPoints: 10 });

    if (newTotal >= 100 && !badges.find((b) => b.name === "Eco-Novice"))
      newBadges.push({ name: "Eco-Novice", icon: "🌱", minPoints: 100 });

    if (newTotal >= 500 && !badges.find((b) => b.name === "Silver Striker"))
      newBadges.push({ name: "Silver Striker", icon: "⚡", minPoints: 500 });

    const allBadges = [...badges, ...newBadges];
    tx.set(
      profileRef,
      { points: newTotal, badges: allBadges },
      { merge: true }
    );
    tx.set(historyRef.doc(), {
      amount,
      reason,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { newPoints: newTotal, earnedBadges: newBadges };
  });
};
app.get("/api/users/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const { email, displayName } = req.query;

    const paths = getPaths(uid);
    const profileRef = db.doc(paths.profile);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      const newProfile = {
        uid,
        email: email || "",
        displayName: displayName || "User",
        points: 0,
        badges: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await profileRef.set(newProfile);
      return res.json(newProfile);
    }

    return res.json(profileDoc.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot load profile" });
  }
});
app.get("/api/users/:uid/habits", async (req, res) => {
  try {
    const uid = req.params.uid;
    const paths = getPaths(uid);

    const snap = await db.collection(paths.habits).get();
    const habits = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: "Cannot load habits" });
  }
});
app.patch("/api/users/:uid/habits/:habitId", async (req, res) => {
  try {
    const uid = req.params.uid;
    const habitId = req.params.habitId;
    const { isCompleting, newStreak, lastCompleted } = req.body;

    const paths = getPaths(uid);
    const habitRef = db.collection(paths.habits).doc(habitId);

    await habitRef.update({
      isCompletedToday: isCompleting,
      streak: newStreak,
      lastCompleted: lastCompleted || null,
    });

    let pointResult = null;
    if (isCompleting) {
      pointResult = await awardPoints(uid, 5, "Habit Completed");
    }

    res.json(pointResult || { success: true });
  } catch (err) {
    res.status(500).json({ error: "Cannot update habit" });
  }
});
app.get("/api/users/:uid/point-history", async (req, res) => {
  try {
    const uid = req.params.uid;
    const paths = getPaths(uid);

    const snap = await db
      .collection(paths.pointHistory)
      .orderBy("timestamp", "desc")
      .get();
    const history = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Cannot load history" });
  }
});
app.get("/api/challenges", async (req, res) => {
  try {
    const paths = getPaths("public").challenges;

    const snap = await db.collection(paths).get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Cannot load challenges" });
  }
});
app.get("/api/library", async (req, res) => {
  try {
    const paths = getPaths("public").library;

    const snap = await db.collection(paths).get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Cannot load library" });
  }
});
app.get("/api/events", async (req, res) => {
  try {
    const paths = getPaths("public").events;

    const snap = await db.collection(paths).get();
    const events = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Cannot load events" });
  }
});
app.listen(port, () => {
  console.log("==================================================");
  console.log("  GREEN HABIT ECOSYSTEM - BACKEND");
  console.log(`  Server running on http://localhost:${port}`);
  console.log("==================================================");
});
