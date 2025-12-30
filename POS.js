/* ===============================
   POS MODULE — Modern AntConc
   Pyodide-based Urdu POS Tagger
================================ */

const posModule = {
    pyodide: null,
    isInitialized: false,

    /* ---------- INIT ---------- */
    async init() {
        if (this.isInitialized) return;

        console.log("Initializing Urdu POS Engine...");

        try {
            this.pyodide = await loadPyodide();
            await this.loadPythonLogic();
            this.isInitialized = true;

            console.log("Urdu POS Module Ready.");
        } catch (err) {
            console.error("POS Init Failed:", err);
            throw err;
        }
    },

    /* ---------- PYTHON LOGIC ---------- */
    async loadPythonLogic() {
        const pythonCode = `
import json
import re
import unicodedata
from collections import Counter

POS_CATEGORIES = {
    "proper_nouns": {"پاکستان", "لاہور", "کراچی", "اسلام آباد", "علی", "فاطمہ"},
    "helping_verbs": {"ہے", "ہیں", "ہو", "تھا", "تھی", "تھے", "رہا", "رہی", "چاہیے", "سکتا", "کر"},
    "conjunctions": {"اور", "یا", "لیکن", "مگر", "بلکہ", "کیونکہ", "اگر", "تاکہ", "کہ"}
}

urdu_noun_dict = {
    "Proper Nouns": ["پاکستان", "لاہور", "کراچی", "اسلام آباد", "قائداعظم", "علامہ اقبال"],
    "Common Nouns": ["کتاب", "بچہ", "لڑکی", "لڑکا", "گھر", "سکول", "سڑک"],
    "Abstract Nouns": ["محبت", "علم", "ایمان", "خوشی", "غم", "امید"],
    "Collective Nouns": ["قوم", "فوج", "کلاس", "ٹیم", "خاندان"]
}

def normalize_urdu(text):
    text = unicodedata.normalize("NFC", text)
    replacements = {
        "ٰ": "", "ھ": "ہ", "ك": "ک", "ى": "ی", "ة": "ہ",
        "\\u200c": " ", "\\u200d": ""
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.strip()

def classify_word(word):
    if word in urdu_noun_dict["Proper Nouns"] or word in POS_CATEGORIES["proper_nouns"]:
        return "PROPN", "Proper Noun"
    if word in urdu_noun_dict["Abstract Nouns"]:
        return "NOUN", "Abstract Noun"
    if word in urdu_noun_dict["Collective Nouns"]:
        return "NOUN", "Collective Noun"
    if word in urdu_noun_dict["Common Nouns"]:
        return "NOUN", "Common Noun"
    if word in POS_CATEGORIES["helping_verbs"]:
        return "VERB", "Helping Verb"
    if word in POS_CATEGORIES["conjunctions"]:
        return "CCONJ", "Conjunction"

    if word.endswith(("یت", "گی", "پن", "ائی", "اوت")):
        return "NOUN", "Abstract Noun"
    if word.endswith(("نا", "نی", "نے")):
        return "VERB", "Infinitive Verb"
    if word.endswith(("تا", "تی", "تے")):
        return "VERB", "Present Verb"

    if word in {"میں", "ہم", "تم", "وہ", "آپ", "میرا", "ہمارا", "اس"}:
        return "PRON", "Pronoun"

    return "NOUN", "Common Noun"

def process_text_bridge(text):
    text = normalize_urdu(text)

    # ✅ Proper Urdu tokenization
    tokens = re.findall(r"[\\u0600-\\u06FF]+", text)

    total_tokens = len(tokens)
    counts = Counter(tokens)
    results = []

    for i, word in enumerate(tokens):
        pos, pos_type = classify_word(word)

        results.append({
            "before": " ".join(tokens[max(0, i-3):i]),
            "word": word,
            "after": " ".join(tokens[i+1:i+4]),
            "pos": pos,
            "pos_type": pos_type,
            "frequency": counts[word],
            "percentage": round((counts[word] / total_tokens) * 100, 2)
        })

    return json.dumps(results)
        `;
        await this.pyodide.runPythonAsync(pythonCode);
    },

    /* ---------- PROCESS FILES ---------- */
    async processFiles(files) {
        if (!this.isInitialized) await this.init();

        let allResults = [];

        for (const file of files) {
            const text = await file.text();
            this.pyodide.globals.set("raw_text_input", text);

            const jsonData = await this.pyodide.runPythonAsync(
                "process_text_bridge(raw_text_input)"
            );

            allResults.push(...JSON.parse(jsonData));
        }

        return {
            results: allResults,
            statistics: this.calculateStats(allResults)
        };
    },

    /* ---------- STATS ---------- */
    calculateStats(results) {
        const stats = {};
        results.forEach(r => {
            stats[r.pos] = (stats[r.pos] || 0) + 1;
        });
        return stats;
    },

    /* ---------- RENDER ---------- */
    render(container, data) {
        container.innerHTML = `
            <div style="margin-bottom:15px;">
                <input id="posSearch" type="text"
                    placeholder="Filter by word or POS..."
                    style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
            </div>

            <div style="display:flex; gap:10px; overflow-x:auto; margin-bottom:20px;">
                ${Object.entries(data.statistics).map(([tag, count]) => `
                    <div style="min-width:90px; padding:10px; background:#f8f9fa;
                        border:1px solid #dee2e6; border-radius:6px; text-align:center;">
                        <div style="font-size:11px; color:#6c757d;">${tag}</div>
                        <div style="font-size:18px; font-weight:bold;">${count}</div>
                    </div>
                `).join("")}
            </div>

            <div style="max-height:500px; overflow:auto; border:1px solid #eee;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead style="position:sticky; top:0; background:#667eea; color:white;">
                        <tr>
                            <th>Before</th>
                            <th>Word</th>
                            <th>After</th>
                            <th>POS</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.results.map(r => `
                            <tr class="pos-row" style="border-bottom:1px solid #eee;">
                                <td style="direction:rtl; color:#777;">${r.before}</td>
                                <td style="direction:rtl; font-weight:bold; text-align:center;">${r.word}</td>
                                <td style="direction:rtl; color:#777;">${r.after}</td>
                                <td style="text-align:center;">
                                    <span style="background:#e3f2fd; padding:3px 6px; border-radius:4px;">
                                        ${r.pos}
                                    </span>
                                </td>
                                <td style="font-size:12px; text-align:center;">${r.pos_type}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;

        // 🔍 Search
        document.getElementById("posSearch").addEventListener("input", e => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll(".pos-row").forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
            });
        });
    }
};
