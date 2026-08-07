// shared/firebase-config.js
//
// Firebase console > Project settings > General > "Your apps" > Web app
// (create one if you haven't). These values are meant to be public/client-side
// — Firebase's security model relies on Firestore/Realtime DB rules and App
// Check, not on hiding this config — so it's fine for this file to ship as-is
// to the browser. This is separate from the FIREBASE_SERVICE_ACCOUNT_BASE64
// value in the backend's .env, which IS a secret and must never appear here.
//
// The VAPID key is under Project settings > Cloud Messaging > Web configuration
// > "Web Push certificates" > Generate key pair.
// Works in both contexts: a normal page (where `window` exists) and inside
// firebase-messaging-sw.js (a service worker, where `self` is the global and
// `window` is undefined — assigning to `window` there would throw).
(typeof window !== 'undefined' ? window : self).TravelBuddyFirebaseConfig = {
  apiKey: 'AIzaSyCbqWF04CH3sW2lM26MmhhJF-uwlohGgv8',
  authDomain: 'travalbuddy.firebaseapp.com',
  projectId: 'travalbuddy',
  storageBucket: 'travalbuddy.firebasestorage.app',
  messagingSenderId: '268106005436',
  appId: '1:268106005436:web:c6cb7f02046f3f823989b9',
  vapidKey: '',
};
