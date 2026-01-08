<<<<<<< Updated upstream
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
=======
// cluster.js - Cluster Analysis Module

class ClusterModule {
    constructor() {
        this.clusters = [];
        this.searchTerm = '';
    }

    // Process files and find word clusters around search term
    async processFiles(files, searchTerm, minFrequency = 1) {
        this.clusters = [];
        this.searchTerm = searchTerm;
        let totalHits = 0;

        console.log('Cluster: Processing files for term:', searchTerm);

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const fileClusters = this.findClusters(content, searchTerm, file.name);
                
                if (fileClusters.leftClusters.length > 0 || fileClusters.rightClusters.length > 0) {
                    this.clusters.push({
                        fileName: file.name,
                        leftClusters: fileClusters.leftClusters.filter(c => c.frequency >= minFrequency),
                        rightClusters: fileClusters.rightClusters.filter(c => c.frequency >= minFrequency),
                        totalMatches: fileClusters.totalMatches
                    });
                    totalHits += fileClusters.totalMatches;
                }
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
>>>>>>> Stashed changes
            }
        }

        console.log('Cluster data generated:', this.clusters);

        return {
            clusters: this.clusters,
            totalHits: totalHits,
            searchTerm: searchTerm
        };
    }

<<<<<<< Updated upstream
    /* ===============================
       CLUSTER EXTRACTION
    =============================== */
    extractClusters(words, n, minFrequency) {
        const map = new Map();

        // Safety check
        if (!Array.isArray(words) || words.length < n) return [];
=======
    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    // Find word clusters (collocations) around search term
    findClusters(content, searchTerm, fileName) {
        const leftClusters = new Map();
        const rightClusters = new Map();
        const clusterSize = 5; // Look at 5 words on each side
        let totalMatches = 0;

        // Tokenize content into words
        const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const searchLower = searchTerm.toLowerCase().trim();
>>>>>>> Stashed changes

        // Find all occurrences of search term
        words.forEach((word, index) => {
            const cleanedWord = word.replace(/[^\w\u0600-\u06FF'-]/g, '');
            
            if (cleanedWord.includes(searchLower)) {
                totalMatches++;

                // Get left context (preceding words)
                for (let i = 1; i <= clusterSize; i++) {
                    const leftIndex = index - i;
                    if (leftIndex >= 0) {
                        const leftWord = this.cleanWord(words[leftIndex]);
                        if (leftWord && leftWord.length > 2) {
                            const position = `L${i}`;
                            const key = `${position}:${leftWord}`;
                            leftClusters.set(key, (leftClusters.get(key) || 0) + 1);
                        }
                    }
                }

                // Get right context (following words)
                for (let i = 1; i <= clusterSize; i++) {
                    const rightIndex = index + i;
                    if (rightIndex < words.length) {
                        const rightWord = this.cleanWord(words[rightIndex]);
                        if (rightWord && rightWord.length > 2) {
                            const position = `R${i}`;
                            const key = `${position}:${rightWord}`;
                            rightClusters.set(key, (rightClusters.get(key) || 0) + 1);
                        }
                    }
                }
            }
        });

        return {
            leftClusters: this.sortClusters(leftClusters),
            rightClusters: this.sortClusters(rightClusters),
            totalMatches
        };
    }

<<<<<<< Updated upstream
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
=======
    // Clean word by removing punctuation
    cleanWord(word) {
        return word.replace(/[^\w\u0600-\u06FF'-]/g, '').toLowerCase();
    }

    // Sort clusters by frequency
    sortClusters(clusterMap) {
        const clusters = Array.from(clusterMap.entries())
            .map(([key, freq]) => {
                const [position, word] = key.split(':');
                return { position, word, frequency: freq };
            })
            .sort((a, b) => b.frequency - a.frequency);

        return clusters;
    }

    // Render cluster visualization
    render(containerElement, data) {
        if (this.clusters.length === 0) {
            containerElement.innerHTML = `
                <div class="cluster-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">🔗</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No clusters found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try searching for a different term</div>
>>>>>>> Stashed changes
                </div>
            `;
            return;
        }

<<<<<<< Updated upstream
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
=======
        const html = `
            <div class="cluster-container">
                <div class="cluster-header">
                    <h3>Cluster Analysis</h3>
                    <div class="cluster-stats">
                        <span class="stat-badge">Search Term: "${data.searchTerm}"</span>
                        <span class="stat-badge">Files: ${this.clusters.length}</span>
                        <span class="stat-badge">Total Matches: ${data.totalHits}</span>
                    </div>
                </div>

                <div class="cluster-controls">
                    <button class="cluster-btn" onclick="clusterModule.exportClusters()">📥 Export CSV</button>
                    <button class="cluster-btn" onclick="clusterModule.sortByFrequency()">🔢 Sort by Frequency</button>
                    <button class="cluster-btn" onclick="clusterModule.sortByWord()">🔤 Sort by Word</button>
                </div>

                <div class="cluster-info">
                    <div class="cluster-legend">
                        <h4>Understanding Clusters:</h4>
                        <p><strong>Left context (L1-L5):</strong> Words that appear BEFORE the search term</p>
                        <p><strong>Right context (R1-R5):</strong> Words that appear AFTER the search term</p>
                        <p><strong>Position:</strong> L1/R1 = immediately adjacent, L5/R5 = 5 words away</p>
                        <p><strong>Frequency:</strong> How many times this word appears in that position</p>
                    </div>
                </div>

                ${this.renderFileClusters()}
>>>>>>> Stashed changes
            </div>

            <style>
                .cluster-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .cluster-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .cluster-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .cluster-stats {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .stat-badge {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .cluster-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .cluster-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .cluster-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .cluster-info {
                    padding: 20px 24px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                }

                .cluster-legend {
                    background: white;
                    padding: 16px;
                    border-radius: 6px;
                    border-left: 4px solid #667eea;
                }

                .cluster-legend h4 {
                    margin: 0 0 12px 0;
                    color: #495057;
                    font-size: 15px;
                }

                .cluster-legend p {
                    margin: 6px 0;
                    font-size: 13px;
                    color: #6c757d;
                }

                .cluster-file-section {
                    margin: 24px;
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }

                .cluster-file-header {
                    background: #f8f9fa;
                    padding: 16px 20px;
                    border-bottom: 2px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .cluster-file-name {
                    font-size: 15px;
                    font-weight: 600;
                    color: #495057;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .cluster-file-matches {
                    background: #e7f3ff;
                    color: #0066cc;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .cluster-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    padding: 20px;
                }

                .cluster-side {
                    background: white;
                }

                .cluster-side-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #495057;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #dee2e6;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .cluster-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .cluster-table th {
                    background: #f8f9fa;
                    padding: 10px 12px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 600;
                    color: #6c757d;
                    text-transform: uppercase;
                    border-bottom: 2px solid #dee2e6;
                }

                .cluster-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 13px;
                }

                .cluster-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .cluster-position {
                    font-weight: 600;
                    color: #667eea;
                    font-family: monospace;
                    width: 60px;
                }

                .cluster-word {
                    color: #495057;
                    font-weight: 500;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    direction: rtl;
                    text-align: right;
                }

                .cluster-frequency {
                    text-align: center;
                    font-weight: 600;
                    color: #28a745;
                    width: 80px;
                }

                .cluster-bar {
                    height: 6px;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    border-radius: 3px;
                    margin-top: 4px;
                }

                .cluster-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                @media (max-width: 768px) {
                    .cluster-content {
                        grid-template-columns: 1fr;
                    }

                    .cluster-table {
                        font-size: 11px;
                    }

                    .cluster-table th,
                    .cluster-table td {
                        padding: 8px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

<<<<<<< Updated upstream
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
=======
    // Render clusters for all files
    renderFileClusters() {
        return this.clusters.map(fileData => {
            const leftTable = this.renderClusterTable(fileData.leftClusters, 'left');
            const rightTable = this.renderClusterTable(fileData.rightClusters, 'right');

            return `
                <div class="cluster-file-section">
                    <div class="cluster-file-header">
                        <div class="cluster-file-name">
                            📄 ${this.escapeHtml(fileData.fileName)}
                        </div>
                        <div class="cluster-file-matches">
                            ${fileData.totalMatches} matches
                        </div>
                    </div>
                    <div class="cluster-content">
                        <div class="cluster-side">
                            <div class="cluster-side-title">
                                ⬅️ Left Context (Before "${this.escapeHtml(this.searchTerm)}")
                            </div>
                            ${leftTable}
                        </div>
                        <div class="cluster-side">
                            <div class="cluster-side-title">
                                ➡️ Right Context (After "${this.escapeHtml(this.searchTerm)}")
                            </div>
                            ${rightTable}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render a cluster table
    renderClusterTable(clusters, side) {
        if (clusters.length === 0) {
            return `<p style="color: #6c757d; font-size: 13px; padding: 20px; text-align: center;">No clusters found</p>`;
        }

        const maxFreq = Math.max(...clusters.map(c => c.frequency));

        const rows = clusters.slice(0, 20).map(cluster => {
            const barWidth = (cluster.frequency / maxFreq) * 100;
            return `
                <tr>
                    <td class="cluster-position">${cluster.position}</td>
                    <td class="cluster-word">${this.escapeHtml(cluster.word)}</td>
                    <td class="cluster-frequency">
                        ${cluster.frequency}
                        <div class="cluster-bar" style="width: ${barWidth}%"></div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <table class="cluster-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Word</th>
                        <th>Frequency</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    // Export clusters as CSV
    exportClusters() {
        const csvRows = [
            ['File', 'Side', 'Position', 'Word', 'Frequency'].join(',')
        ];
>>>>>>> Stashed changes

        this.clusters.forEach(fileData => {
            fileData.leftClusters.forEach(cluster => {
                csvRows.push([
                    `"${fileData.fileName.replace(/"/g, '""')}"`,
                    'Left',
                    cluster.position,
                    `"${cluster.word.replace(/"/g, '""')}"`,
                    cluster.frequency
                ].join(','));
            });

            fileData.rightClusters.forEach(cluster => {
                csvRows.push([
                    `"${fileData.fileName.replace(/"/g, '""')}"`,
                    'Right',
                    cluster.position,
                    `"${cluster.word.replace(/"/g, '""')}"`,
                    cluster.frequency
                ].join(','));
            });
        });

<<<<<<< Updated upstream
        const blob = new Blob(
            [rows.map(r => r.join(',')).join('\n')],
            { type: 'text/csv;charset=utf-8;' }
        );

=======
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
>>>>>>> Stashed changes
        const a = document.createElement('a');
        a.href = url;
        a.download = `cluster_analysis_${this.searchTerm}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

<<<<<<< Updated upstream
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
=======
    // Sort methods
    sortByFrequency() {
        this.clusters.forEach(fileData => {
            fileData.leftClusters.sort((a, b) => b.frequency - a.frequency);
            fileData.rightClusters.sort((a, b) => b.frequency - a.frequency);
        });
        this.reRender();
    }

    sortByWord() {
        this.clusters.forEach(fileData => {
            fileData.leftClusters.sort((a, b) => a.word.localeCompare(b.word));
            fileData.rightClusters.sort((a, b) => a.word.localeCompare(b.word));
        });
        this.reRender();
    }

    // Re-render the view
    reRender() {
        const container = document.getElementById('resultsArea');
        if (container) {
            const totalHits = this.clusters.reduce((sum, f) => sum + f.totalMatches, 0);
            this.render(container, {
                totalHits: totalHits,
                searchTerm: this.searchTerm
            });
        }
    }

    // Escape HTML
>>>>>>> Stashed changes
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

<<<<<<< Updated upstream
/* ===============================
   GLOBAL ACCESS
=============================== */
const clusterModule = new ClusterModule();
=======
// Export for use in main application
const clusterModule = new ClusterModule();
>>>>>>> Stashed changes
