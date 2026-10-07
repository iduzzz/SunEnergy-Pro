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
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkswebpHfdpECbsem_uqkIdtockv6I3Es",
    authDomain: "sun-energy-solution.firebaseapp.com",
    projectId: "sun-energy-solution",
    storageBucket: "sun-energy-solution.firebasestorage.app",
    messagingSenderId: "139180338088",
    appId: "1:139180338088:web:71f39a40073f14fe324b9d"
};

// KALIMI U CRONUA (Faza 3): aplikacioni tani punon me koleksionin REAL.
// Për ta kthyer përsëri në test: USE_TEST_DATA = true
export const USE_TEST_DATA = false;
export const COLLECTION_TX = USE_TEST_DATA ? "transaksionet_test" : "transaksionet";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// FIREBASE APP CHECK — mbrojtje shtesë kundër trafikut jashtë aplikacioneve tuaja.
// Për ta aktivizuar: (1) krijoni një çelës reCAPTCHA v3 në Google Cloud me
//     domenat: sunenergypro.vercel.app + localhost
// (2) regjistrojeni te Firebase Console → App Check → Apps
// (3) ngjitni çelësin e faqes më poshtë (SITE_KEY) dhe bëni deploy
// Derisa SITE_KEY është bosh, App Check nuk aktivizohet dhe asgjë s'preket.
// ============================================================
const APPCHECK_SITE_KEY = "";
if (APPCHECK_SITE_KEY) {
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true
    });
}

// Demo mode (?demo=1): vetëm për testim vizual — pa Firebase, pa shkrim
export const DEMO = new URLSearchParams(location.search).get("demo") === "1";

export function onAuth(cb) { onAuthStateChanged(auth, cb); }
export async function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export async function logout() { return signOut(auth); }
export async function sendReset(email) { return sendPasswordResetEmail(auth, email); }

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

// Kategoritë e shpenzimeve — një dokument i vetëm: kategorite/shpenzimet
export async function loadCategories() {
    if (DEMO) return null;
    const d = await getDoc(doc(db, "kategorite", "shpenzimet"));
    return d.exists() ? (d.data().list || null) : null;
}
export async function saveCategoriesFirestore(list) {
    if (DEMO) return true;
    await setDoc(doc(db, "kategorite", "shpenzimet"), { list });
    return true;
}

export { auth };
