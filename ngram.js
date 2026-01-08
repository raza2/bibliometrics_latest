// ngram.js - N-Gram Analysis Module (PRO VERSION)
class NgramModule {
    constructor() {
        this.allFilesData = new Map(); // Stores data per file
        this.globalData = [];         // Stores merged data
        this.filteredData = [];       // Data currently being viewed
        this.currentN = 2;
        this.files = null;
        this.currentView = 'overall'; // 'overall' or filename
        window.ngramModule = this;
    }

    async init(files) {
        this.files = Array.from(files);
        await this.changeN(2);
    }

    async processFiles(nValue) {
        this.currentN = nValue;
        const globalMap = new Map();
        this.allFilesData.clear();
        let globalTotal = 0;

        for (const file of this.files) {
            try {
                const content = await this.readFile(file);
                const ngrams = this.generateNgrams(content, nValue);
                const fileMap = new Map();
                
                ngrams.forEach(ngram => {
                    // Update Global
                    globalMap.set(ngram, (globalMap.get(ngram) || 0) + 1);
                    globalTotal++;
                    // Update File-specific
                    fileMap.set(ngram, (fileMap.get(ngram) || 0) + 1);
                });

                this.allFilesData.set(file.name, this.formatData(fileMap, ngrams.length));
            } catch (err) {
                console.error(`Error processing ${file.name}`, err);
            }
        }

        this.globalData = this.formatData(globalMap, globalTotal);
        this.updateFilteredData();
    }

    formatData(map, total) {
        return Array.from(map.entries())
            .map(([ngram, freq]) => ({
                ngram,
                frequency: freq,
                percentage: ((freq / total) * 100).toFixed(2)
            }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    updateFilteredData(searchTerm = '') {
        const source = this.currentView === 'overall' ? this.globalData : this.allFilesData.get(this.currentView);
        
        if (!searchTerm) {
            this.filteredData = source;
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredData = source.filter(item => item.ngram.toLowerCase().includes(term));
        }
    }

    generateNgrams(text, n) {
        const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w\u0600-\u06FF'-]/g, '')).filter(Boolean);
        const ngrams = [];
        for (let i = 0; i <= words.length - n; i++) {
            ngrams.push(words.slice(i, i + n).join(' '));
        }
        return ngrams;
    }

    readFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsText(file, 'UTF-8');
        });
    }

