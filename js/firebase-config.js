import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD04f0gD1D_N_ofIcvx5y0-T1KJ7Dp-n08",
  authDomain: "greenthumb-ea1d0.firebaseapp.com",
  projectId: "greenthumb-ea1d0",
  storageBucket: "greenthumb-ea1d0.firebasestorage.app",
  messagingSenderId: "976985468622",
  appId: "1:976985468622:web:9208bf9212d036da3daa9f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);