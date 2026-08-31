// api/spinGiftWheel.js
// POST /api/spinGiftWheel
// بيتنفذ لما الطالب ياخد "هدية" من العجلة الأساسية — نفس منطق spinGiftWheel
// الأصلي بس كله على السيرفر.

const { admin, db, requireAuth, setCors } = require('./_firebaseAdmin');

const DEFAULT_WHEEL_GIFT = {
  promonth: { months: 1, weight: 10 },
  tempfeature: { hours: 24, featureAR: 'مكتبة GIS الرقمية كاملة', featureEN: 'Full digital GIS library', weight: 25 },
  discount: { percent: 10, requiredMonths: 6, validDays: 14, weight: 35 },
  boost: { multiplier: 2, hours: 24, weight: 30 },
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

function generateDiscountCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'ATLAS-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = async (req, res) => {
  setCors(res); // '*' — الحماية الحقيقية هي requireAuth() (التوكن)، مش مصدر الطلب
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  try {
    const uid = await requireAuth(req);
    const userRef = db.collection('users').doc(uid);

    const settingsSnap = await db.collection('settings').doc('wheel').get();
    const s = settingsSnap.exists ? settingsSnap.data() : {};
    const giftConfig = { ...DEFAULT_WHEEL_GIFT, ...(s.gift || {}) };

    const slotKey = pickWeighted(giftConfig);
    const slot = giftConfig[slotKey] || {};
    const result = { type: slotKey };

    if (slotKey === 'promonth') {
      const months = slot.months || 1;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() || {};
        let base = new Date();
        if (data.plan === 'pro' && data.proExpiresAt) {
          const cur = data.proExpiresAt.toDate();
          if (cur > base) base = cur;
        }
        const newExpiry = new Date(base);
        newExpiry.setMonth(newExpiry.getMonth() + months);
        const payload = { plan: 'pro', proExpiresAt: admin.firestore.Timestamp.fromDate(newExpiry) };
        if (data.plan !== 'pro') payload.proStartAt = admin.firestore.FieldValue.serverTimestamp();
        tx.update(userRef, payload);
      });
      result.months = months;

    } else if (slotKey === 'tempfeature') {
      const hours = slot.hours || 24;
      const expiresAt = new Date(Date.now() + hours * 3600000);
      await userRef.update({
        tempProFeature: {
          featureAR: slot.featureAR || '', featureEN: slot.featureEN || '',
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        },
      });
      result.featureAR = slot.featureAR; result.featureEN = slot.featureEN; result.hours = hours;

    } else if (slotKey === 'discount') {
      const code = generateDiscountCode();
      const expiresAt = new Date(Date.now() + (slot.validDays || 14) * 86400000);
      await db.collection('discount_codes').doc(code).set({
        code, userId: uid, percent: slot.percent || 10, requiredMonths: slot.requiredMonths || 6,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), used: false,
      });
      result.code = code; result.percent = slot.percent || 10;
      result.requiredMonths = slot.requiredMonths || 6; result.expiresAt = expiresAt.toISOString();

    } else if (slotKey === 'boost') {
      const hours = slot.hours || 24;
      const expiresAt = new Date(Date.now() + hours * 3600000);
      await userRef.update({
        coinBoost: { multiplier: slot.multiplier || 2, expiresAt: admin.firestore.Timestamp.fromDate(expiresAt) },
      });
      result.multiplier = slot.multiplier || 2; result.hours = hours;
    }

    await db.collection('wheel_spins').add({
      userId: uid, wheelType: 'gift', resultType: slotKey, extra: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'server-error' });
  }
};
