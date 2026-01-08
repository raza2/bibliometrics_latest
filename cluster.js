// cluster.js - TRUE Cluster (Lexical Bundle) Analysis Module (FIXED)

class ClusterModule {
    constructor() {
        this.results = [];
        this.n = 2;
        this.minFrequency = 1;
    }

    /* ===============================
       FILE PROCESSING
    =============================== */
    async processFiles(files, n = 2, minFrequency = 1) {
        this.results = [];

        // SAFE parsing (prevents NaN)
        this.n = Number.isInteger(parseInt(n)) ? parseInt(n) : 2;
        this.minFrequency = Number.isInteger(parseInt(minFrequency)) ? parseInt(minFrequency) : 1;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const content = await this.readFile(file);

                // CLEAN words ONCE (shared logic)
                const cleanedWords = content
                    .toLowerCase()
                    .split(/\s+/)
                    .map(w => this.cleanWord(w))
                    .filter(w => w.length > 0);

                const clusters = this.extractClusters(cleanedWords, this.n, this.minFrequency);

                this.results.push({
                    fileName: file.name,
                    clusters,
                    wordCount: cleanedWords.length
                });

            } catch (error) {
                console.error(`Error reading ${file.name}:`, error);
            }
        }

        return {
            results: this.results,
            n: this.n,
            minFrequency: this.minFrequency
        };
    }

    /* ===============================
       CLUSTER EXTRACTION
    =============================== */
    extractClusters(words, n, minFrequency) {
        const map = new Map();

        // Safety check
        if (!Array.isArray(words) || words.length < n) return [];

        for (let i = 0; i <= words.length - n; i++) {
            const cluster = words.slice(i, i + n).join(' ');
            map.set(cluster, (map.get(cluster) || 0) + 1);
        }

        return Array.from(map.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([cluster, frequency]) => ({ cluster, frequency }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    /* ===============================
       WORD CLEANER (Unicode Safe)
    =============================== */
    cleanWord(word) {
        // Keeps Urdu/Arabic letters, removes edge punctuation
        return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    /* ===============================
       UI RENDERING
    =============================== */
    render(container, data) {
        const filesWithClusters = data.results.filter(r => r.clusters.length > 0);

        if (filesWithClusters.length === 0) {
            const wc = Number.isFinite(data.results[0]?.wordCount)
                ? data.results[0].wordCount
                : 0;

            container.innerHTML = `
                <div style="padding:40px;text-align:center;border:2px dashed #cbd5e1;border-radius:12px;">
                    <h3 style="color:#1e293b;">🔍 No Clusters Found</h3>
                    <p style="color:#64748b;">Detected <b>${wc}</b> words in your file.</p>

                    <div style="background:#f1f5f9; padding:15px; display:inline-block; border-radius:8px; text-align:left; margin-top:10px;">
                        <p style="margin:0; font-size:0.9em;"><b>Possible Reasons:</b></p>
                        <ul style="font-size:0.85em; color:#475569; margin-top:5px;">
                            <li>The file has fewer than ${data.n} words.</li>
                            <li>No ${data.n}-word phrase repeats ${data.minFrequency} or more times.</li>
                            <li>Try <b>Cluster Size = 2</b> and <b>Min Frequency = 1</b>.</li>
                        </ul>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="cluster-wrapper">
                <div class="cluster-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2>📌 Cluster Analysis</h2>
                        <p>${data.n}-word bundles | Min freq: ${data.minFrequency}</p>
                    </div>
                    <button onclick="clusterModule.exportCSV()" style="padding:10px 20px; cursor:pointer;">
                        📥 Export CSV
                    </button>
                </div>
                ${filesWithClusters.map(f => this.renderFile(f)).join('')}
            </div>
        `;
    }

    renderFile(fileData) {
        const rows = fileData.clusters.slice(0, 30).map((c, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="cluster-text">${this.escapeHtml(c.cluster)}</td>
                <td class="freq">${c.frequency}</td>
            </tr>
        `).join('');

        return `
            <div class="cluster-file">
                <h3>📄 ${this.escapeHtml(fileData.fileName)}</h3>

                <table class="cluster-table">
                    <thead>
                        <tr>
                            <th style="width:60px;">#</th>
                            <th>Lexical Bundle (Cluster)</th>
                            <th class="freq">Frequency</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || `
                            <tr>
                                <td colspan="3" style="text-align:center;color:#64748b;">
                                    No clusters found
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;
    }


    /* ===============================
       CSV EXPORT
    =============================== */
    exportCSV() {
        const rows = [['File', 'Cluster', 'Frequency']];

        this.results.forEach(f => {
            f.clusters.forEach(c => {
                rows.push([
                    `"${f.fileName}"`,
                    `"${c.cluster}"`,
                    c.frequency
                ]);
            });
        });

        const blob = new Blob(
            [rows.map(r => r.join(',')).join('\n')],
            { type: 'text/csv;charset=utf-8;' }
        );

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `clusters_${this.n}gram.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /* ===============================
       FILE READER
    =============================== */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result || '');
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /* ===============================
       HTML ESCAPE
    =============================== */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/* ===============================
   GLOBAL ACCESS
=============================== */
const clusterModule = new ClusterModule();
