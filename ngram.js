// ngram.js - N-Gram Analysis Module

class NgramModule {
    constructor() {
        this.ngramData = [];
        this.currentN = 2; // default bigrams
    }

    // Process files and generate n-grams
    async processFiles(files, searchTerm = '', minFrequency = 2, nValue = 2) {
        this.currentN = nValue;
        this.ngramData = [];
        const ngramMap = new Map();
        let totalNgrams = 0;

        console.log(`N-Gram: Processing files for ${nValue}-grams`);

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const ngrams = this.generateNgrams(content, nValue);
                
                ngrams.forEach(ngram => {
                    ngramMap.set(ngram, (ngramMap.get(ngram) || 0) + 1);
                    totalNgrams++;
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        // Filter and sort n-grams
        this.ngramData = Array.from(ngramMap.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([ngram, freq]) => ({
                ngram: ngram,
                frequency: freq,
                percentage: ((freq / totalNgrams) * 100).toFixed(2)
            }))
            .sort((a, b) => b.frequency - a.frequency);

        console.log(`N-Gram: Generated ${this.ngramData.length} unique ${nValue}-grams`);

        return {
            ngramData: this.ngramData,
            totalNgrams: totalNgrams,
            uniqueNgrams: this.ngramData.length,
            nValue: nValue
        };
    }

    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    // Generate n-grams from text
    generateNgrams(text, n) {
        // Tokenize into words (supports both English and Urdu)
        const words = text.toLowerCase()
            .split(/\s+/)
            .map(w => w.replace(/[^\w\u0600-\u06FF'-]/g, ''))
            .filter(w => w.length > 0);

        const ngrams = [];
        
        // Create n-grams
        for (let i = 0; i <= words.length - n; i++) {
            const ngram = words.slice(i, i + n).join(' ');
            if (ngram.split(' ').every(word => word.length > 0)) {
                ngrams.push(ngram);
            }
        }

        return ngrams;
    }

    // Render n-gram view
    render(containerElement, data) {
        if (this.ngramData.length === 0) {
            containerElement.innerHTML = `
                <div class="ngram-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No n-grams found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try lowering the minimum frequency or check your files</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="ngram-container">
                <div class="ngram-header">
                    <h3>${data.nValue}-Gram Analysis</h3>
                    <div class="ngram-stats">
                        <span class="stat-badge">N-Value: ${data.nValue}</span>
                        <span class="stat-badge">Unique: ${data.uniqueNgrams}</span>
                        <span class="stat-badge">Total: ${data.totalNgrams.toLocaleString()}</span>
                    </div>
                </div>

                <div class="ngram-controls">
                    <button class="ngram-btn" onclick="ngramModule.changeN(2)">2-Grams (Bigrams)</button>
                    <button class="ngram-btn" onclick="ngramModule.changeN(3)">3-Grams (Trigrams)</button>
                    <button class="ngram-btn" onclick="ngramModule.changeN(4)">4-Grams</button>
                    <button class="ngram-btn" onclick="ngramModule.changeN(5)">5-Grams</button>
                    <button class="ngram-btn" onclick="ngramModule.exportData()">📥 Export CSV</button>
                </div>

                <div class="ngram-tabs">
                    <button class="ngram-tab active" onclick="ngramModule.switchTab('table')">📋 Table View</button>
                    <button class="ngram-tab" onclick="ngramModule.switchTab('chart')">📊 Chart View</button>
                    <button class="ngram-tab" onclick="ngramModule.switchTab('cloud')">☁️ Cloud View</button>
                </div>

                <div class="ngram-views">
                    <div id="ngramTableView" class="ngram-view active">
                        ${this.renderTableView()}
                    </div>
                    <div id="ngramChartView" class="ngram-view">
                        ${this.renderChartView()}
                    </div>
                    <div id="ngramCloudView" class="ngram-view">
                        ${this.renderCloudView()}
                    </div>
                </div>
            </div>

            <style>
                .ngram-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .ngram-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .ngram-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .ngram-stats {
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

                .ngram-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .ngram-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .ngram-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .ngram-tabs {
                    display: flex;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                    padding: 0 24px;
                    gap: 4px;
                }

                .ngram-tab {
                    padding: 12px 20px;
                    border: none;
                    background: transparent;
                    color: #495057;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s;
                }

                .ngram-tab:hover {
                    background: #e9ecef;
                    color: #667eea;
                }

                .ngram-tab.active {
                    background: white;
                    color: #667eea;
                    border-bottom-color: #667eea;
                    font-weight: 600;
                }

                .ngram-views {
                    padding: 24px;
                    min-height: 500px;
                }

                .ngram-view {
                    display: none;
                }

                .ngram-view.active {
                    display: block;
                }

                .ngram-table-wrapper {
                    max-height: 600px;
                    overflow-y: auto;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                }

                .ngram-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .ngram-table thead {
                    position: sticky;
                    top: 0;
                    background: #f8f9fa;
                    z-index: 10;
                }

                .ngram-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #495057;
                    border-bottom: 2px solid #dee2e6;
                    font-size: 13px;
                    text-transform: uppercase;
                }

                .ngram-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 14px;
                }

                .ngram-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .ngram-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }

                .ngram-rank {
                    width: 60px;
                    text-align: center;
                    font-weight: 600;
                    color: #6c757d;
                }

                .ngram-text {
                    font-weight: 600;
                    color: #495057;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    direction: rtl;
                    text-align: right;
                }

                .ngram-frequency {
                    width: 120px;
                    text-align: center;
                    font-weight: 600;
                    color: #28a745;
                }

                .ngram-percentage {
                    width: 120px;
                    text-align: center;
                    color: #6c757d;
                }

                .frequency-bar {
                    width: 200px;
                }

                .bar-container {
                    background: #e9ecef;
                    height: 20px;
                    border-radius: 4px;
                    overflow: hidden;
                }

                .bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    transition: width 0.3s ease;
                }

                .chart-display {
                    max-height: 600px;
                    overflow-y: auto;
                }

                .chart-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                    padding: 8px;
                    border-radius: 6px;
                    transition: background 0.2s;
                }

                .chart-row:hover {
                    background: #f8f9fa;
                }

                .chart-label {
                    width: 250px;
                    font-weight: 600;
                    color: #495057;
                    font-size: 13px;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    direction: rtl;
                    text-align: right;
                }

                .chart-bar-container {
                    flex: 1;
                    background: #e9ecef;
                    height: 30px;
                    border-radius: 6px;
                    overflow: hidden;
                }

                .chart-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    padding: 0 12px;
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    transition: width 0.3s ease;
                }

                .cloud-display {
                    text-align: center;
                    padding: 40px 20px;
                    line-height: 2.5;
                    background: #fafbfc;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }

                .cloud-ngram {
                    display: inline-block;
                    margin: 8px;
                    padding: 8px 14px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                }

                .cloud-ngram:hover {
                    transform: translateY(-4px) scale(1.1);
                    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.5);
                }

                .ngram-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                @media (max-width: 768px) {
                    .chart-label {
                        width: 150px;
                        font-size: 11px;
                    }

                    .frequency-bar {
                        width: 100px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    // Render table view
    renderTableView() {
        const rows = this.ngramData.slice(0, 200).map((item, index) => `
            <tr>
                <td class="ngram-rank">${index + 1}</td>
                <td class="ngram-text">${this.escapeHtml(item.ngram)}</td>
                <td class="ngram-frequency">${item.frequency}</td>
                <td class="ngram-percentage">${item.percentage}%</td>
                <td class="frequency-bar">
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${Math.min(item.percentage * 10, 100)}%">
                            ${item.frequency > 5 ? item.frequency : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="ngram-table-wrapper">
                <table class="ngram-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>N-Gram</th>
                            <th>Frequency</th>
                            <th>Percentage</th>
                            <th>Distribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Render chart view
    renderChartView() {
        const maxFreq = Math.max(...this.ngramData.map(n => n.frequency));
        const top50 = this.ngramData.slice(0, 50);

        const rows = top50.map(item => {
            const width = (item.frequency / maxFreq) * 100;
            return `
                <div class="chart-row">
                    <div class="chart-label">${this.escapeHtml(item.ngram)}</div>
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${width}%">
                            ${item.frequency}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `<div class="chart-display">${rows}</div>`;
    }

    // Render cloud view
    renderCloudView() {
        const maxFreq = Math.max(...this.ngramData.map(n => n.frequency));
        const top100 = this.ngramData.slice(0, 100);

        const ngrams = top100.map(item => {
            const size = 12 + (item.frequency / maxFreq) * 30;
            const opacity = 0.6 + (item.frequency / maxFreq) * 0.4;
            
            return `
                <span class="cloud-ngram" 
                      style="font-size: ${size}px; opacity: ${opacity}"
                      title="${item.ngram}: ${item.frequency} occurrences">
                    ${this.escapeHtml(item.ngram)}
                </span>
            `;
        }).join('');

        return `<div class="cloud-display">${ngrams}</div>`;
    }

    // Switch between tabs
    switchTab(tabName) {
        document.querySelectorAll('.ngram-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.ngram-view').forEach(view => {
            view.classList.remove('active');
        });

        const activeTab = Array.from(document.querySelectorAll('.ngram-tab')).find(
            tab => tab.textContent.toLowerCase().includes(tabName)
        );
        if (activeTab) activeTab.classList.add('active');

        document.getElementById(`ngram${tabName.charAt(0).toUpperCase() + tabName.slice(1)}View`).classList.add('active');
    }

    // Change n-gram size
    async changeN(n) {
        const container = document.getElementById('resultsArea');
        const minFreq = document.getElementById('minFreq') ? parseInt(document.getElementById('minFreq').value) : 2;
        const query = document.getElementById('searchQuery') ? document.getElementById('searchQuery').value : '';

        if (window.selectedFiles && window.selectedFiles.length > 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
                    <div style="font-size: 16px; font-weight: 600;">Generating ${n}-grams...</div>
                </div>
            `;

            const data = await this.processFiles(window.selectedFiles, query, minFreq, n);
            this.render(container, data);
        }
    }

    // Export to CSV
    exportData() {
        const csvRows = [
            ['Rank', 'N-Gram', 'Frequency', 'Percentage'].join(',')
        ];

        this.ngramData.forEach((item, index) => {
            csvRows.push([
                index + 1,
                `"${item.ngram.replace(/"/g, '""')}"`,
                item.frequency,
                item.percentage
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ngram_${this.currentN}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const ngramModule = new NgramModule()