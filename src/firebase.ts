import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC1-Y4aFdGYWOayGFETbi9PNO6pp04hSB8",
  authDomain: "escudo-driver.firebaseapp.com",
  databaseURL: "https://escudo-driver-default-rtdb.firebaseio.com",
  projectId: "escudo-driver",
  storageBucket: "escudo-driver.firebasestorage.app",
  messagingSenderId: "470154175918",
  appId: "1:470154175918:web:0cc928d7877135028f943f"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);