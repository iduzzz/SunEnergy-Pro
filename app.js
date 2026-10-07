// ============================================================
// SunEnergy Pro — logjika e aplikacionit (Faza 1)
// Logjika financiare është identike me aplikacionin e vjetër:
//   Fitimi Neto = Shitje − Shpenzime
//   Pjesa e ortakut = 50% Fitimi Neto + 50% Të Ardhura − Tërheqje + Investim
// ============================================================
import { onAuth, login, logout, sendReset, loadAll, saveTx, removeTx, loadCategories, saveCategoriesFirestore, DEMO, USE_TEST_DATA, COLLECTION_TX } from "./firebase.js";

const CATEGORIES = ["Mirembajtja e Llogarise", "Harxhim per rryme", "Akontacion", "Tatim TVSH", "Provizion per kredi",
    "Kesti per kredi", "Rroga per puntore", "Rroga Zudi", "Kontabilitet", "Sigurimi i objektit", "Telekom internet",
    "Tatim mbi pronen", "Mirembajtja e fotovoltaikeve Martin (mujore)", "Servisim i fotovoltaikeve (Martin)",
    "Starlink internet mujor", "Sterpikje sezonale per barin", "Blerje pjese rezerve", "Mirembajtja e fotovolltaikeve",
    "Firmarina (harxhim per kompanin) 1 her ne vit", "Avokat dhe Noter", "Te tjera"];

const TIP = {
    "Shitje":        { e: "💰", c: "#0b7c56", bg: "#e6f6f0" },
    "Të Ardhura":    { e: "🏦", c: "#0b7c56", bg: "#e6f6f0" },
    "Shpenzim":      { e: "🔋", c: "#dc2626", bg: "#fdecec" },
    "Tërheqje":      { e: "💸", c: "#7c3aed", bg: "#f3e8ff" },
    "Investim":      { e: "💼", c: "#0891b2", bg: "#e0f2fe" },
    "Huamarrje":     { e: "🤝", c: "#d97706", bg: "#fef3c7" },
    "Kthim i Huasë": { e: "💳", c: "#d97706", bg: "#fef3c7" },
    "Kapital":       { e: "⚪", c: "#6b7280", bg: "#f3f4f6" }
};

const ADD_TYPES = [
    { key: "shitje",       tipi: "Shitje",        lbl: "💰 Shitje" },
    { key: "te-ardhura",   tipi: "Të Ardhura",    lbl: "🏦 Të Ardhura" },
    { key: "shpenzim",     tipi: "Shpenzim",      lbl: "🔋 Shpenzim" },
    { key: "terheqje",     tipi: "Tërheqje",      lbl: "💸 Tërheqje" },
    { key: "investim",     tipi: "Investim",      lbl: "💼 Investim" },
    { key: "huamarrje",    tipi: "Huamarrje",     lbl: "🤝 Huamarrje" },
    { key: "kthim-huase",  tipi: "Kthim i Huasë", lbl: "💳 Kthim i Huasë" }
];

const PARTNER_INVEST = { Nexha: "Toyota", Gresa: "Mercedes" };

const TABS = {
    paneli:  { t: "Paneli",        s: "Pasqyra financiare",  ic: "📊" },
    trans:   { t: "Transaksionet", s: "Të gjitha lëvizjet",  ic: "📄" },
    raporte: { t: "Raporte",       s: "Raportet financiare", ic: "📈" },
    menu:    { t: "Më shumë",      s: "Vegla dhe raporte",   ic: "☰" }
};

// Pamjet e raporteve (hapen mbi skedat, me buton prapa)
const VIEWS = {
    raporteMujore: { t: "Raporte Mujore",     s: "Zgjidh muajin" },
    mujor:         { t: "Detaje mujore",      s: "" },
    raporteVjetor: { t: "Raporti Vjetor",     s: "Përmbledhja e vitit" },
    pasqyraFin:    { t: "Pasqyra Financiare", s: "Raporti financiar" },
    pasqyraOrtaku: { t: "Pasqyra e Ortakut",  s: "" },
    kategorite:    { t: "Menaxho Kategoritë", s: "Shpenzimet",    ic: "🗂️" },
    historiku:     { t: "Historiku",          s: "Ndryshimet e fundit", ic: "🕘" },
    typeDetail:    { t: "Detajet",            s: "",               ic: "📄" },
    katDetail:     { t: "Kategoria",          s: "",               ic: "📂" },
    summary:       { t: "Përmbledhje",        s: "",               ic: "📋" },
    summaryMonth:  { t: "Përmbledhje mujore", s: "",               ic: "📅" },
    katMonth:      { t: "Kategoria",          s: "",               ic: "📂" },
    typeYear:      { t: "Detajet",            s: "",               ic: "📅" },
    katYear:       { t: "Kategoria",          s: "",               ic: "📅" },
    fitimiView:    { t: "Fitimi Neto",        s: "",               ic: "📈" }
};

function friendlyError(e) {
    const map = {
        "permission-denied": "Nuk ka leje: rregullat e Firebase-s s'përfshijnë koleksionin e testit. Shto rregullin 'transaksionet_test' te Firestore → Rules (udhëzimet te zhvilluesi).",
        "unavailable": "Nuk ka lidhje me internetin.",
        "failed-precondition": "Firebase nuk është i disponueshëm. Provo më vonë."
    };
    return e && map[e.code] ? map[e.code] : (e && e.message ? e.message : String(e));
}
const fmt = n => (n || 0).toLocaleString("mk-MK", { minimumFractionDigits: 2 });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isoToDisplay = iso => { const p = iso.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso; };

const S = {
    user: null, tx: [], tab: "paneli", year: String(new Date().getFullYear()),
    month: "", type: "", search: "", limit: 30, chart: null, loading: false,
    view: null, viewMonth: null, viewPartner: null, viewStack: [],
    viewSummary: null, viewSummaryMonth: null,
    viewKatMonth: null, viewTypeYear: null, viewKatYear: null,
    categories: [], log: []
};

