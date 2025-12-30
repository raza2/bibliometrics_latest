/* ===============================
   POS MODULE — Modern AntConc
   Pyodide-based Urdu POS Tagger
================================ */

const posModule = {
    pyodide: null,
    isInitialized: false,
    allData: [],

    async init() {
        if (this.isInitialized) return;
        try {
            this.pyodide = await loadPyodide();
            await this.loadPythonLogic();
            this.isInitialized = true;
        } catch (err) {
            console.error("POS Init Failed:", err);
            throw err;
        }
    },

    async loadPythonLogic() {
        const pythonCode = `
import json
import re
import unicodedata
from collections import Counter

# 1. Extensive Dictionary Setup
DATA = {
    "proper_nouns": {"پاکستان", "لاہور", "کراچی", "اسلام آباد", "فیصل آباد", "قائداعظم", "علامہ اقبال", "نیویارک", "چین", "روس", "برطانیہ", "گاندھی", "مولانا رومی", "الطاف حسین", "نیلسن منڈیلا", "امریکہ", "ٹوکیو", "پیرس", "واشنگٹن", "شیکسپئیر", "اردو", "پنجابی"},
    "abstract_nouns": {"محبت", "دوستی", "علم", "ایمان", "خوشی", "غم", "نفرت", "عدل", "رحمت", "امید"},
    "collective_nouns": {"فوج", "مجمع", "کمیٹی", "کلاس", "ٹیم", "قوم", "برادری", "خاندان", "ممبر", "اساتذہ"},
    "common_nouns": {"کتاب", "دروازہ", "بچہ", "لڑکی", "لڑکا", "گھر", "گلی", "سڑک", "سکول", "کالج"},
    "helping_verbs": {"ہے", "ہیں", "ہو", "تھا", "تھی", "تھے", "ہوگا", "ہوگی", "ہوں گے", "رہا", "رہی", "رہے", "چاہیے", "سکتا", "سکتی", "سکتے", "کر", "کریں", "ہوا", "ہوئی"},
    "adjectives": {
        "descriptive": {"خوبصورت", "عظیم", "پیارا", "سرد", "گرم", "نیا", "پرانا", "تیز", "سست", "صاف", "گندہ"},
        "quantitative": {"کچھ", "کئی", "تھوڑا", "زیادہ", "کم", "مکمل", "نصف", "تمام", "بہت", "سارا"}
    },
    "adverbs": {
        "time": {"آج", "کل", "اب", "پہلے", "بعد", "ہمیشہ", "ابھی", "فوراً"},
        "place": {"یہاں", "وہاں", "نیچے", "اوپر", "باہر", "اندر", "قریب", "دور"}
    },
    "pronouns": {
        "personal": {"میں", "ہم", "تم", "وہ", "آپ", "تو"},
        "reflexive": {"خود", "اپنا", "اپنی", "اپنے"},
        "relative": {"جو", "جس", "جسے", "جن"}
    },
    "conjunctions": {"اور", "یا", "لیکن", "مگر", "بلکہ", "کیونکہ", "اگر", "تاکہ", "کہ", "چونکہ", "ورنہ"},
    "postpositions": {"کا", "کے", "کی", "سے", "نے", "کو", "تک", "میں", "پر"}
}

def classify_word(word, prev_word=""):
    # CLEANING
    word = word.strip()
    
    # 1. FIXED DICTIONARY LOOKUPS (High Priority)
    if word in DATA["conjunctions"]: return "CCONJ", "Conjunction"
    if word in DATA["postpositions"]: return "ADP", "Postposition"
    if word in DATA["helping_verbs"]: return "AUX", "Helping Verb"
    if word in DATA["pronouns"]["personal"]: return "PRON", "Personal Pronoun"
    if word in DATA["pronouns"]["reflexive"]: return "PRON", "Reflexive Pronoun"
    if word in DATA["pronouns"]["relative"]: return "PRON", "Relative Pronoun"
    
    # 2. ADJECTIVE CATEGORIES
    if word in DATA["adjectives"]["descriptive"]: return "ADJ", "Descriptive Adjective"
    if word in DATA["adjectives"]["quantitative"]: return "ADJ", "Quantitative Adjective"
    
    # 3. NOUN CATEGORIES (Dict + Suffix)
    if word in DATA["proper_nouns"]: return "PROPN", "Proper Noun"
    if word in DATA["abstract_nouns"] or word.endswith(("یت", "گی", "پن", "ائی", "اوت")):
        return "NOUN", "Abstract Noun"
    if word in DATA["collective_nouns"] or word.endswith(("ات", "گروہ")):
        return "NOUN", "Collective Noun"
    
    # 4. VERB SUFFIX LOGIC
    if word.endswith(("نا", "نی", "نے")): return "VERB", "Infinitive Verb"
    if word.endswith(("تا", "تی", "تے")): return "VERB", "Present Verb"
    if word.endswith(("یا", "ئی", "ئے")): return "VERB", "Past/Perfect Verb"
    
    # 5. ADVERB CATEGORIES
    if word in DATA["adverbs"]["time"]: return "ADV", "Adverb of Time"
    if word in DATA["adverbs"]["place"]: return "ADV", "Adverb of Place"

    # 6. CONTEXTUAL HEURISTIC (Critical for 90% accuracy)
    # If a word is followed by a postposition like 'کا', it is almost certainly a Noun
    if prev_word and prev_word in DATA["postpositions"]:
        # This logic is applied in the loop below
        pass

    # 7. FALLBACK
    return "NOUN", "Common Noun"

def process_text_bridge(text):
    text = unicodedata.normalize("NFC", text)
    tokens = re.findall(r"[\u0600-\u06FF]+", text)
    total = len(tokens)
    counts = Counter(tokens)
    results = []
    
    for i, word in enumerate(tokens):
        # Lookahead for Postpositions (Word + ka/ke/ki)
        # If next word is a postposition, current word is likely a Noun
        pos, p_type = classify_word(word)
        
        # Override: Contextual Correction
        if i + 1 < total and tokens[i+1] in DATA["postpositions"]:
            if pos not in ["PRON", "PROPN"]: # Don't overwrite pronouns
                pos, p_type = "NOUN", "Noun (Contextual)"

        results.append({
            "before": " ".join(tokens[max(0, i-3):i]),
            "word": word,
            "after": " ".join(tokens[i+1:i+4]),
            "pos": pos,
            "pos_type": p_type,
            "frequency": counts[word],
            "percentage": round((counts[word] / total) * 100, 2)
        })
    return json.dumps(results)
        `;
        await this.pyodide.runPythonAsync(pythonCode);
    },

    async processFiles(files) {
        if (!this.isInitialized) await this.init();
        let allResults = [];
        for (const file of files) {
            const text = await file.text();
            this.pyodide.globals.set("raw_text_input", text);
            const jsonData = await this.pyodide.runPythonAsync("process_text_bridge(raw_text_input)");
            allResults.push(...JSON.parse(jsonData));
        }
        this.allData = allResults;
        return { results: allResults };
    },

    render(container, data) {
        this.allData = data.results;

        const subTypeMap = {
            "all": ["All Sub-types"],
            "NOUN": ["Common Noun", "Proper Noun", "Abstract Noun", "Collective Noun"],
            "VERB": ["Helping Verb", "Infinitive Verb", "Present Verb"],
            "PROPN": ["Proper Noun"],
            "CCONJ": ["Conjunction"],
            "PRON": ["Pronoun"]
        };

        container.innerHTML = `
            <style>
                .pos-filter-area { display: flex; gap: 15px; margin-bottom: 20px; align-items: center; }
                .pos-dropdown { padding: 10px; border-radius: 6px; border: 1px solid #ccc; background: white; }
                .btn-csv { padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                .pos-table-container { overflow: auto; max-height: 500px; border: 1px solid #ddd; border-radius: 8px; }
                .urdu-table { width: 100%; border-collapse: collapse; font-family: 'JameelNoori', sans-serif; }
                .urdu-table th { position: sticky; top: 0; background: #2c3e50; color: white; padding: 12px; z-index: 10; border: 1px solid #34495e; }
                .urdu-table td { padding: 10px; border: 1px solid #edf2f7; text-align: center; direction: rtl; }
                .urdu-table tr:nth-child(even) { background-color: #f8fafc; }
                .tag-chip { background: #e0e7ff; color: #4338ca; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
            </style>

            <div class="pos-filter-area">
                <select id="mainType" class="pos-dropdown">
                    <option value="all">All Tags (All POS)</option>
                    <option value="NOUN">NOUN</option>
                    <option value="VERB">VERB</option>
                    <option value="PROPN">PROPN</option>
                    <option value="CCONJ">CCONJ</option>
                    <option value="PRON">PRON</option>
                </select>
                <select id="subType" class="pos-dropdown">
                    <option value="all">All Sub-types</option>
                </select>
                <button class="btn-csv" id="downloadCsv">📥 Export CSV</button>
            </div>

            <div class="pos-table-container">
                <table class="urdu-table">
                    <thead>
                        <tr>
                            <th>Before</th>
                            <th>Word</th>
                            <th>After</th>
                            <th>POS</th>
                            <th>Sub-Type</th>
                            <th>Freq</th>
                        </tr>
                    </thead>
                    <tbody id="posBody"></tbody>
                </table>
            </div>
        `;

        const mainSelect = document.getElementById('mainType');
        const subSelect = document.getElementById('subType');
        const searchInput = document.getElementById('searchQuery'); // Link to your antconc.html search bar

        // Update Sub-Types dropdown
        mainSelect.addEventListener('change', () => {
            const val = mainSelect.value;
            subSelect.innerHTML = subTypeMap[val].map(s => `<option value="${s === 'All Sub-types' ? 'all' : s}">${s}</option>`).join('');
            this.applyFilters();
        });

        subSelect.addEventListener('change', () => this.applyFilters());
        
        // Listen to your existing search input in antconc.html
        searchInput.addEventListener('input', () => this.applyFilters());

        document.getElementById('downloadCsv').addEventListener('click', () => this.exportToCSV());

        this.applyFilters();
    },

    applyFilters() {
        const main = document.getElementById('mainType').value;
        const sub = document.getElementById('subType').value;
        const search = document.getElementById('searchQuery').value.toLowerCase();
        const tbody = document.getElementById('posBody');

        const filtered = this.allData.filter(item => {
            const matchMain = main === 'all' || item.pos === main;
            const matchSub = sub === 'all' || item.pos_type === sub;
            const matchSearch = item.word.toLowerCase().includes(search);
            return matchMain && matchSub && matchSearch;
        });

        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td style="color:#777; font-size: 0.9em;">${r.before}</td>
                <td style="font-weight:bold; font-size: 1.2em;">${r.word}</td>
                <td style="color:#777; font-size: 0.9em;">${r.after}</td>
                <td><span class="tag-chip">${r.pos}</span></td>
                <td>${r.pos_type}</td>
                <td>${r.frequency}</td>
            </tr>
        `).join('');
    },

    exportToCSV() {
        let csv = "Before,Word,After,POS,Type,Frequency\n";
        const search = document.getElementById('searchQuery').value.toLowerCase();
        const main = document.getElementById('mainType').value;
        const sub = document.getElementById('subType').value;

        this.allData.forEach(r => {
            const matchMain = main === 'all' || r.pos === main;
            const matchSub = sub === 'all' || r.pos_type === sub;
            const matchSearch = r.word.toLowerCase().includes(search);
            
            if(matchMain && matchSub && matchSearch) {
                csv += `"${r.before}","${r.word}","${r.after}","${r.pos}","${r.pos_type}","${r.frequency}"\n`;
            }
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `urdu_pos_analysis.csv`;
        a.click();
    }
};
