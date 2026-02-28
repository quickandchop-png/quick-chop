import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1l_PgYyod6Wlgq3ExnwTwsZbVEn4rdYE",
  authDomain: "quickandchop-b9b4e.firebaseapp.com"
  projectId: "quickandchop-b9b4e",
  storageBucket: "quickandchop-b9b4e.firebasestorage.app",
  messagingSenderId: "819695394751",
  storageBucket: "quickandchop-b9b4e.firebasestorage.app"
  messagingSenderId: "819695394751",
  appId: "1:819695394751:web:38e7f598bfc5e87b1d4b0a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