// ============================================================ UI ndihmës
const UI = {
    toast(msg, err) {
        const t = document.getElementById("toast");
        t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
        clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", 2600);
    },
    openSheet() { document.getElementById("add-sheet").classList.add("open"); document.getElementById("sheet-bg").classList.add("open"); },
    closeSheet() { document.getElementById("add-sheet").classList.remove("open"); document.getElementById("sheet-bg").classList.remove("open"); },
    openForm(tipi, tx) {
        const def = ADD_TYPES.find(a => a.tipi === tipi);
        document.getElementById("form-title").textContent = (tx ? "Edito: " : "") + def.lbl.replace(/^\S+\s/, "");
        document.getElementById("f-id").value = tx ? tx.id : "";
        const isPartner = tipi === "Tërheqje" || tipi === "Investim";
        const isExpense = tipi === "Shpenzim";
        const sign = (tipi === "Shpenzim" || tipi === "Tërheqje") ? -1 : 1;
        const v = tx || {};
        document.getElementById("form-fields").innerHTML = `
            <label>Data</label>
            <input type="date" id="f-data" value="${v.data ? (v.data.split("-").reverse().join("-")) : todayISO()}" required>
            ${isPartner ? `<label>Ortaku</label>
            <select id="f-ortaku">
                <option value="Nexha" ${v.kategoria === "Nexha" ? "selected" : ""}>Nexha</option>
                <option value="Gresa" ${v.kategoria === "Gresa" ? "selected" : ""}>Gresa</option>
            </select>` : ""}
            <label>${isPartner ? "Arsyeja" : "Përshkrimi"}</label>
            <input type="text" id="f-pershkrimi" value="${esc(v.pershkrimi || "")}" ${tipi === "Shitje" || tipi === "Shpenzim" ? "required" : ""} placeholder="${isPartner ? "p.sh. Kthim i investimit" : "Përshkrim"}">
            ${isExpense ? `<label>Kategoria</label>
            <select id="f-kategoria">${S.categories.map(k => `<option ${v.kategoria === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>` : ""}
            <label>Shuma (MKD)${sign < 0 ? " — do të regjistrohet negative" : ""}</label>
            <input type="number" step="0.01" id="f-shuma" value="${v.shuma ? Math.abs(v.shuma) : ""}" required>`;
        document.getElementById("form-sheet").classList.add("open");
        document.getElementById("sheet-bg").classList.add("open");
        document.getElementById("form-sheet").dataset.tipi = tipi;
        document.getElementById("form-sheet").dataset.sign = sign;
    },
    closeForm() {
        document.getElementById("form-sheet").classList.remove("open");
        document.getElementById("sheet-bg").classList.remove("open");
        document.getElementById("tx-form").reset();
    }
};
window.UI = UI;

// ============================================================ Llogaritjet (të njëjtat si në aplikacionin e vjetër)
function stats(year) {
    const ts = S.tx.filter(t => { const p = String(t.data || "").split("-"); return p.length === 3 && (!year || p[2] === year); });
    const sum = tip => ts.filter(t => t.tipi === tip).reduce((s, t) => s + t.shuma, 0);
    const shitje = sum("Shitje"), teArdhura = sum("Të Ardhura");
    const shpenzime = Math.abs(sum("Shpenzim"));
    const fitimi = shitje - shpenzime;
    const thN = Math.abs(ts.filter(t => t.tipi === "Tërheqje" && t.kategoria === "Nexha").reduce((s, t) => s + t.shuma, 0));
    const thG = Math.abs(ts.filter(t => t.tipi === "Tërheqje" && t.kategoria === "Gresa").reduce((s, t) => s + t.shuma, 0));
    const inN = ts.filter(t => t.tipi === "Investim" && t.kategoria === "Nexha").reduce((s, t) => s + t.shuma, 0);
    const inG = ts.filter(t => t.tipi === "Investim" && t.kategoria === "Gresa").reduce((s, t) => s + t.shuma, 0);
    const pjesa = (th, inv) => (fitimi / 2) + (teArdhura / 2) - th + inv;
    return { ts, shitje, teArdhura, shpenzime, fitimi, thN, thG, inN, inG, pN: pjesa(thN, inN), pG: pjesa(thG, inG) };
}

function years() {
    const set = new Set([String(new Date().getFullYear())]);
    S.tx.forEach(t => { const p = String(t.data || "").split("-"); if (p.length === 3) set.add(p[2]); });
    return Array.from(set).sort().reverse();
}

// ============================================================ Renderuesit
function card(lbl, val, color) {
    return `<div class="card"><div class="lbl">${lbl}</div><div class="val" style="color:${color}">${fmt(val)} MKD</div></div>`;
}
function partnerRow(name, val, sub) {
    const color = val >= 0 ? "pos" : "neg";
    return `<button class="row-card" onclick="App.openStatement('${name}')">
        <div class="row-ic" style="background:#eef2ff">👩</div>
        <div class="row-tx"><b>${name}</b><span>${sub}</span></div>
        <div class="row-val ${color}">${fmt(val)} MKD</div></button>`;
}

function rPaneli(st) {
    const ccard = (lbl, val, color, fn) => `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit" onclick="${fn}">
        <div class="lbl">${lbl}</div><div class="val" style="color:${color}">${fmt(val)} MKD</div></button>`;
    let h = `<div class="sec-title">📅 Periudha: ${esc(S.year || "Të gjitha vitet")}</div><div class="grid2">`;
    h += ccard("SHITJET", st.shitje, st.shitje >= 0 ? "var(--green-d)" : "var(--red)", "App.openTypeView('Shitje')");
    h += ccard("TË ARDHURA NGA DEPOZITI BANKAR", st.teArdhura, "var(--green-d)", "App.openTypeView('Të Ardhura')");
    h += ccard("SHPENZIMET", st.shpenzime, "var(--red)", "App.openTypeView('Shpenzim')");
    h += ccard("FITIMI NETO", st.fitimi, st.fitimi >= 0 ? "var(--green-d)" : "var(--red)", "App.openView('fitimiView')");
    h += `</div><div class="sec-title">👥 GJENDJA E ORTAKËVE</div>`;
    h += partnerRow("Nexha", st.pN, "50% partneritet — kliko për pasqyrën");
    h += partnerRow("Gresa", st.pG, "50% partneritet — kliko për pasqyrën");
    h += `<div class="sec-title">💼 TËRHEQJET & INVESTIMET</div><div class="grid2">`;
    h += ccard("TËRHEQJET NEXHA", st.thN, "var(--purple)", "App.openTypeView('Tërheqje', 'Nexha')");
    h += ccard("TËRHEQJET GRESA", st.thG, "var(--purple)", "App.openTypeView('Tërheqje', 'Gresa')");
    h += ccard("NEXHA KA DHANË PËR TOYOTA", st.inN, "var(--blue)", "App.openTypeView('Investim', 'Nexha')");
    h += ccard("GRESA KA DHANË PËR MERCEDES", st.inG, "var(--blue)", "App.openTypeView('Investim', 'Gresa')");
    h += `</div><div class="chart-card"><h3>Hyrje vs Dalje</h3><div class="sub">${esc(S.year || "Të gjitha vitet")}</div>
          <div class="chart-box"><canvas id="chart"></canvas></div></div>`;
    return h;
}

function drawChart(year) {
    const cv = document.getElementById("chart");
    if (!cv || typeof Chart === "undefined") return;
    const sales = new Array(12).fill(0), expenses = new Array(12).fill(0);
    S.tx.forEach(t => {
        const p = String(t.data || "").split("-");
        if (p.length !== 3 || (year && p[2] !== year)) return;
        const m = parseInt(p[1], 10) - 1;
        if (!(m >= 0 && m < 12)) return;
        if (t.tipi === "Shitje" || t.tipi === "Të Ardhura") sales[m] += t.shuma;
        else if (t.tipi === "Shpenzim") expenses[m] += Math.abs(t.shuma);
    });
    if (S.chart) { try { S.chart.destroy(); } catch (e) {} S.chart = null; }
    S.chart = new Chart(cv.getContext("2d"), {
        type: "line",
        data: { labels: ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"],
                datasets: [
                    { label: "Hyrje", data: sales, borderColor: "#0e9f6e", backgroundColor: "rgba(14,159,110,0.10)", fill: true, tension: 0.35, pointRadius: 2 },
                    { label: "Dalje", data: expenses, borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)", fill: true, tension: 0.35, pointRadius: 2 }
                ] },
        options: { responsive: true, maintainAspectRatio: false,
                   plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
                   scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } }
    });
}

function filtered() {
    const q = S.search.toLowerCase();
    let list = S.tx.filter(t => {
        const p = String(t.data || "").split("-");
        if (p.length !== 3 || (S.year && p[2] !== S.year)) return false;
        if (S.month && p[1] !== S.month) return false;
        if (S.type && t.tipi !== S.type) return false;
        if (q) { const hay = ((t.pershkrimi || "") + " " + (t.kategoria || "")).toLowerCase(); if (!hay.includes(q)) return false; }
        return true;
    });
    list.sort((a, b) => {
        const pa = String(a.data || "").split("-"), pb = String(b.data || "").split("-");
        const da = new Date(pa[2], pa[1] - 1, pa[0]).getTime() || 0;
        const db = new Date(pb[2], pb[1] - 1, pb[0]).getTime() || 0;
        return db - da;
    });
    return list;
}

function txCard(t) {
    const meta = TIP[t.tipi] || { e: "💸", c: "#374151", bg: "#f3f4f6" };
    const amt = t.shuma >= 0 ? "+" + fmt(t.shuma) : "-" + fmt(Math.abs(t.shuma));
    const id = esc(t.id);
    return `<div class="tx-card" onclick="App.toggleTx(this)">
        <div class="row-ic" style="background:${meta.bg}">${meta.e}</div>
        <div class="tx-tx"><b>${esc(t.pershkrimi || t.tipi)}</b>
        <div class="tx-meta">${esc(t.data)}<span class="chip" style="background:${meta.bg};color:${meta.c}">${esc(t.kategoria || t.tipi)}</span></div></div>
        <div class="row-val ${t.shuma >= 0 ? "pos" : "neg"}">${amt} MKD</div>
        <div class="tx-actions">
            <button class="ed" onclick="event.stopPropagation(); App.editTx('${id}')">✏️</button>
            <button class="de" onclick="event.stopPropagation(); App.deleteTx('${id}')">🗑️</button>
        </div></div>`;
}

function rTrans() {
    const list = filtered();
    let h = `<div class="filters">
        <select onchange="App.setType(this.value)"><option value="">Të gjitha tipet</option>` +
        Object.keys(TIP).map(t => `<option ${S.type === t ? "selected" : ""}>${esc(t)}</option>`).join("") + `</select>
        <select onchange="App.setMonth(this.value)"><option value="">Të gjithë muajt</option>` +
        ["01 Janar", "02 Shkurt", "03 Mars", "04 Prill", "05 Maj", "06 Qershor", "07 Korrik", "08 Gusht", "09 Shtator", "10 Tetor", "11 Nëntor", "12 Dhjetor"]
            .map(m => `<option value="${m.slice(0, 2)}" ${S.month === m.slice(0, 2) ? "selected" : ""}>${m.slice(3)}</option>`).join("") + `</select>
        <input type="search" placeholder="🔍 Kërko..." value="${esc(S.search)}" oninput="App.setSearch(this.value)">
    </div><div class="count-line" id="count-line">${list.length} TRANSAKSIONE</div><div id="tx-list"></div>`;
    return h;
}

function fillTxList() {
    const list = filtered();
    const cl = document.getElementById("count-line");
    if (cl) cl.textContent = list.length + " TRANSAKSIONE";
    document.getElementById("tx-list").innerHTML = (list.length
        ? list.slice(0, S.limit).map(txCard).join("")
        : '<div class="empty">Nuk ka transaksione për këtë periudhë.</div>')
        + (list.length > S.limit ? `<button class="load-more" onclick="App.more()">Shfaq më shumë (${list.length - S.limit} të tjera)</button>` : "");
}

const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];

function monthData(year) {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const ts = S.tx.filter(t => { const p = String(t.data || "").split("-"); return p.length === 3 && (!year || p[2] === year) && p[1] === mm; });
        const shitje = ts.filter(t => t.tipi === "Shitje").reduce((s, t) => s + t.shuma, 0);
        const teArdhura = ts.filter(t => t.tipi === "Të Ardhura").reduce((s, t) => s + t.shuma, 0);
        const shpenzime = Math.abs(ts.filter(t => t.tipi === "Shpenzim").reduce((s, t) => s + t.shuma, 0));
        arr.push({ m: mm, name: MONTHS[m - 1] + (year ? " " + year : ""), shitje, teArdhura, shpenzime, fitimi: shitje - shpenzime, ts });
    }
    return arr;
}

function rRaporte() {
    const item = (ic, t, s, fn) => `<button class="row-card" onclick="${fn}"><div class="row-ic" style="background:#e6f6f0">${ic}</div><div class="row-tx"><b>${t}</b><span>${s}</span></div><div class="row-val" style="color:#9ca3af;font-size:18px">›</div></button>`;
    let h = `<div class="sec-title">📊 RAPORTE</div>`;
    h += item("📅", "Raporte Mujore", "Shitje & shpenzime për 12 muaj", "App.openView('raporteMujore')");
    h += item("📈", "Raporti Vjetor", "Përmbledhje + analiza mujore", "App.openView('raporteVjetor')");
    h += item("📊", "Pasqyra Financiare", "Raporti financiar i plotë", "App.openView('pasqyraFin')");
    h += `<div class="sec-title">👥 PASQYRA E ORTAKËVE</div>`;
    h += item("👩", "Pasqyra e Nexha", "Bilanci final për periudhën", "App.openStatement('Nexha')");
    h += item("👩", "Pasqyra e Gresa", "Bilanci final për periudhën", "App.openStatement('Gresa')");
    return h;
}

function rMujoreList() {
    const months = monthData(S.year);
    let h = `<div class="sec-title">📅 Viti: ${esc(S.year)}</div>`;
    months.forEach(mo => {
        const fitCls = mo.fitimi >= 0 ? "pos" : "neg";
        h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:10px" onclick="App.openMonth('${mo.m}')">
            <div style="font-size:14px;font-weight:800;margin-bottom:8px">🗓️ ${esc(mo.name)}</div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--muted)">Shitje:</span><b class="pos">${fmt(mo.shitje)} MKD</b></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--muted)">Shpenzime:</span><b class="neg">${fmt(mo.shpenzime)} MKD</b></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="color:var(--muted)">Fitimi:</span><b class="${fitCls}">${fmt(mo.fitimi)} MKD</b></div>
            <div style="font-size:11px;color:var(--muted)">📊 ${mo.ts.length} transaksione • Kliko për detaje</div>
        </button>`;
    });
    return h;
}

