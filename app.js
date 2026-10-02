// ============================================================
// SunEnergy Pro — logjika e aplikacionit (Faza 1)
// Logjika financiare është identike me aplikacionin e vjetër:
//   Fitimi Neto = Shitje − Shpenzime
//   Pjesa e ortakut = 50% Fitimi Neto + 50% Të Ardhura − Tërheqje + Investim
// ============================================================
import { onAuth, login, logout, loadAll, saveTx, removeTx, DEMO, USE_TEST_DATA, COLLECTION_TX } from "./firebase.js";

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

const TABS = {
    paneli:  { t: "Paneli",        s: "Pasqyra financiare",    ic: "📊" },
    trans:   { t: "Transaksionet", s: "Të gjitha lëvizjet",    ic: "📄" },
    gjendja: { t: "Gjendja",       s: "Ortakët Nexha & Gresa", ic: "👥" },
    menu:    { t: "Më shumë",      s: "Vegla dhe raporte",     ic: "☰" }
};

const fmt = n => (n || 0).toLocaleString("mk-MK", { minimumFractionDigits: 2 });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isoToDisplay = iso => { const p = iso.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso; };

const S = {
    user: null, tx: [], tab: "paneli", year: String(new Date().getFullYear()),
    month: "", type: "", search: "", limit: 30, chart: null, loading: false
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
            <select id="f-kategoria">${CATEGORIES.map(k => `<option ${v.kategoria === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>` : ""}
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
    let h = `<div class="sec-title">📅 Periudha: ${esc(S.year || "Të gjitha vitet")}</div><div class="grid2">`;
    h += card("SHITJET", st.shitje, st.shitje >= 0 ? "var(--green-d)" : "var(--red)");
    h += card("TË ARDHURA NGA DEPOZITI BANKAR", st.teArdhura, "var(--green-d)");
    h += card("SHPENZIMET", st.shpenzime, "var(--red)");
    h += card("FITIMI NETO", st.fitimi, st.fitimi >= 0 ? "var(--green-d)" : "var(--red)");
    h += `</div><div class="sec-title">👥 GJENDJA E ORTAKËVE</div>`;
    h += partnerRow("Nexha", st.pN, "50% partneritet");
    h += partnerRow("Gresa", st.pG, "50% partneritet");
    h += `<div class="chart-card"><h3>Hyrje vs Dalje</h3><div class="sub">${esc(S.year || "Të gjitha vitet")}</div>
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

function rGjendja(st) {
    let h = `<div class="sec-title">📅 ${esc(S.year || "Të gjitha vitet")}</div><div class="grid2">`;
    h += card("TËRHEQJET NEXHA", st.thN, "var(--purple)");
    h += card("TËRHEQJET GRESA", st.thG, "var(--purple)");
    h += card("INVESTIMI NEXHA", st.inN, "var(--blue)");
    h += card("INVESTIMI GRESA", st.inG, "var(--blue)");
    h += `</div><div class="sec-title">Kliko për pasqyrën e plotë</div>`;
    h += partnerRow("Nexha", st.pN, "Sa i mbetet");
    h += partnerRow("Gresa", st.pG, "Sa i mbetet");
    return h;
}

function rMenu() {
    const item = (ic, lbl, fn, danger) => `<button${danger ? ' class="danger"' : ""} onclick="${fn}"><span>${ic}</span>${lbl}</button>`;
    return `<div class="menu-list">` +
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
    const st = stats(S.year);
    let html = "";
    if (S.tab === "paneli") html = rPaneli(st);
    else if (S.tab === "trans") html = rTrans();
    else if (S.tab === "gjendja") html = rGjendja(st);
    else html = rMenu();
    document.getElementById("main").innerHTML = html;
    if (S.tab === "trans") fillTxList();
    if (S.tab === "paneli") drawChart(S.year);
}

// ============================================================ App — veprimet
const App = {
    state: S,  // qasje për debug/testim
    go(tab) {
        S.tab = tab; S.limit = 30; UI.closeSheet(); UI.closeForm();
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

    openStatement(name) {
        const st = stats(S.year);
        UI.toast(`${name}: ${fmt(name === "Nexha" ? st.pN : st.pG)} MKD — pasqyra e plotë vjen në Fazën 2`, false);
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
            render(); UI.toast("🗑️ E fshirë dhe e sinkronizuar");
        } catch (e) { UI.toast("⚠️ Gabim gjatë fshirjes: " + e.message, true); }
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
            UI.toast(id ? "✅ U përditësua dhe u sinkronizua" : "✅ U shtua dhe u sinkronizua me Firebase");
        } catch (e) {
            UI.toast("⚠️ Gabim në sinkronizim: " + e.message, true);
        }
        document.getElementById("form-save").disabled = false;
        return false;
    },

    async refresh() {
        UI.toast("⏳ Duke ngarkuar nga Firebase...");
        try { S.tx = await loadAll(); render(); UI.toast("✅ " + S.tx.length + " transaksione të ngarkuara"); }
        catch (e) { UI.toast("⚠️ " + e.message, true); }
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
    S.user = { email: "demo@sunenergy.app" };
    showApp();
} else {
    onAuth(user => {
        if (user) {
            S.user = user;
            showApp();
            S.loading = true;
            loadAll().then(list => { S.tx = list; }).catch(e => UI.toast("⚠️ " + e.message, true)).finally(() => { S.loading = false; render(); });
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
