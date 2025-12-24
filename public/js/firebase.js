// public/js/firebase.js — Firebase CDN setup (no npm needed)

// Import Firebase modules via CDN
const firebaseApp = firebase.initializeApp({
  apiKey: "AIzaSyCfJMRpAnJB9OJTP5fzbGD0I3cmU_PfVKM",
  authDomain: "braviem.firebaseapp.com",
  projectId: "braviem",
  storageBucket: "braviem.firebasestorage.app",
  messagingSenderId: "909734678330",
  appId: "1:909734678330:web:edc9798f3d19a2030c4a03",
  measurementId: "G-0YMF3NR7KX"
});

const auth = firebase.auth();