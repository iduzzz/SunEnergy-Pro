// ============================================================
// SunEnergy Pro — shtresa e të dhënave (Firebase, modular v10)
//
// RËNDËSISHËM për sigurinë e të dhënave:
//   Faza 1 (testim): COLLECTION_TX = 'transaksionet_test'
//   Koleksioni REAL 'transaksionet' NUK preket nga ky aplikacion.
//   Kalimi në të dhënat reale bëhet vetëm me aprovimin e pronarit,
//   duke ndryshuar USE_TEST_DATA në false — dhe vetëm pas backup-it.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkswebpHfdpECbsem_uqkIdtockv6I3Es",
    authDomain: "sun-energy-solution.firebaseapp.com",
    projectId: "sun-energy-solution",
    storageBucket: "sun-energy-solution.firebasestorage.app",
    messagingSenderId: "139180338088",
    appId: "1:139180338088:web:71f39a40073f14fe324b9d"
};

// gjatë Fazës 1: shkrim-lexim NË KOLEKSIONIN E TESTIT — të dhënat reale nuk preken
export const USE_TEST_DATA = true;
export const COLLECTION_TX = USE_TEST_DATA ? "transaksionet_test" : "transaksionet";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Demo mode (?demo=1): vetëm për testim vizual — pa Firebase, pa shkrim
export const DEMO = new URLSearchParams(location.search).get("demo") === "1";

export function onAuth(cb) { onAuthStateChanged(auth, cb); }
export async function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export async function logout() { return signOut(auth); }

function docId() { return "txn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11); }

// Lexo të gjitha transaksionet
export async function loadAll() {
    if (DEMO) return [];
    const snap = await getDocs(collection(db, COLLECTION_TX));
    const list = [];
    snap.forEach(d => {
        const v = d.data();
        list.push({
            id: d.id, data: v.data || "", tipi: v.tipi || "", pershkrimi: v.pershkrimi || "",
            kategoria: v.kategoria || "", shuma: parseFloat(v.shuma) || 0, timestamp: v.timestamp || ""
        });
    });
    return list;
}

// Shto ose përditëso një transaksion (sinkronizim i menjëhershëm)
export async function saveTx(tx) {
    if (DEMO) return true;
    const id = tx.id || docId();
    await setDoc(doc(db, COLLECTION_TX, id), {
        data: tx.data || "", tipi: tx.tipi || "", pershkrimi: tx.pershkrimi || "",
        kategoria: tx.kategoria || "", shuma: tx.shuma || 0,
        timestamp: tx.timestamp || new Date().toISOString()
    });
    return id;
}

// Fshi një transaksion
export async function removeTx(id) {
    if (DEMO) return true;
    await deleteDoc(doc(db, COLLECTION_TX, String(id)));
    return true;
}

export { auth };
