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
                
                if (fileClusters.leftClusters.size > 0 || fileClusters.rightClusters.size > 0) {
                    this.clusters.push({
                        fileName: file.name,
                        leftClusters: this.sortClusters(fileClusters.leftClusters, minFrequency),
                        rightClusters: this.sortClusters(fileClusters.rightClusters, minFrequency),
                        totalMatches: fileClusters.totalMatches
                    });
                    totalHits += fileClusters.totalMatches;
                }
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        console.log('Cluster data generated:', this.clusters);

        return {
            clusters: this.clusters,
            totalHits: totalHits,
            searchTerm: searchTerm
        };
    }

    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
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

        // Find all occurrences of search term
        words.forEach((word, index) => {
            if (word.includes(searchLower)) {
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
            leftClusters,
            rightClusters,
            totalMatches
        };
    }

    // Clean word by removing punctuation
    cleanWord(word) {
        return word.replace(/[^\w'-]/g, '').toLowerCase();
    }

    // Sort clusters by frequency
    sortClusters(clusterMap, minFrequency) {
        const clusters = Array.from(clusterMap.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([key, freq]) => {
                const [position, word] = key.split(':');
                return { position, word, frequency: freq };
            })
            .sort((a, b) => b.frequency - a.frequency);

        return clusters;
    }

    // Render cluster visualization
    // ... (keep the logic methods: processFiles, findClusters, etc., the same)

    render(containerElement, data) {
        if (this.clusters.length === 0) {
            containerElement.innerHTML = `
                <div class="cluster-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">🔗</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No clusters found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try searching for a different term</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="cluster-container">
                <div class="cluster-header">
                    <div class="header-main">
                        <h3>Cluster Analysis</h3>
                        <p class="header-sub">Analyzing word associations around your search term</p>
                    </div>
                    <div class="cluster-stats">
                        <span class="stat-badge term">Term: "${data.searchTerm}"</span>
                        <span class="stat-badge count">Files: ${this.clusters.length}</span>
                        <span class="stat-badge total">Matches: ${data.totalHits}</span>
                    </div>
                </div>

                <div class="cluster-controls">
                    <button class="cluster-btn export" onclick="clusterModule.exportClusters()">📥 Export CSV</button>
                    <button class="cluster-btn sort" onclick="clusterModule.sortByFrequency()">🔢 Sort by Frequency</button>
                    <button class="cluster-btn sort" onclick="clusterModule.sortByWord()">🔤 Sort by Word</button>
                </div>

                ${this.renderFileClusters()}
            </div>

            <style>
                :root {
                    --left-primary: #4f46e5;
                    --left-bg: #f5f7ff;
                    --right-primary: #059669;
                    --right-bg: #f0fdf4;
                    --border-color: #e2e8f0;
                    --text-main: #1e293b;
                    --text-muted: #64748b;
                }

                .cluster-container {
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    font-family: 'Inter', -apple-system, sans-serif;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }

                /* Header Styling */
                .cluster-header {
                    padding: 24px;
                    background: #1e293b;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .header-main h3 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
                .header-sub { margin: 4px 0 0 0; font-size: 13px; opacity: 0.7; }

                .cluster-stats { display: flex; gap: 10px; }
                .stat-badge {
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    background: rgba(255,255,255,0.1);
                }
                .stat-badge.term { background: #4f46e5; color: white; }

                /* Control Bar */
                .cluster-controls {
                    padding: 12px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    gap: 10px;
                }

                .cluster-btn {
                    padding: 8px 14px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid var(--border-color);
                    background: white;
                }

                .cluster-btn:hover { background: #f1f5f9; transform: translateY(-1px); }
                .cluster-btn.export { background: #1e293b; color: white; border: none; }

                /* File Sections */
                .cluster-file-section {
                    margin: 24px;
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .cluster-file-header {
                    background: #f1f5f9;
                    padding: 12px 20px;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                }

                .cluster-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    background: white;
                }

                /* Table Styling */
                .cluster-side { padding: 0; border-right: 1px solid var(--border-color); }
                .cluster-side:last-child { border-right: none; }

                .cluster-side-title {
                    padding: 12px 20px;
                    font-size: 13px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .left-title { background: var(--left-bg); color: var(--left-primary); border-bottom: 2px solid #c7d2fe; }
                .right-title { background: var(--right-bg); color: var(--right-primary); border-bottom: 2px solid #a7f3d0; }

                .cluster-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                
                .cluster-table th {
                    text-align: left;
                    padding: 10px 20px;
                    font-size: 11px;
                    color: var(--text-muted);
                    background: #fafafa;
                    border-bottom: 1px solid var(--border-color);
                }

                .cluster-table td {
                    padding: 10px 20px;
                    border-bottom: 1px solid var(--border-color);
                    font-size: 13px;
                    color: var(--text-main);
                }

                /* Zebra Striping */
                .left-side tr:nth-child(even) { background-color: #fcfdfe; }
                .right-side tr:nth-child(even) { background-color: #fbfdfc; }

                .cluster-position-pill {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-weight: bold;
                    font-size: 11px;
                }

                .left-side .cluster-position-pill { background: #e0e7ff; color: #4338ca; }
                .right-side .cluster-position-pill { background: #d1fae5; color: #065f46; }

                .cluster-frequency-val { font-weight: 700; font-size: 14px; }
                
                .cluster-bar-container { width: 100%; height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 4px; }
                .left-side .cluster-bar { background: var(--left-primary); height: 100%; border-radius: 2px; }
                .right-side .cluster-bar { background: var(--right-primary); height: 100%; border-radius: 2px; }

                @media (max-width: 900px) {
                    .cluster-content { grid-template-columns: 1fr; }
                    .cluster-side { border-right: none; border-bottom: 1px solid var(--border-color); }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    renderClusterTable(clusters, side) {
        if (clusters.length === 0) {
            return `<div style="padding: 40px; text-align: center; color: #94a3b8; font-size: 13px;">No context words found</div>`;
        }

        const maxFreq = Math.max(...clusters.map(c => c.frequency));
        const sideClass = side === 'left' ? 'left-side' : 'right-side';
        const titleText = side === 'left' ? `⬅ Context Before` : `Context After ➡️`;
        const titleClass = side === 'left' ? 'left-title' : 'right-title';

        const rows = clusters.slice(0, 15).map(cluster => {
            const barWidth = (cluster.frequency / maxFreq) * 100;
            return `
                <tr>
                    <td style="width: 20%"><span class="cluster-position-pill">${cluster.position}</span></td>
                    <td style="width: 50%" class="cluster-word"><strong>${this.escapeHtml(cluster.word)}</strong></td>
                    <td style="width: 30%">
                        <div class="cluster-frequency-val">${cluster.frequency}</div>
                        <div class="cluster-bar-container">
                            <div class="cluster-bar" style="width: ${barWidth}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="${sideClass}">
                <div class="cluster-side-title ${titleClass}">${titleText}</div>
                <table class="cluster-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Word</th>
                            <th>Frequency</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

// ... (keep rest of the class)
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

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cluster_analysis_${this.searchTerm}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

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
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const clusterModule = new ClusterModule();