function rMujorDetail() {
    const mo = S.viewMonth;
    if (!mo) return "";
    let h = `<div class="card" style="background:#f0fdf6;border-color:#cdeeda;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">TOTALI I SHITJEVE</span><b class="pos">${fmt(mo.shitje)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">TOTALI I SHPENZIMEVE</span><b class="neg">${fmt(mo.shpenzime)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">FITIMI BRUTO</span><b class="${mo.fitimi >= 0 ? "pos" : "neg"}">${fmt(mo.fitimi)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">TRANSAKSIONE</span><b>${mo.ts.length}</b></div>
    </div>`;
    // përmbledhja sipas kategorive — klikueshme
    const katMap = {};
    mo.ts.filter(t => t.tipi === "Shpenzim").forEach(t => {
        const k = t.kategoria || "Te tjera";
        katMap[k] = (katMap[k] || 0) + Math.abs(t.shuma);
    });
    const katList = Object.entries(katMap).sort((a, b) => b[1] - a[1]);
    if (katList.length) {
        h += `<div class="sec-title">📂 HARXHIMET SIPAS KATEGORIVE — kliko për detaje</div>`;
        katList.forEach(([k, v]) => {
            const escK = esc(k).replace(/'/g, "\\'");
            h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openKatMonth('${escK}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:13px;font-weight:700">📂 ${esc(k)}</div>
                    <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="neg">−${fmt(v)} MKD</div>
                    <div style="font-size:11px;color:var(--muted)">${mo.shpenzime > 0 ? ((v / mo.shpenzime) * 100).toFixed(1) : "0.0"}% e harxhimeve</div></div>
                </div>
            </button>`;
        });
        h += `<div class="sec-title">📄 TË GJITHA TRANSAKSIONET E MUAJIT</div>`;
    }
    h += `<button class="load-more" onclick="App.exportMonth()">📄 Eksporto muajin në Excel (CSV)</button>`;
    h += mo.ts.length ? mo.ts.map(txCard).join("") : `<div class="empty">Nuk ka transaksione këtë muaj.</div>`;
    return h;
}

function rKatMonth() {
    const vm = S.viewKatMonth;
    if (!vm) return "";
    const total = vm.ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI — ${esc(vm.monthName)}</div>
        <div style="font-size:20px;font-weight:800" class="neg">−${fmt(total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${vm.ts.length} harxhime</div>
    </div>`;
    h += `<button class="load-more" onclick="App.exportKatMonth()">📄 Eksporto në Excel (CSV)</button>`;
    h += vm.ts.length ? vm.ts.map(txCard).join("") : `<div class="empty">Nuk ka harxhime.</div>`;
    return h;
}

function rVjetor(st) {
    const ccard = (lbl, val, color, fn) => `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit" onclick="${fn}">
        <div class="lbl">${lbl}</div><div class="val" style="color:${color}">${fmt(val)} MKD</div></button>`;
    let h = `<div class="sec-title">📊 PËRMBLEDHJA — ${esc(S.year || "Të gjitha vitet")}</div><div class="grid2">`;
    h += ccard("SHITJET", st.shitje, "var(--green-d)", "App.openTypeView('Shitje')");
    h += ccard("TË ARDHURA NGA DEPOZITI BANKAR", st.teArdhura, "var(--green-d)", "App.openTypeView('Të Ardhura')");
    h += ccard("SHPENZIMET", st.shpenzime, "var(--red)", "App.openTypeView('Shpenzim')");
    h += ccard("FITIMI NETO", st.fitimi, st.fitimi >= 0 ? "var(--green-d)" : "var(--red)", "App.openView('fitimiView')");
    h += ccard("INVESTIMET", st.inN + st.inG, "var(--blue)", "App.openSummary('investim')");
    h += ccard("TËRHEQJET", st.thN + st.thG, "var(--purple)", "App.openSummary('terheqje')");
    h += `</div>`;
    h += `<button class="load-more" onclick="App.exportVjetor()">📄 Eksporto në Excel (CSV)</button>`;
    h += `<p class="note">📅 Analiza mujore e gjen te: Raporte → Raporte Mujore</p>`;
    return h;
}

// përmbledhje mujore për një tip (investim/tërheqje) + ortak opsional
function summaryList(kind, partner) {
    const tipi = kind === "terheqje" ? "Tërheqje" : "Investim";
    const arr = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const ts = S.tx.filter(t => {
            const p = String(t.data || "").split("-");
            return p.length === 3 && (!S.year || p[2] === S.year) && p[1] === mm
                && t.tipi === tipi && (!partner || t.kategoria === partner);
        });
        arr.push({ m: mm, name: MONTHS[m - 1], ts, total: ts.reduce((s, t) => s + Math.abs(t.shuma), 0) });
    }
    return arr;
}

function rSummary() {
    const { kind, partner } = S.viewSummary;
    const rows = summaryList(kind, partner);
    const total = rows.reduce((s, r) => s + r.total, 0);
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI — ${esc(S.year || "Të gjitha vitet")}</div>
        <div style="font-size:20px;font-weight:800" class="${kind === "terheqje" ? "neg" : "pos"}">${kind === "terheqje" ? "−" : "+"}${fmt(total)} MKD</div>
    </div>`;
    const st = stats(S.year);
    if (kind === "terheqje" && !partner) {
        h += `<div class="sec-title">👥 SIPAS ORTAKËVE — kliko për mujore</div>`;
        [["Nexha", st.thN], ["Gresa", st.thG]].forEach(([p, v]) => {
            h += `<button class="row-card" onclick="App.openSummary('terheqje', '${p}')">
                <div class="row-ic" style="background:#f3e8ff">👩</div>
                <div class="row-tx"><b>${p}</b><span>Tërheqjet mujore</span></div>
                <div class="row-val neg">−${fmt(v)} MKD</div></button>`;
        });
    }
    h += `<div class="sec-title">📅 MUJ PËR MUAJ — kliko për detaje</div>`;
    rows.filter(r => r.ts.length).forEach(r => {
        h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openSummaryMonth('${r.m}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:13px;font-weight:800">📅 ${esc(r.name)}</div>
                <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="${kind === "terheqje" ? "neg" : "pos"}">${kind === "terheqje" ? "−" : "+"}${fmt(r.total)} MKD</div>
                <div style="font-size:11px;color:var(--muted)">${r.ts.length} transaksione</div></div>
            </div>
        </button>`;
    });
    if (!rows.some(r => r.ts.length)) h += `<div class="empty">Nuk ka transaksione për këtë periudhë.</div>`;
    return h;
}

function rSummaryMonth() {
    const { kind, partner } = S.viewSummary;
    const r = summaryList(kind, partner).find(x => x.m === S.viewSummaryMonth);
    if (!r) return "";
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">${esc(r.name.toUpperCase())}</div>
        <div style="font-size:20px;font-weight:800" class="${kind === "terheqje" ? "neg" : "pos"}">${kind === "terheqje" ? "−" : "+"}${fmt(r.total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${r.ts.length} transaksione</div>
    </div>`;
    h += r.ts.length ? r.ts.map(txCard).join("") : `<div class="empty">Nuk ka transaksione.</div>`;
    return h;
}

// ============================================================ App — veprimet

function rFinanciar(st) {
    const katMap = {};
    st.ts.filter(t => t.tipi === "Shpenzim").forEach(t => {
        const k = t.kategoria || "Te tjera";
        katMap[k] = (katMap[k] || 0) + Math.abs(t.shuma);
    });
    const katList = Object.entries(katMap).sort((a, b) => b[1] - a[1]);
    const ccard = (lbl, val, color, fn) => `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit" onclick="${fn}">
        <div class="lbl">${lbl}</div><div class="val" style="color:${color}">${fmt(val)} MKD</div></button>`;
    let h = `<div class="sec-title">📊 RAPORTI FINANCIAR — ${esc(S.year || "Të gjitha vitet")}</div><div class="grid2">`;
    h += ccard("SHITJET", st.shitje, "var(--green-d)", "App.openTypeView('Shitje')");
    h += ccard("HARXHIMET", st.shpenzime, "var(--red)", "App.openTypeView('Shpenzim')");
    h += ccard("FITIMI " + (st.fitimi >= 0 ? "POZITIV ✓" : "NEGATIV ⚠"), st.fitimi, st.fitimi >= 0 ? "var(--green-d)" : "var(--red)", "App.openView('fitimiView')");
    h += ccard("TË ARDHURA NGA DEPOZITI", st.teArdhura, "var(--blue)", "App.openTypeView('Të Ardhura')");
    h += `</div>`;
    h += `<button class="load-more" onclick="App.exportFinanciar()">📄 Eksporto në Excel (CSV)</button>`;
    h += `<div class="sec-title">👥 TËRHEQJET & INVESTIMET SIPAS ORTAKËVE</div>`;
    const ort = (ic, lbl, sub, val, cls, fn) => `<button class="row-card" onclick="${fn}">
        <div class="row-ic" style="background:#f3e8ff">${ic}</div>
        <div class="row-tx"><b>${lbl}</b><span>${sub} — kliko për mujore</span></div>
        <div class="row-val ${cls}">${val} MKD</div></button>`;
    h += ort("💸", "Tërheqjet e Nexha", "Muj-për-muaj", fmt(st.thN), "neg", "App.openSummary('terheqje', 'Nexha')");
    h += ort("💸", "Tërheqjet e Gresa", "Muj-për-muaj", fmt(st.thG), "neg", "App.openSummary('terheqje', 'Gresa')");
    h += ort("💼", "Nexha ka dhanë për Toyota", "Investimi — muj-për-muaj", fmt(st.inN), "pos", "App.openSummary('investim', 'Nexha')");
    h += ort("💼", "Gresa ka dhanë për Mercedes", "Investimi — muj-për-muaj", fmt(st.inG), "pos", "App.openSummary('investim', 'Gresa')");
    h += `<div class="sec-title">📂 HARXHIMET SIPAS KATEGORIVE</div>`;
    if (!katList.length) h += `<div class="empty">Nuk ka harxhime për këtë periudhë.</div>`;
    katList.forEach(([k, v]) => {
        const pct = st.shpenzime > 0 ? ((v / st.shpenzime) * 100).toFixed(1) : "0.0";
        h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openKatView('${esc(k).replace(/'/g, "\\'")}')"">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:13px;font-weight:700">📂 ${esc(k)}</div>
                <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="neg">${fmt(v)} MKD</div>
                <div style="font-size:11px;color:var(--muted)">${pct}% e harxhimeve</div></div>
            </div>
        </button>`;
    });
    const months = monthData(S.year);
    h += `<div class="sec-title">📅 ANALIZA MUJORE</div>`;
    months.forEach(mo => {
        if (!mo.ts.length && !mo.shitje && !mo.shpenzime) return;
        const fitCls = mo.fitimi >= 0 ? "pos" : "neg";
        h += `<div class="card" style="margin-bottom:10px">
            <div style="font-size:13px;font-weight:800;margin-bottom:6px">${esc(mo.name)}</div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px"><span style="color:var(--muted)">Shitje (hyrjet):</span><b class="pos">${fmt(mo.shitje)} MKD</b></div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px"><span style="color:var(--muted)">Harxhimet:</span><b class="neg">${fmt(mo.shpenzime)} MKD</b></div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--muted)">Fitimi:</span><b class="${fitCls}">${fmt(mo.fitimi)} MKD</b></div>
        </div>`;
    });
    return h;
}

function rStatement(st) {
    const name = S.viewPartner;
    const th = name === "Nexha" ? st.thN : st.thG;
    const inv = name === "Nexha" ? st.inN : st.inG;
    const pjesa = name === "Nexha" ? st.pN : st.pG;
    const pjesaFitimi = (st.fitimi / 2) + (st.teArdhura / 2);
    const fitCls = v => v >= 0 ? "pos" : "neg";
    let h = `<div class="sec-title">👤 ${esc(name)} — ${esc(S.year || "Të gjitha vitet")}</div>`;
    h += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">💰 Shitja e Rrymës</span><b class="pos">${fmt(st.shitje)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">🔋 − Shpenzimet Operative</span><b class="neg">${fmt(st.shpenzime)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:8px;border-top:1px solid var(--line);margin-bottom:6px"><b>📊 Fitimi Neto Operativ</b><b class="${fitCls(st.fitimi)}">${fmt(st.fitimi)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">🏦 Të Ardhura nga Depoziti Bankar</span><b class="pos">${fmt(st.teArdhura)} MKD</b></div>
    </div>`;
    h += `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">✅ 50% e Fitimit Neto</span><b class="pos">${fmt(st.fitimi / 2)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">🏦 50% e Të Ardhurave Bankare</span><b class="pos">${fmt(st.teArdhura / 2)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:8px;border-top:1px solid var(--line);margin-bottom:6px"><b>📋 Gjithsej i takon ${esc(name)}</b><b class="pos">${fmt(pjesaFitimi)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--muted)">💸 Tërheqjet e ${esc(name)}</span><b class="neg">−${fmt(th)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">💼 Investimi (kthim — ${PARTNER_INVEST[name] || ""})</span><b style="color:var(--blue)">+${fmt(inv)} MKD</b></div>
    </div>`;
    h += `<div class="card" style="background:${pjesa >= 0 ? "#f0fdf6" : "#fdecec"};border-color:${pjesa >= 0 ? "#cdeeda" : "#f5c6c6"}">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px">📋 BILANCI FINAL — ${esc(name.toUpperCase())}</div>
        <div style="font-size:22px;font-weight:800" class="${fitCls(pjesa)}">${pjesa >= 0 ? "+" : ""}${fmt(pjesa)} MKD</div>
        <div style="font-size:12px;margin-top:4px" class="${fitCls(pjesa)}">${pjesa >= 0 ? "✅ " + name + " ka për të marrë edhe " + fmt(pjesa) + " MKD" : "⚠️ " + name + " ka marrë " + fmt(Math.abs(pjesa)) + " MKD më shumë se fitimi i saj"}</div>
    </div>`;
    h += `<div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="load-more" style="margin:0" onclick="App.exportStatement()">📄 Excel (CSV)</button>
        <button class="load-more" style="margin:0;background:var(--blue)" onclick="App.printStatement()">🖨️ Printo</button>
    </div>`;
    return h;
}

function downloadCsv(name, rows) {
    const csv = "\uFEFF" + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
}

function rMenu() {
    const item = (ic, lbl, fn, danger) => `<button${danger ? ' class="danger"' : ""} onclick="${fn}"><span>${ic}</span>${lbl}</button>`;
    const acc = S.user ? `<div class="card" style="margin-bottom:12px">
        <div class="lbl">HYRUR SI</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px">${esc(S.user.email || "llogari pa email")}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;word-break:break-all">UID: ${esc(S.user.uid || "")}</div>
        ${USE_TEST_DATA ? '<div style="font-size:11px;color:var(--amber);margin-top:6px">⚠️ Fazë testimi — koleksioni: ' + COLLECTION_TX + '</div>' : ""}
        ${localStorage.getItem("sep_last_auto_backup") ? '<div style="font-size:11px;color:var(--muted);margin-top:6px">💾 Backup automatik: ' + esc(localStorage.getItem("sep_last_auto_backup")) + '</div>' : ""}
    </div>` : "";
    return acc + `<div class="menu-list">` +
        item("🗂️", "Menaxho Kategoritë", "App.openView('kategorite')") +
        item("🕘", "Historiku i Ndryshimeve", "App.openView('historiku')") +
        item("💾", "Backup të Dhënave (JSON)", "App.backup()") +
        item("📥", "Importo Backup", "App.importBackup()") +
        item("🔄", "Rifresko të Dhënat", "App.refresh()") +
        item("🚪", "Dil nga Sistemi", "App.doLogout()", true) +
        `</div>
        <p class="note">SunEnergy Pro — fazë testimi<br>
        ${USE_TEST_DATA ? "⚠️ Po punohet në koleksionin e TESTIT — të dhënat reale nuk preken." : "Po punohet me të dhënat reale."}
        ${DEMO ? "<br>Modaliteti DEMO — pa Firebase." : ""}</p>`;
}

function render() {
    if (S.loading) return;
    document.getElementById("add-grid").innerHTML =
        ADD_TYPES.map(a => `<button onclick="App.openAdd('${a.key}')">${a.lbl}</button>`).join("");
    document.getElementById("year-select").innerHTML =
        `<option value="" ${S.year === "" ? "selected" : ""}>Të gjitha vitet</option>` +
        years().map(y => `<option value="${y}" ${y === S.year ? "selected" : ""}>${y}</option>`).join("");

    // koka: buton prapa kur është hapur një raport
    const inView = !!S.view;
    const ic = document.getElementById("hd-icon");
    ic.textContent = inView ? "←" : TABS[S.tab].ic;
    ic.classList.toggle("back", inView);
    const meta = inView ? VIEWS[S.view] : TABS[S.tab];
    let title = meta.t, sub = meta.s;
    if (S.view === "mujor" && S.viewMonth) { title = S.viewMonth.name; sub = "Detajet e muajit"; }
    if (S.view === "pasqyraOrtaku" && S.viewPartner) { title = "Pasqyra e " + S.viewPartner; sub = "Bilanci final"; }
    if (S.view === "typeDetail" && S.viewType) {
        title = S.viewType.partner && S.viewType.tipi === "Tërheqje" ? "Tërheqjet e " + S.viewType.partner
              : S.viewType.partner && S.viewType.tipi === "Investim" ? "Investimi — " + PARTNER_INVEST[S.viewType.partner]
              : ({ "Shitje": "Shitjet", "Të Ardhura": "Të Ardhura nga Depoziti Bankar", "Shpenzim": "Shpenzimet" }[S.viewType.tipi] || S.viewType.tipi);
        sub = S.year || "Të gjitha vitet";
    }
    if (S.view === "fitimiView") { title = "Fitimi Neto"; sub = S.year || "Të gjitha vitet"; }
    if (S.view === "katDetail" && S.viewKat) { title = S.viewKat; sub = "Harxhimet e kategorisë — " + (S.year || "Të gjitha vitet"); }
    if (S.view === "katMonth" && S.viewKatMonth) { title = S.viewKatMonth.kat; sub = "Harxhimet — " + S.viewKatMonth.monthName; }
    if (S.view === "typeYear" && S.viewTypeYear) {
        const vt = S.viewTypeYear;
        title = vt.partner && vt.tipi === "Tërheqje" ? "Tërheqjet e " + vt.partner + " — " + vt.year
              : vt.partner && vt.tipi === "Investim" ? "Investimi — " + PARTNER_INVEST[vt.partner] + " — " + vt.year
              : ({ "Shitje": "Shitjet", "Të Ardhura": "Të Ardhura nga Depoziti Bankar", "Shpenzim": "Shpenzimet" }[vt.tipi] || vt.tipi) + " — " + vt.year;
        sub = vt.year;
    }
    if (S.view === "katYear" && S.viewKatYear) { title = S.viewKatYear.kat; sub = "Harxhimet — " + S.viewKatYear.year; }
    if ((S.view === "summary" || S.view === "summaryMonth") && S.viewSummary) {
        const { kind, partner } = S.viewSummary;
        title = kind === "terheqje" ? (partner ? "Tërheqjet e " + partner : "Tërheqjet") : (partner ? "Investimi — " + PARTNER_INVEST[partner] : "Investimet");
        if (S.view === "summaryMonth" && S.viewSummaryMonth) title += " — " + MONTHS[parseInt(S.viewSummaryMonth, 10) - 1];
        sub = S.year || "Të gjitha vitet";
    }
    document.getElementById("hd-title").textContent = title;
    document.getElementById("hd-sub").textContent = sub;
    document.getElementById("year-select").style.display = (!inView && S.tab === "menu") ? "none" : "";

    const st = stats(S.year);
    let html = "";
    if (S.view === "raporteMujore") html = rMujoreList();
    else if (S.view === "mujor") html = rMujorDetail();
    else if (S.view === "raporteVjetor") html = rVjetor(st);
    else if (S.view === "pasqyraFin") html = rFinanciar(st);
    else if (S.view === "pasqyraOrtaku") html = rStatement(st);
    else if (S.view === "kategorite") html = rKategorite();
    else if (S.view === "historiku") html = rHistoriku();
    else if (S.view === "typeDetail") html = rTypeDetail(st);
    else if (S.view === "katDetail") html = rKatDetail(st);
    else if (S.view === "summary") html = rSummary();
    else if (S.view === "summaryMonth") html = rSummaryMonth();
    else if (S.view === "katMonth") html = rKatMonth();
    else if (S.view === "typeYear") html = rTypeYear();
    else if (S.view === "katYear") html = rKatYear();
    else if (S.view === "fitimiView") html = rFitimi(st);
    else if (S.tab === "paneli") html = rPaneli(st);
    else if (S.tab === "trans") html = rTrans();
    else if (S.tab === "raporte") html = rRaporte();
    else html = rMenu();
    document.getElementById("main").innerHTML = html;
    if (S.tab === "trans" && !inView) fillTxList();
    if (S.tab === "paneli" && !inView) drawChart(S.year);
}

// ============================================================ Kategoritë & Historiku
function rKategorite() {
    let h = `<div class="sec-title">🗂️ KATEGORITË E SHPENZIMEVE</div>`;
    S.categories.forEach((k, i) => {
        const locked = k === "Te tjera";
        h += `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:8px;padding:10px 12px">
            <div style="flex:1;min-width:0;font-size:13.5px;font-weight:700">${esc(k)}</div>
            <button class="x-btn" style="width:34px;height:34px" onclick="App.catUp(${i})" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="x-btn" style="width:34px;height:34px" onclick="App.catDown(${i})" ${i === S.categories.length - 1 ? "disabled" : ""}>↓</button>
            <button class="x-btn" style="width:34px;height:34px;background:#e8f1ff" onclick="App.catRename(${i})">✏️</button>
            <button class="x-btn" style="width:34px;height:34px;background:#fdecec" onclick="App.catDelete(${i})" ${locked ? "disabled" : ""}>🗑️</button>
        </div>`;
    });
    h += `<div style="display:flex;gap:8px;margin-top:12px">
        <input type="text" id="new-cat" placeholder="Kategori e re..." style="flex:1;padding:12px;border:1px solid var(--line);border-radius:12px;font-size:14px;font-family:inherit">
        <button class="btn-primary" style="width:auto;padding:12px 18px" onclick="App.catAdd()">Shto</button>
    </div>
    <p class="note">"Te tjera" mbetet gjithmonë e fundit dhe nuk fshihet.<br>Ndryshimet sinkronizohen me Firebase.</p>`;
    return h;
}

function rHistoriku() {
    let h = `<div class="sec-title">🕘 HISTORIKU I NDRYSHIMEVE</div>`;
    h += `<button class="load-more" onclick="App.clearLog()">🗑️ Fshi Historikun</button>`;
    if (!S.log.length) return h + `<div class="empty">Historiku është bosh.</div>`;
    h += `<div class="menu-list" style="margin-top:10px">` + S.log.map(l =>
        `<div style="padding:11px 16px;border-bottom:1px solid #f3f4f6">
            <div style="font-size:13px;font-weight:700">${esc(l.action)}</div>
            <div style="font-size:11.5px;color:var(--muted)">${esc(l.details)}</div>
            <div style="font-size:10.5px;color:#9ca3af;margin-top:2px">${esc(l.time)}</div>
        </div>`).join("") + `</div>`;
    return h;
}

function logAdd(action, details) {
    S.log.unshift({ action, details, time: new Date().toLocaleString("sq-AL") });
    if (S.log.length > 200) S.log.length = 200;
    try { localStorage.setItem("sep_log", JSON.stringify(S.log)); } catch (e) {}
}
function loadLog() {
    try { S.log = JSON.parse(localStorage.getItem("sep_log") || "[]"); } catch (e) { S.log = []; }
}
async function saveCategories() {
    try { localStorage.setItem("sep_kategorite", JSON.stringify(S.categories)); } catch (e) {}
    try { await saveCategoriesFirestore(S.categories); UI.toast("✅ Kategoritë u sinkronizuan"); }
    catch (e) { UI.toast("⚠️ U ruajtën lokalisht — Firebase: " + e.message, true); }
    render();
}

function rTypeDetail(st) {
    const vt = S.viewType;
    const ts = st.ts.filter(t => t.tipi === vt.tipi && (!vt.partner || t.kategoria === vt.partner));
    const total = ts.reduce((s, t) => s + t.shuma, 0);
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI</div>
        <div style="font-size:20px;font-weight:800" class="${total >= 0 ? "pos" : "neg"}">${fmt(total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${ts.length} transaksione</div>
    </div>`;

    // "Të gjitha vitet": përmbledhje vit-për-vit (klikueshme), pa listë gjigante
    if (!S.year) {
        const byYear = {};
        ts.forEach(t => {
            const y = String(t.data || "").split("-")[2];
            if (!byYear[y]) byYear[y] = { sum: 0, count: 0 };
            byYear[y].sum += t.shuma; byYear[y].count++;
        });
        h += `<div class="sec-title">📅 SIPAS VITEVE — kliko për detajet</div>`;
        Object.keys(byYear).sort().reverse().forEach(y => {
            const yv = byYear[y];
            h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openTypeYear('${y}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:13px;font-weight:800">📅 ${esc(y)}</div>
                    <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="${yv.sum >= 0 ? "pos" : "neg"}">${fmt(yv.sum)} MKD</div>
                    <div style="font-size:11px;color:var(--muted)">${yv.count} transaksione</div></div>
                </div>
            </button>`;
        });
        if (!Object.keys(byYear).length) h += `<div class="empty">Nuk ka transaksione.</div>`;
        return h;
    }

    // vit i vetëm + Shpenzim: përmbledhje sipas kategorive (klikueshme)
    if (vt.tipi === "Shpenzim" && !vt.partner) {
        const katMap = {};
        ts.forEach(t => { const k = t.kategoria || "Te tjera"; katMap[k] = (katMap[k] || 0) + Math.abs(t.shuma); });
        const katList = Object.entries(katMap).sort((a, b) => b[1] - a[1]);
        if (katList.length) {
            h += `<div class="sec-title">📂 SIPAS KATEGORIVE — kliko për detajet</div>`;
            katList.forEach(([k, v]) => {
                const escK = esc(k).replace(/'/g, "\\'");
                h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openKatView('${escK}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div style="font-size:13px;font-weight:700">📂 ${esc(k)}</div>
                        <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="neg">−${fmt(v)} MKD</div>
                        <div style="font-size:11px;color:var(--muted)">${total > 0 ? ((v / total) * 100).toFixed(1) : "0.0"}% të shpenzimeve</div></div>
                    </div>
                </button>`;
            });
            h += `<div class="sec-title">📄 TË GJITHA TRANSAKSIONET</div>`;
        }
    }
    h += `<button class="load-more" onclick="App.exportTypeDetail()">📄 Eksporto në Excel (CSV)</button>`;
    h += ts.length ? ts.map(txCard).join("") : `<div class="empty">Nuk ka transaksione për këtë periudhë.</div>`;
    return h;
}

function rTypeYear() {
    const vt = S.viewType, ty = S.viewTypeYear;
    if (!vt || !ty) return "";
    const ts = S.tx.filter(t =>
        t.tipi === vt.tipi && (!vt.partner || t.kategoria === vt.partner) &&
        (() => { const p = String(t.data || "").split("-"); return p.length === 3 && p[2] === ty.year; })());
    const total = ts.reduce((s, t) => s + t.shuma, 0);
    ts.sort((a, b) => { const pa = String(a.data || "").split("-"), pb = String(b.data || "").split("-"); return (new Date(pb[2], pb[1] - 1, pb[0]) - new Date(pa[2], pa[1] - 1, pa[0])) || 0; });
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI ${esc(ty.year)}</div>
        <div style="font-size:20px;font-weight:800" class="${total >= 0 ? "pos" : "neg"}">${fmt(total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${ts.length} transaksione</div>
    </div>`;
    h += `<button class="load-more" onclick="App.exportTypeYear()">📄 Eksporto në Excel (CSV)</button>`;
    h += ts.length ? ts.map(txCard).join("") : `<div class="empty">Nuk ka transaksione.</div>`;
    return h;
}

function rKatYear() {
    const ky = S.viewKatYear;
    if (!ky) return "";
    const ts = S.tx.filter(t =>
        t.tipi === "Shpenzim" && (t.kategoria || "Te tjera") === ky.kat &&
        (() => { const p = String(t.data || "").split("-"); return p.length === 3 && p[2] === ky.year; })());
    const total = ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
    ts.sort((a, b) => { const pa = String(a.data || "").split("-"), pb = String(b.data || "").split("-"); return (new Date(pb[2], pb[1] - 1, pb[0]) - new Date(pa[2], pa[1] - 1, pa[0])) || 0; });
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI ${esc(ky.year)}</div>
        <div style="font-size:20px;font-weight:800" class="neg">−${fmt(total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${ts.length} harxhime</div>
    </div>`;
    h += `<button class="load-more" onclick="App.exportKatYear()">📄 Eksporto në Excel (CSV)</button>`;
    h += ts.length ? ts.map(txCard).join("") : `<div class="empty">Nuk ka harxhime.</div>`;
    return h;
}

function rFitimi(st) {
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px"><span style="color:var(--muted)">💰 Shitjet</span><b class="pos">${fmt(st.shitje)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px"><span style="color:var(--muted)">🔋 − Shpenzimet</span><b class="neg">${fmt(st.shpenzime)} MKD</b></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;padding-top:10px;border-top:2px solid var(--line)"><b>📈 Fitimi Neto</b><b class="${st.fitimi >= 0 ? "pos" : "neg"}">${fmt(st.fitimi)} MKD</b></div>
    </div>`;
    const komponentet = st.ts.filter(t => t.tipi === "Shitje" || t.tipi === "Shpenzim");
    h += `<div class="sec-title">📄 TRANSAKSIONET QË E PËRBEJNË</div>`;
    h += komponentet.length ? komponentet.map(txCard).join("") : `<div class="empty">Nuk ka transaksione.</div>`;
    return h;
}

function rKatDetail(st) {
    const k = S.viewKat;
    const ts = st.ts.filter(t => t.tipi === "Shpenzim" && (t.kategoria || "Te tjera") === k);
    const total = ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
    let h = `<div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">TOTALI E KATEGORISË</div>
        <div style="font-size:20px;font-weight:800" class="neg">−${fmt(total)} MKD</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${ts.length} harxhime</div>
    </div>`;
    // "Të gjitha vitet": përmbledhje vit-për-vit (klikueshme)
    if (!S.year) {
        const byYear = {};
        ts.forEach(t => {
            const y = String(t.data || "").split("-")[2];
            if (!byYear[y]) byYear[y] = { sum: 0, count: 0 };
            byYear[y].sum += Math.abs(t.shuma); byYear[y].count++;
        });
        h += `<div class="sec-title">📅 SIPAS VITEVE — kliko për detajet</div>`;
        Object.keys(byYear).sort().reverse().forEach(y => {
            const yv = byYear[y];
            h += `<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;font-family:inherit;margin-bottom:8px" onclick="App.openKatYear('${y}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:13px;font-weight:800">📅 ${esc(y)}</div>
                    <div style="text-align:right"><div style="font-size:13px;font-weight:800" class="neg">−${fmt(yv.sum)} MKD</div>
                    <div style="font-size:11px;color:var(--muted)">${yv.count} harxhime</div></div>
                </div>
            </button>`;
        });
        return h;
    }
    h += `<button class="load-more" onclick="App.exportKatDetail()">📄 Eksporto në Excel (CSV)</button>`;
    h += ts.length ? ts.map(txCard).join("") : `<div class="empty">Nuk ka harxhime për këtë kategori.</div>`;
    return h;
}

// ============================================================ App — veprimet
const App = {
    state: S,  // qasje për debug/testim
    go(tab) {
        S.tab = tab; S.limit = 30; S.view = null; S.viewMonth = null; S.viewPartner = null; S.viewStack = []; S.viewSummary = null; S.viewSummaryMonth = null; S.viewKatMonth = null; S.viewTypeYear = null; S.viewKatYear = null;
        UI.closeSheet(); UI.closeForm();
        document.querySelectorAll(".tabbar button[data-tab]").forEach(b => b.classList.toggle("act", b.dataset.tab === tab));
        const meta = TABS[tab];
        document.getElementById("hd-title").textContent = meta.t;
        document.getElementById("hd-sub").textContent = meta.s;
        document.getElementById("hd-icon").textContent = meta.ic;
        document.getElementById("year-select").style.display = tab === "menu" ? "none" : "";
        render();
        window.scrollTo(0, 0);
    },
    setYear(v) { S.year = v; S.limit = 30; render(); },
    setType(v) { S.type = v; S.limit = 30; fillTxList(); },
    setMonth(v) { S.month = v; S.limit = 30; fillTxList(); },
    setSearch(v) { S.search = v; S.limit = 30; fillTxList();
        const i = document.querySelector(".filters input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
    more() { S.limit += 30; fillTxList(); },
    toggleTx(el) { document.querySelectorAll(".tx-card.open").forEach(c => { if (c !== el) c.classList.remove("open"); }); el.classList.toggle("open"); },

    pushView() { S.viewStack.push({ view: S.view, viewMonth: S.viewMonth, viewPartner: S.viewPartner, tab: S.tab, viewSummary: S.viewSummary, viewSummaryMonth: S.viewSummaryMonth, viewKatMonth: S.viewKatMonth, viewTypeYear: S.viewTypeYear, viewKatYear: S.viewKatYear }); },
    openView(id) {
        if (id === "raporteMujore" && !S.year) S.year = String(new Date().getFullYear());
        this.pushView(); S.view = id; S.limit = 30; UI.closeSheet(); UI.closeForm(); render(); window.scrollTo(0, 0);
    },
    back() {
        const prev = S.viewStack.pop() || { view: null, viewMonth: null, viewPartner: null, tab: S.tab, viewSummary: null, viewSummaryMonth: null, viewKatMonth: null, viewTypeYear: null, viewKatYear: null };
        S.view = prev.view; S.viewMonth = prev.viewMonth; S.viewPartner = prev.viewPartner; S.tab = prev.tab;
        S.viewSummary = prev.viewSummary; S.viewSummaryMonth = prev.viewSummaryMonth; S.viewKatMonth = prev.viewKatMonth;
        S.viewTypeYear = prev.viewTypeYear; S.viewKatYear = prev.viewKatYear;
        document.querySelectorAll(".tabbar button[data-tab]").forEach(b => b.classList.toggle("act", b.dataset.tab === S.tab));
        render(); window.scrollTo(0, 0);
    },
    headerTap() { if (S.view) this.back(); },
    openMonth(m) {
        this.pushView();
        S.viewMonth = monthData(S.year).find(mo => mo.m === m);
        S.view = "mujor"; render(); window.scrollTo(0, 0);
    },
    openStatement(name) { this.pushView(); S.viewPartner = name; S.view = "pasqyraOrtaku"; render(); window.scrollTo(0, 0); },
    openTypeView(tipi, partner) {
        this.pushView();
        S.viewType = { tipi, partner: partner || null };
        S.view = "typeDetail"; render(); window.scrollTo(0, 0);
    },
    exportTypeDetail() {
        const vt = S.viewType;
        const ts = stats(S.year).ts.filter(t => t.tipi === vt.tipi && (!vt.partner || t.kategoria === vt.partner));
        const total = ts.reduce((s, t) => s + t.shuma, 0);
        const label = vt.partner && vt.tipi === "Tërheqje" ? "Terheqjet_e_" + vt.partner
            : vt.partner ? "Investimi_" + vt.partner : vt.tipi.replace(" ", "_");
        const rows = [["SunEnergy Pro — " + label + " (" + (S.year || "Te gjitha vitet") + ")"], [],
            ["Totali", fmt(total) + " MKD"], ["Numri", ts.length], [],
            ["Data", "Tipi", "Përshkrimi", "Kategoria", "Shuma"]];
        ts.forEach(t => rows.push([t.data, t.tipi, t.pershkrimi, t.kategoria, fmt(t.shuma) + " MKD"]));
        downloadCsv("SunEnergy_" + label + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    openSummary(kind, partner) {
        this.pushView();
        S.viewSummary = { kind, partner: partner || null };
        S.viewSummaryMonth = null;
        S.view = "summary"; render(); window.scrollTo(0, 0);
    },
    openSummaryMonth(m) {
        this.pushView();
        S.viewSummaryMonth = m;
        S.view = "summaryMonth"; render(); window.scrollTo(0, 0);
    },
    pct(v, tot) { return tot > 0 ? ((v / tot) * 100).toFixed(1) : "0.0"; },
    openKatMonth(k) {
        this.pushView();
        const mo = S.viewMonth;
        S.viewKatMonth = {
            kat: k,
            monthName: mo ? mo.name : "",
            ts: mo ? mo.ts.filter(t => t.tipi === "Shpenzim" && (t.kategoria || "Te tjera") === k) : []
        };
        S.view = "katMonth"; render(); window.scrollTo(0, 0);
    },
    exportKatMonth() {
        const vm = S.viewKatMonth;
        if (!vm) return;
        const total = vm.ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
        const rows = [["SunEnergy Pro — " + vm.kat + " (" + vm.monthName + ")"], [],
            ["Totali", "-" + fmt(total) + " MKD"], ["Numri", vm.ts.length], [],
            ["Data", "Përshkrimi", "Shuma"]];
        vm.ts.forEach(t => rows.push([t.data, t.pershkrimi, "-" + fmt(Math.abs(t.shuma)) + " MKD"]));
        downloadCsv("SunEnergy_" + vm.kat.replace(/[^a-zA-Z0-9]/g, "_") + "_" + vm.monthName.replace(/\s/g, "_") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    openTypeYear(y) {
        this.pushView();
        S.viewTypeYear = { ...S.viewType, year: y };
        S.view = "typeYear"; render(); window.scrollTo(0, 0);
    },
    openKatYear(y) {
        this.pushView();
        S.viewKatYear = { kat: S.viewKat, year: y };
        S.view = "katYear"; render(); window.scrollTo(0, 0);
    },
    exportTypeYear() {
        const vt = S.viewType, ty = S.viewTypeYear;
        const ts = S.tx.filter(t =>
            t.tipi === vt.tipi && (!vt.partner || t.kategoria === vt.partner) &&
            (() => { const p = String(t.data || "").split("-"); return p.length === 3 && p[2] === ty.year; })());
        const total = ts.reduce((s, t) => s + t.shuma, 0);
        const label = vt.partner && vt.tipi === "Tërheqje" ? "Terheqjet_e_" + vt.partner : vt.partner ? "Investimi_" + vt.partner : vt.tipi.replace(" ", "_");
        const rows = [["SunEnergy Pro — " + label + " " + ty.year], [], ["Totali", fmt(total) + " MKD"], ["Numri", ts.length], [],
            ["Data", "Tipi", "Përshkrimi", "Kategoria", "Shuma"]];
        ts.forEach(t => rows.push([t.data, t.tipi, t.pershkrimi, t.kategoria, fmt(t.shuma) + " MKD"]));
        downloadCsv("SunEnergy_" + label + "_" + ty.year + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    exportKatYear() {
        const ky = S.viewKatYear;
        const ts = S.tx.filter(t =>
            t.tipi === "Shpenzim" && (t.kategoria || "Te tjera") === ky.kat &&
            (() => { const p = String(t.data || "").split("-"); return p.length === 3 && p[2] === ky.year; })());
        const total = ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
        const rows = [["SunEnergy Pro — " + ky.kat + " (" + ky.year + ")"], [],
            ["Totali", "-" + fmt(total) + " MKD"], ["Numri", ts.length], [],
            ["Data", "Përshkrimi", "Shuma"]];
        ts.forEach(t => rows.push([t.data, t.pershkrimi, "-" + fmt(Math.abs(t.shuma)) + " MKD"]));
        downloadCsv("SunEnergy_" + ky.kat.replace(/[^a-zA-Z0-9]/g, "_") + "_" + ky.year + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    openKatView(k) {
        this.pushView();
        S.viewKat = k;
        S.view = "katDetail"; render(); window.scrollTo(0, 0);
    },
    exportKatDetail() {
        const k = S.viewKat;
        const ts = stats(S.year).ts.filter(t => t.tipi === "Shpenzim" && (t.kategoria || "Te tjera") === k);
        const total = ts.reduce((s, t) => s + Math.abs(t.shuma), 0);
        const rows = [["SunEnergy Pro — Kategoria: " + k + " (" + (S.year || "Te gjitha vitet") + ")"], [],
            ["Totali", "-" + fmt(total) + " MKD"], ["Numri", ts.length], [],
            ["Data", "Përshkrimi", "Shuma"]];
        ts.forEach(t => rows.push([t.data, t.pershkrimi, "-" + fmt(Math.abs(t.shuma)) + " MKD"]));
        downloadCsv("SunEnergy_Kategoria_" + k.replace(/[^a-zA-Z0-9]/g, "_") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },

    exportMonth() {
        const mo = S.viewMonth; if (!mo) return;
        const rows = [["SunEnergy Pro — Raporti Mujor: " + mo.name], [],
            ["Totali i Shitjeve", fmt(mo.shitje) + " MKD"], ["Totali i Shpenzimeve", fmt(mo.shpenzime) + " MKD"],
            ["Fitimi Bruto", fmt(mo.fitimi) + " MKD"], [], ["Data", "Tipi", "Përshkrimi", "Kategoria", "Shuma"]];
        mo.ts.forEach(t => rows.push([t.data, t.tipi, t.pershkrimi, t.kategoria, fmt(t.shuma) + " MKD"]));
        downloadCsv("SunEnergy_Raporti_" + mo.name.replace(" ", "_") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    exportVjetor() {
        const st = stats(S.year), months = monthData(S.year);
        const rows = [["SunEnergy Pro — Raporti Vjetor: " + (S.year || "Të gjitha vitet")], [],
            ["Shitjet", fmt(st.shitje) + " MKD"], ["Të Ardhura nga Depoziti Bankar", fmt(st.teArdhura) + " MKD"],
            ["Shpenzimet", fmt(st.shpenzime) + " MKD"], ["Fitimi Neto", fmt(st.fitimi) + " MKD"],
            ["Investimet", fmt(st.inN + st.inG) + " MKD"], ["Tërheqjet", fmt(st.thN + st.thG) + " MKD"], [],
            ["Muaji", "Shitje", "Shpenzime", "Fitimi"]];
        months.forEach(mo => rows.push([mo.name, fmt(mo.shitje), fmt(mo.shpenzime), fmt(mo.fitimi)]));
        downloadCsv("SunEnergy_Raporti_Vjetor_" + (S.year || "Te_gjitha") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    exportFinanciar() {
        const st = stats(S.year);
        const katMap = {};
        st.ts.filter(t => t.tipi === "Shpenzim").forEach(t => { const k = t.kategoria || "Te tjera"; katMap[k] = (katMap[k] || 0) + Math.abs(t.shuma); });
        const rows = [["SunEnergy Pro — Pasqyra Financiare: " + (S.year || "Të gjitha vitet")], [],
            ["Shitjet", fmt(st.shitje) + " MKD"], ["Harxhimet", fmt(st.shpenzime) + " MKD"],
            ["Fitimi", fmt(st.fitimi) + " MKD"], ["Të Ardhura nga Depoziti Bankar", fmt(st.teArdhura) + " MKD"], [],
            ["Kategoria", "Harxhimi", "% e harxhimeve"]];
        Object.entries(katMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
            rows.push([k, fmt(v) + " MKD", st.shpenzime > 0 ? ((v / st.shpenzime) * 100).toFixed(1) + "%" : "0%"]));
        downloadCsv("SunEnergy_Pasqyra_Financiare_" + (S.year || "Te_gjitha") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },
    exportStatement() {
        const st = stats(S.year), name = S.viewPartner;
        const th = name === "Nexha" ? st.thN : st.thG, inv = name === "Nexha" ? st.inN : st.inG;
        const pjesa = name === "Nexha" ? st.pN : st.pG;
        const rows = [["SunEnergy Pro — Pasqyra e Ortakut: " + name + " (" + (S.year || "Të gjitha vitet") + ")"], [],
            ["Shitja e Rrymës", fmt(st.shitje) + " MKD"], ["Shpenzimet Operative", "-" + fmt(st.shpenzime) + " MKD"],
            ["Fitimi Neto Operativ", fmt(st.fitimi) + " MKD"], ["Të Ardhura nga Depoziti Bankar", fmt(st.teArdhura) + " MKD"],
            ["50% e Fitimit Neto", fmt(st.fitimi / 2) + " MKD"], ["50% e Të Ardhurave Bankare", fmt(st.teArdhura / 2) + " MKD"],
            ["Tërheqjet e " + name, "-" + fmt(th) + " MKD"], ["Investimi i " + name + " (kthim)", "+" + fmt(inv) + " MKD"],
            ["BILANCI FINAL", fmt(pjesa) + " MKD"]];
        downloadCsv("SunEnergy_Pasqyra_" + name + "_" + (S.year || "Te_gjitha") + ".csv", rows);
        UI.toast("📥 CSV u shkarkua");
    },

    openAdd(key) {
        const def = ADD_TYPES.find(a => a.key === key);
        UI.closeSheet();
        UI.openForm(def.tipi, null);
    },

    editTx(id) {
        const tx = S.tx.find(t => String(t.id) === String(id));
        if (tx) UI.openForm(tx.tipi, tx);
    },
    async deleteTx(id) {
        const tx = S.tx.find(t => String(t.id) === String(id));
        if (!tx || !confirm("Ta fshij këtë transaksion?\n" + (tx.pershkrimi || tx.tipi) + " — " + fmt(Math.abs(tx.shuma)) + " MKD")) return;
        try {
            await removeTx(id);
            S.tx = S.tx.filter(t => String(t.id) !== String(id));
            logAdd("🗑️ Fshirje", (tx.pershkrimi || tx.tipi) + " (" + fmt(Math.abs(tx.shuma)) + " MKD, " + tx.data + ")");
            render(); UI.toast("🗑️ E fshirë dhe e sinkronizuar");
        } catch (e) { UI.toast("⚠️ Gabim gjatë fshirjes: " + e.message, true); }
    },

    catUp(i) { if (i <= 0) return; const c = S.categories; [c[i - 1], c[i]] = [c[i], c[i - 1]]; saveCategories(); },
    catDown(i) { if (i >= S.categories.length - 1) return; const c = S.categories; [c[i + 1], c[i]] = [c[i], c[i + 1]]; saveCategories(); },
    async catRename(i) {
        const old = S.categories[i];
        const n = prompt("Emri i ri i kategorisë:", old);
        if (!n || n.trim() === old) return;
        S.categories[i] = n.trim();
        let used = 0;
        S.tx.forEach(t => { if (t.kategoria === old) { t.kategoria = n.trim(); used++; } });
        await saveCategories();
        if (used) { logAdd("✏️ Kategoria u riemërtua", old + " → " + n.trim() + " (" + used + " transaksione të përditësuara)"); try { localStorage.setItem("sep_log", JSON.stringify(S.log)); } catch (e) {} }
        render(); UI.toast("✅ Kategoria u riemërtua");
    },
    async catDelete(i) {
        const k = S.categories[i];
        if (k === "Te tjera") return;
        const used = S.tx.filter(t => t.kategoria === k).length;
        if (!confirm("Ta fshij kategorinë \"" + k + "\"?" + (used ? "\n⚠️ " + used + " transaksione e përdorin — do të mbeten pa kategori." : ""))) return;
        S.categories.splice(i, 1);
        await saveCategories();
        logAdd("🗑️ Kategoria u fshi", k + (used ? " (" + used + " transaksione pa kategori)" : ""));
        try { localStorage.setItem("sep_log", JSON.stringify(S.log)); } catch (e) {}
        render(); UI.toast("✅ Kategoria u fshi");
    },
    async catAdd() {
        const inp = document.getElementById("new-cat");
        const k = (inp.value || "").trim();
        if (!k) { UI.toast("⚠️ Shkruaj emrin e kategorisë", true); return; }
        if (S.categories.includes(k)) { UI.toast("⚠️ Kjo kategori ekziston", true); return; }
        S.categories.splice(S.categories.length - 1, 0, k);
        await saveCategories();
        logAdd("➕ Kategori e re", k);
        try { localStorage.setItem("sep_log", JSON.stringify(S.log)); } catch (e) {}
        render();
    },
    clearLog() {
        if (!confirm("Ta fshij gjithë historikun?")) return;
        S.log = []; try { localStorage.setItem("sep_log", "[]"); } catch (e) {}
        render();
    },
    printMonth() {
        const mo = S.viewMonth; if (!mo) return;
        const rows = mo.ts.map(t => "<tr><td>" + esc(t.data) + "</td><td>" + esc(t.tipi) + "</td><td>" + esc(t.pershkrimi) + "</td><td>" + esc(t.kategoria || "-") + "</td><td style=\"text-align:right\">" + fmt(t.shuma) + " MKD</td></tr>");
        printReport("Raporti Mujor — " + mo.name, [
            ["Totali i Shitjeve", fmt(mo.shitje) + " MKD"],
            ["Totali i Shpenzimeve", fmt(mo.shpenzime) + " MKD"],
            ["Fitimi Bruto", fmt(mo.fitimi) + " MKD"]
        ], ["Data", "Tipi", "Përshkrimi", "Kategoria", "Shuma"], rows);
    },
    printStatement() {
        const st = stats(S.year), name = S.viewPartner;
        const th = name === "Nexha" ? st.thN : st.thG;
        const inv = name === "Nexha" ? st.inN : st.inG;
        const pjesa = name === "Nexha" ? st.pN : st.pG;
        printReport("Pasqyra e Ortakut — " + name + " (" + (S.year || "Të gjitha vitet") + ")", [
            ["Shitja e Rrymës", fmt(st.shitje) + " MKD"],
            ["Shpenzimet Operative", "-" + fmt(st.shpenzime) + " MKD"],
            ["Fitimi Neto Operativ", fmt(st.fitimi) + " MKD"],
            ["Të Ardhura nga Depoziti Bankar", fmt(st.teArdhura) + " MKD"],
            ["50% e Fitimit Neto", fmt(st.fitimi / 2) + " MKD"],
            ["50% e Të Ardhurave Bankare", fmt(st.teArdhura / 2) + " MKD"],
            ["Tërheqjet e " + name, "-" + fmt(th) + " MKD"],
            ["Investimi i " + name + " (kthim)", "+" + fmt(inv) + " MKD"],
            ["BILANCI FINAL", fmt(pjesa) + " MKD"]
        ], [], []);
    },

    async saveTx(ev) {
        ev.preventDefault();
        const sheet = document.getElementById("form-sheet");
        const tipi = sheet.dataset.tipi;
        const sign = parseInt(sheet.dataset.sign || "1", 10);
        const data = document.getElementById("f-data").value;
        const shuma = parseFloat(document.getElementById("f-shuma").value);
        const pershkrimi = (document.getElementById("f-pershkrimi") || {}).value || "";
        const ortaku = (document.getElementById("f-ortaku") || {}).value || "";
        const kategoria = (document.getElementById("f-kategoria") || {}).value || "";
        if (!data || !shuma || isNaN(shuma)) { UI.toast("⚠️ Plotëso datën dhe shumën", true); return false; }

        const id = document.getElementById("f-id").value || null;
        const tx = {
            id, data: isoToDisplay(data), tipi,
            pershkrimi: pershkrimi || tipi,
            kategoria: ortaku || kategoria,
            shuma: sign * Math.abs(shuma),
            timestamp: new Date().toISOString()
        };
        document.getElementById("form-save").disabled = true;
        try {
            const newId = await saveTx(tx);
            if (!id) tx.id = newId;
            const i = S.tx.findIndex(t => String(t.id) === String(tx.id));
            if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
            UI.closeForm(); render();
            logAdd(id ? "✏️ Editim" : "➕ Shtim", tipi + " — " + (tx.pershkrimi || tipi) + " (" + fmt(Math.abs(tx.shuma)) + " MKD, " + tx.data + ")");
            UI.toast(id ? "✅ U përditësua dhe u sinkronizua me Firebase" : "✅ U shtua dhe u sinkronizua me Firebase");
        } catch (e) {
            UI.toast("⚠️ Gabim në sinkronizim: " + e.message, true);
        }
        document.getElementById("form-save").disabled = false;
        return false;
    },

    async refresh() {
        UI.toast("⏳ Duke ngarkuar nga Firebase...");
        try { S.tx = await loadAll(); render(); UI.toast("✅ " + S.tx.length + " transaksione të ngarkuara"); }
        catch (e) { UI.toast("⚠️ " + friendlyError(e), true); }
    },
    backup() {
        const blob = new Blob([JSON.stringify({ version: "pro-1.0", exported: new Date().toISOString(), collection: COLLECTION_TX, data: S.tx }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `sunenergy_pro_backup_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        UI.toast("📥 Backup u shkarkua");
    },
    importBackup() {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = ".json";
        inp.onchange = ev => {
            const f = ev.target.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = async () => {
                try {
                    const parsed = JSON.parse(rd.result);
                    const data = parsed.data || parsed;
                    if (!Array.isArray(data)) throw new Error("format i pasaktë");
                    if (!confirm(`Do të importohen ${data.length} transaksione në koleksionin "${COLLECTION_TX}". Vazhdojmë?`)) return;
                    let ok = 0;
                    for (const t of data) {
                        try { await saveTx({ ...t, id: String(t.id), data: String(t.data).match(/^\d{4}-\d{2}-\d{2}$/) ? isoToDisplay(t.data) : t.data }); ok++; } catch (e) {}
                    }
                    S.tx = await loadAll(); render();
                    UI.toast(`✅ ${ok} transaksione të importuara`);
                } catch (e) { UI.toast("⚠️ Backup i pavlefshëm: " + e.message, true); }
            };
            rd.readAsText(f);
        };
        inp.click();
    },
    async doLogout() {
        if (!confirm("Të dil nga sistemi?")) return;
        try { await logout(); } catch (e) {}
        if (DEMO) location.reload();
    }
};
window.App = App;

function printReport(title, summaryPairs, headers, rows) {
    const w = window.open("", "_blank");
    if (!w) { UI.toast("⚠️ Lejo pop-up për të printuar", true); return; }
    const sumHtml = summaryPairs.map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee"><span>${k}</span><b>${v}</b></div>`).join("");
    const head = headers.length ? "<thead><tr>" + headers.map(h => `<th style="text-align:left;padding:10px;background:#f2f2f2">${h}</th>`).join("") + "</tr></thead>" : "";
    const body = rows.length ? "<tbody>" + rows.join("") + "</tbody>" : "";
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
        <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:30px;color:#1f2937}
        h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}
        td{padding:8px 6px;border-bottom:1px solid #eee}</style></head>
        <body><h1>⚡ SunEnergy Pro</h1><h2 style="font-size:16px;font-weight:600">${title}</h2>
        <div style="margin:16px 0">${sumHtml}</div>
        ${head}${body}
        <p style="margin-top:24px;font-size:11px;color:#9ca3af">Nexha &amp; Gresa — ${new Date().toLocaleString("sq-AL")}</p>
        </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
}

// ============================================================ Auto-backup i përditshëm (lokal)
function autoBackupDaily() {
    const today = new Date().toISOString().split("T")[0];
    if (localStorage.getItem("sep_last_auto_backup") === today) return;
    if (!S.tx.length) return;
    try {
        localStorage.setItem("sep_auto_backup_" + today, JSON.stringify({
            version: "pro-1.0", timestamp: new Date().toISOString(), data: S.tx
        }));
        localStorage.setItem("sep_last_auto_backup", today);
        // mbaj vetëm 7 ditët e fundit
        Object.keys(localStorage).filter(k => k.startsWith("sep_auto_backup_")).forEach(k => {
            const d = k.replace("sep_auto_backup_", "");
            if ((new Date() - new Date(d)) / 86400000 > 7) localStorage.removeItem(k);
        });
        UI.toast("💾 Backup automatik u ruajt (lokal)");
    } catch (e) {}
}

// ============================================================ Nisja
function showApp() {
    document.getElementById("screen-login").classList.add("hidden");
    document.getElementById("screen-app").classList.remove("hidden");
    App.go("paneli");
}
function showLogin() {
    document.getElementById("screen-app").classList.add("hidden");
    document.getElementById("screen-login").classList.remove("hidden");
}

if (DEMO) {
    // Modaliteti DEMO (?demo=1) — vetëm për testim vizual, pa Firebase
    const demo = [];
    const tips = ["Shpenzim", "Shitje", "Tërheqje", "Investim", "Të Ardhura"];
    const kat = ["Kesti per kredi", "", "Rroga Zudi", "Te tjera", ""];
    for (let i = 0; i < 40; i++) {
        const y = i < 25 ? "2025" : "2026";
        const m = String((i % 12) + 1).padStart(2, "0");
        demo.push({ id: "demo" + i, data: `1${i % 9}-${m}-${y}`, tipi: tips[i % 5], pershkrimi: "Transaksion demo " + (i + 1), kategoria: kat[i % 5], shuma: i % 5 === 1 ? (Math.round(Math.random() * 800000) + 100000) : -(Math.round(Math.random() * 60000) + 500), timestamp: "" });
    }
    S.tx = demo;
    S.categories = [...CATEGORIES];
    S.user = { email: "demo@sunenergy.app" };
    loadLog();
    showApp();
} else {
    onAuth(user => {
        if (user) {
            S.user = user;
            showApp();
            S.loading = true;
            loadLog();
            loadAll().then(list => { S.tx = list; }).catch(e => UI.toast("⚠️ " + friendlyError(e), true))
            .then(() => loadCategories().then(c => {
                try { const ls = JSON.parse(localStorage.getItem("sep_kategorite") || "null"); if (Array.isArray(ls) && ls.length) S.categories = ls; } catch (e) {}
                if (Array.isArray(c) && c.length) S.categories = c;
                // nëse s'ka kategori të ruajtura kudo — mbushi automatikisht me listën bazë
                let seeded = false;
                if (!S.categories.length) { S.categories = [...CATEGORIES]; seeded = true; }
                try { localStorage.setItem("sep_kategorite", JSON.stringify(S.categories)); } catch (e) {}
                if (seeded) saveCategoriesFirestore(S.categories).catch(() => {});
            })).catch(e => console.warn("kategorite:", e))
            .finally(() => { S.loading = false; render(); autoBackupDaily(); });
        } else {
            S.user = null; S.tx = [];
            showLogin();
        }
    });
}

document.getElementById("login-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn = document.getElementById("login-btn");
    const err = document.getElementById("login-error");
    err.textContent = "";
    btn.disabled = true; btn.textContent = "Duke u kyçur...";
    try {
        await login(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
    } catch (e) {
        const map = { "auth/invalid-email": "Email-i nuk është valid.", "auth/invalid-credential": "Email ose fjalëkalim i gabuar.",
                      "auth/too-many-requests": "Shumë tentativa. Provo më vonë.", "auth/network-request-failed": "Nuk ka internet.",
                      "auth/unauthorized-domain": "Kjo adresë nuk është e autorizuar në Firebase. Shtoje te: Firebase Console → Authentication → Settings → Authorized domains." };
        err.textContent = "⚠️ " + (map[e.code] || "Hyrja dështoi: " + e.message);
    }
    btn.disabled = false; btn.textContent = "Hyr";
});

document.getElementById("forgot-btn").addEventListener("click", async () => {
    const email = (document.getElementById("login-email").value || prompt("Shkruaj email-in tënd:")).trim();
    if (!email) return;
    const btn = document.getElementById("forgot-btn");
    btn.disabled = true; btn.textContent = "Duke dërguar...";
    try {
        await sendReset(email);
        document.getElementById("login-error").style.color = "#0b7c56";
        document.getElementById("login-error").textContent = "✅ Email-i u dërgua te " + email + " — hap email-in dhe ndiq udhëzimet për fjalëkalim të ri.";
    } catch (e) {
        const map = { "auth/invalid-email": "Email-i nuk është valid.", "auth/too-many-requests": "Shumë kërkesa. Provo pas disa minutash." };
        document.getElementById("login-error").style.color = "";
        document.getElementById("login-error").textContent = "⚠️ " + (map[e.code] || "Provo sërish ose kontakto administratorin.");
    }
    btn.disabled = false; btn.textContent = "Keni harruar fjalëkalimin?";
});