    render(container) {
        if (!container) return;

        container.innerHTML = `
        <div class="ngram-container">
            <div class="ngram-header">
                <div class="header-left">
                    <h3>N-Gram Analysis (N=${this.currentN})</h3>
                    <select class="file-selector" onchange="ngramModule.switchFile(this.value)">
                        <option value="overall">📊 Overall (Combined)</option>
                        ${this.files.length > 1 ? this.files.map(f => `<option value="${f.name}" ${this.currentView === f.name ? 'selected' : ''}>📄 ${f.name}</option>`).join('') : ''}
                    </select>
                </div>
                <div class="search-box">
                    <input type="text" placeholder="Search word..." oninput="ngramModule.handleSearch(this.value)" id="ngramSearch">
                </div>
            </div>

            <div class="ngram-toolbar">
                <div class="n-selector">
                    <button class="n-btn ${this.currentN === 2 ? 'active' : ''}" onclick="ngramModule.changeN(2)">2-Gram</button>
                    <button class="n-btn ${this.currentN === 3 ? 'active' : ''}" onclick="ngramModule.changeN(3)">3-Gram</button>
                    <button class="n-btn ${this.currentN === 4 ? 'active' : ''}" onclick="ngramModule.changeN(4)">4-Gram</button>
                </div>
                <div class="view-tabs">
                    <button class="tab-btn active" id="tab-table" onclick="ngramModule.switchTab('table')">Table</button>
                    <button class="tab-btn" id="tab-chart" onclick="ngramModule.switchTab('chart')">Chart</button>
                    <button class="export-btn" onclick="ngramModule.exportData()">CSV</button>
                </div>
            </div>

            <div class="ngram-content">
                <div class="ngram-view active" id="ngramTableView">${this.renderTableView()}</div>
                <div class="ngram-view" id="ngramChartView">${this.renderChartView()}</div>
            </div>
        </div>

        <style>
            .ngram-container { font-family: sans-serif; border: 1px solid #ccc; border-radius: 8px; background: #fff; overflow: hidden; }
            .ngram-header { padding: 15px; background: #396fa5ff; color: white; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
            .file-selector { padding: 8px; border-radius: 4px; border: none; background: #34495e; color: white; cursor: pointer; }
            .search-box input { padding: 8px 12px; border-radius: 20px; border: 1px solid #ddd; width: 200px; }
            
            .ngram-toolbar { padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; }
            .n-btn, .tab-btn, .export-btn { padding: 6px 12px; margin-right: 4px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px; }
            .n-btn.active, .tab-btn.active { background: #3498db; color: white; border-color: #2980b9; }

            .table-wrapper { max-height: 500px; overflow-y: auto; }
            .ngram-table { width: 100%; border-collapse: collapse; }
            .ngram-table th, .ngram-table td { 
                padding: 12px; 
                border: 1px solid #eee; /* Vertical lines added here */
                text-align: left; 
            }
            .ngram-table thead th { background: #f8f9fa; position: sticky; top: 0; z-index: 1; }
            .ngram-text { direction: rtl; text-align: right; font-weight: bold; color: #2c3e50; background: #fdfdfd; }
            
            .chart-row { display: flex; align-items: center; margin-bottom: 8px; padding: 0 15px; }
            .chart-label { width: 150px; text-align: right; direction: rtl; padding-right: 10px; font-size: 14px; }
            .chart-bar-bg { flex: 1; background: #eee; height: 20px; border-radius: 10px; overflow: hidden; }
            .chart-bar-fill { background: #3498db; height: 100%; color: white; font-size: 10px; display: flex; align-items: center; padding-left: 5px; transition: width 0.3s; }
            
            .ngram-view { display: none; }
            .ngram-view.active { display: block; padding: 15px 0; }
        </style>
        `;
    }

    renderTableView() {
        if (this.filteredData.length === 0) return '<p style="text-align:center;padding:20px;">No results match your search.</p>';
        return `
        <div class="table-wrapper">
            <table class="ngram-table">
                <thead>
                    <tr><th>#</th><th style="text-align:right">N-Gram Phrase</th><th>Freq</th><th>%</th></tr>
                </thead>
                <tbody>
                    ${this.filteredData.slice(0, 200).map((n, i) => `
                    <tr>
                        <td style="color:#999;width:40px">${i + 1}</td>
                        <td class="ngram-text">${this.escapeHtml(n.ngram)}</td>
                        <td style="font-weight:bold;width:60px">${n.frequency}</td>
                        <td style="color:#666;width:60px">${n.percentage}%</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    renderChartView() {
        if (this.filteredData.length === 0) return '';
        const max = Math.max(...this.filteredData.map(n => n.frequency));
        return this.filteredData.slice(0, 40).map(n => `
            <div class="chart-row">
                <div class="chart-label">${this.escapeHtml(n.ngram)}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width:${(n.frequency / max) * 100}%">${n.frequency}</div>
                </div>
            </div>`).join('');
    }

    handleSearch(val) {
        this.updateFilteredData(val);
        document.getElementById('ngramTableView').innerHTML = this.renderTableView();
        document.getElementById('ngramChartView').innerHTML = this.renderChartView();
    }

    async switchFile(val) {
        this.currentView = val;
        const searchVal = document.getElementById('ngramSearch').value;
        this.handleSearch(searchVal);
    }

    async changeN(n) {
        this.currentN = n;
        const results = document.getElementById('resultsArea');
        results.innerHTML = '<div style="padding:40px;text-align:center">Processing N-Grams...</div>';
        await this.processFiles(n);
        this.render(results);
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ngram-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        document.getElementById(`ngram${tab.charAt(0).toUpperCase() + tab.slice(1)}View`).classList.add('active');
    }

    exportData() {
        const csv = "Rank,Phrase,Frequency,Percentage\n" + 
                    this.filteredData.map((n, i) => `${i+1},"${n.ngram}",${n.frequency},${n.percentage}`).join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ngram_${this.currentView}_n${this.currentN}.csv`;
        a.click();
    }

    escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
}

const ngramModule = new NgramModule();
