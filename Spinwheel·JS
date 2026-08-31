// api/spinWheel.js
// POST /api/spinWheel   Body: { usingExtraSpin?: boolean }
// نسخة كاملة من منطق العجلة الأساسية (settings/wheel من Firestore، كول داون،
// السبن الإضافي، مضاعف الكوينز) — بس هنا بيتنفذ على السيرفر فمينفعش يتلعب فيه.

const { admin, db, requireAuth, setCors } = require('./_firebaseAdmin');

const DEFAULT_WHEEL_BASIC = {
  coin1: { amount: 10, weight: 20 },
  coin2: { amount: 25, weight: 15 },
  coin3: { amount: 50, weight: 8 },
  extraSpin: { weight: 12 },
  gift: { weight: 10 },
  lose1: { weight: 20 },
  lose2: { weight: 15 },
};

function pickWeighted(entriesObj) {
  const keys = Object.keys(entriesObj || {}).filter(k => (entriesObj[k].weight || 0) > 0);
  const total = keys.reduce((s, k) => s + (entriesObj[k].weight || 0), 0);
  if (!total) return keys[0] || null;
  let r = Math.random() * total;
  for (const k of keys) {
    r -= (entriesObj[k].weight || 0);
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

function activeBoostMultiplier(userData) {
  const b = userData && userData.coinBoost;
  if (!b || !b.expiresAt) return 1;
  const exp = b.expiresAt.toDate ? b.expiresAt.toDate() : new Date(b.expiresAt);
  if (exp <= new Date()) return 1;
  return b.multiplier || 1;
}

module.exports = async (req, res) => {
  setCors(res); // '*' — الحماية الحقيقية هي requireAuth() (التوكن)، مش مصدر الطلب
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  try {
    const uid = await requireAuth(req);
    const usingExtraSpin = !!(req.body && req.body.usingExtraSpin);
    const userRef = db.collection('users').doc(uid);

    // إعدادات العجلة القابلة للتحكم من لوحة الأدمن
    const settingsSnap = await db.collection('settings').doc('wheel').get();
    const s = settingsSnap.exists ? settingsSnap.data() : {};
    const enabled = s.enabled !== false;
    if (!enabled) return res.status(403).json({ error: 'wheel-disabled' });
    const cooldownHours = s.cooldownHours || 24;
    const basicConfig = { ...DEFAULT_WHEEL_BASIC, ...(s.basic || {}) };
    const bypassCooldown = s.testModeEnabled === true && s.testModeUid && s.testModeUid === uid;

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const userData = snap.data() || {};

      const cooldownMs = cooldownHours * 3600000;
      const lastSpin = userData.wheelLastSpinAt ? userData.wheelLastSpinAt.toDate() : null;
      const nextAt = lastSpin ? new Date(lastSpin.getTime() + cooldownMs) : null;
      const dailyReady = bypassCooldown || !nextAt || nextAt <= new Date();

      if (usingExtraSpin) {
        if (!(userData.wheelExtraSpins > 0)) {
          const err = new Error('مفيش عندك سبنات إضافية');
          err.status = 400;
          throw err;
        }
      } else if (!dailyReady) {
        const err = new Error('ممكن تلف العجلة تاني بعد ' + Math.ceil((nextAt - new Date()) / 3600000) + ' ساعة');
        err.status = 429;
        throw err;
      }

      const slotKey = pickWeighted(basicConfig);
      const slot = basicConfig[slotKey] || {};
      const resultOut = { type: slotKey, coinsAwarded: 0, opensGift: false };
      let extraSpinDelta = usingExtraSpin ? -1 : 0;

      const updatePayload = {};
      if (!usingExtraSpin) updatePayload.wheelLastSpinAt = admin.firestore.FieldValue.serverTimestamp();

      if (slotKey === 'coin1' || slotKey === 'coin2' || slotKey === 'coin3') {
        const boosted = Math.round((slot.amount || 0) * activeBoostMultiplier(userData));
        resultOut.coinsAwarded = boosted;
        updatePayload.coins = admin.firestore.FieldValue.increment(boosted);
        updatePayload.coinsEarnedTotal = admin.firestore.FieldValue.increment(boosted);
      } else if (slotKey === 'extraSpin') {
        extraSpinDelta += 1;
      } else if (slotKey === 'gift') {
        resultOut.opensGift = true;
      }
      if (extraSpinDelta !== 0) updatePayload.wheelExtraSpins = admin.firestore.FieldValue.increment(extraSpinDelta);

      if (Object.keys(updatePayload).length) tx.update(userRef, updatePayload);

      if (resultOut.coinsAwarded) {
        const txRef = db.collection('coin_transactions').doc();
        tx.set(txRef, {
          userId: uid, type: 'earn', amount: resultOut.coinsAwarded,
          reasonAR: 'مكافأة عجلة الحظ', reasonEN: 'Fortune wheel reward',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      const spinRef = db.collection('wheel_spins').doc();
      tx.set(spinRef, {
        userId: uid, wheelType: 'basic', resultType: slotKey,
        coinsAwarded: resultOut.coinsAwarded, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return resultOut;
    });

    res.status(200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'server-error' });
  }
};
