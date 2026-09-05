// api/_firebaseAdmin.js
// تهيئة موحّدة لـ firebase-admin تُستخدم في كل الـ endpoints.
// السيرفس أكاونت مجاني تمامًا (بينزل من Firebase Console حتى على خطة Spark) —
// اللي بيتطلب Blaze هو Cloud Functions بس، مش الوصول بـ Admin SDK نفسه.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // الطريقة المضمونة: ملف الـ JSON كامل مشفّر base64 في متغير واحد —
    // مفيش أسطر جديدة ولا رموز حساسة تتكسر أثناء اللصق في Vercel
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    credential = admin.credential.cert(JSON.parse(json));
  } else {
    // طريقة بديلة (أقدم) — عرضة لمشاكل تنسيق \n لو اتلصقت غلط
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
  }
  admin.initializeApp({ credential });
}

const db = admin.firestore();

// يتحقق من ID token جاي من المتصفح (Authorization: Bearer <token>)
// ويرجع الـ uid بتاع المستخدم الحقيقي — مفيش أي طريقة للتزوير من غير
// سرقة حساب فعلي، لأن التوكن ده موقّع من Firebase نفسه.
async function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const err = new Error('unauthenticated');
    err.status = 401;
    throw err;
  }
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { admin, db, requireAuth, setCors };
