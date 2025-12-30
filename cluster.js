// cluster.js - TRUE Cluster (Lexical Bundle) Analysis Module

class ClusterModule {
    constructor() {
        this.results = [];
        this.n = 4;              // default cluster size
        this.minFrequency = 5;   // default minimum frequency
    }

    /* ===============================
       MAIN ENTRY
    =============================== */
    async processFiles(files, n = 4, minFrequency = 5) {
        this.results = [];
        this.n = n;
        this.minFrequency = minFrequency;

        for (const file of files) {
            const content = await this.readFile(file);
            const clusters = this.extractClusters(content, n, minFrequency);

            if (clusters.length > 0) {
                this.results.push({
                    fileName: file.name,
                    clusters
                });
            }
        }

        return {
            results: this.results,
            n: this.n,
            minFrequency: this.minFrequency
        };
    }

    /* ===============================
       FILE READER
    =============================== */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /* ===============================
       CORE CLUSTER EXTRACTION
       (CORPUS-LINGUISTICS CORRECT)
    =============================== */
    extractClusters(content, n, minFrequency) {
        const map = new Map();

        const words = content
            .toLowerCase()
            .split(/\s+/)
            .map(w => this.cleanWord(w))
            .filter(w => w.length > 1);

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
       CLEAN TOKEN
    =============================== */
    cleanWord(word) {
        return word.replace(/[^\p{L}\p{N}'’-]/gu, '');
    }

    /* ===============================
       RENDER UI
    =============================== */
    render(container, data) {
        if (data.results.length === 0) {
            container.innerHTML = `
                <div style="padding:40px;text-align:center;color:#64748b;">
                    <h3>No clusters found</h3>
                    <p>Try lowering minimum frequency or cluster size.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="cluster-wrapper">
                <div class="cluster-header">
                    <h2>📌 Cluster Analysis (Lexical Bundles)</h2>
                    <p>${data.n}-word clusters | Min freq: ${data.minFrequency}</p>
                    <button onclick="clusterModule.exportCSV()">📥 Export CSV</button>
                </div>

                ${data.results.map(f => this.renderFile(f)).join('')}
            </div>
        `;
    }

    renderFile(fileData) {
        const rows = fileData.clusters.slice(0, 30).map(c => `
            <tr>
                <td>${this.escapeHtml(c.cluster)}</td>
                <td>${c.frequency}</td>
            </tr>
        `).join('');

        return `
            <div class="cluster-file">
                <h3>📄 ${this.escapeHtml(fileData.fileName)}</h3>
                <table class="cluster-table">
                    <thead>
                        <tr>
                            <th>Cluster</th>
                            <th>Frequency</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    /* ===============================
       EXPORT CSV
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

        const blob = new Blob([rows.map(r => r.join(',')).join('\n')], {
            type: 'text/csv;charset=utf-8;'
        });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `clusters_${this.n}gram.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /* ===============================
       ESCAPE HTML
    =============================== */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/* ===============================
   GLOBAL ACCESS (UI BUTTONS)
=============================== */
const clusterModule = new ClusterModule();
