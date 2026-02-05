// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDv6Lo9QYB83BrQPBAmC73qGuKqXbNFTf",
  authDomain: "unionpointpay-d0104.firebaseapp.com",
  projectId: "unionpointpay-d0104",
  storageBucket: "unionpointpay-d0104.appspot.com",
  messagingSenderId: "565612910207",
  appId: "1:565612910207:web:dc57a7fd32c8e8b625c1ca"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
