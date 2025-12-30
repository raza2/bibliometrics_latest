// wordcloud.js - Multi-Graph Side-by-Side View with Integrated Master Table
class WordCloudModule {
    constructor() {
        this.allFileData = new Map();
        this.stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'is', 'was', 'that', 'it', 'for', 'on', 'with']);
        this.wordColors = ['#FF6347', '#4682B4', '#3CB371', '#DA70D6', '#B45A00', '#667eea', '#764ba2'];
        
        this.cloudWidth = 450; // Smaller width for side-by-side display
        this.cloudHeight = 350;
        this.urduFont = 'JameelNoori, "Noto Nastaliq Urdu", Arial, sans-serif';
        this.currentShape = 'circle'; 
        
        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = this.cloudWidth;
        this.maskCanvas.height = this.cloudHeight;
        this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    }

    drawShapeMask(shape) {
        const ctx = this.maskCtx;
        const w = this.cloudWidth;
        const h = this.cloudHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'black';
        ctx.beginPath();
        if (shape === 'circle') ctx.arc(w / 2, h / 2, Math.min(w, h) / 2.3, 0, Math.PI * 2);
        else if (shape === 'square') {
            const size = Math.min(w, h) * 0.8;
            ctx.rect((w - size) / 2, (h - size) / 2, size, size);
        }
        ctx.fill();
    }

    isInsideShape(x, y) {
        const pixel = this.maskCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return pixel[3] > 0; 
    }

    async processFiles(files) {
        this.allFileData.clear();
        const masterMap = new Map();
        let totalWordsOverall = 0;

        for (const file of files) {
            const content = await new Promise(res => {
                const r = new FileReader();
                r.onload = e => res(e.target.result);
                r.readAsText(file, 'UTF-8');
            });
            
            const words = content.split(/\s+/);
            const fileMap = new Map();
            let fileTotal = 0;

            words.forEach(w => {
                const cleaned = w.replace(/[^\w\u0600-\u06FF'-]/g, '').toLowerCase();
                if (cleaned.length > 1 && !this.stopWords.has(cleaned)) {
                    fileMap.set(cleaned, (fileMap.get(cleaned) || 0) + 1);
                    masterMap.set(cleaned, (masterMap.get(cleaned) || 0) + 1);
                    fileTotal++;
                }
            });

            this.allFileData.set(file.name, {
                frequencies: this.mapToSortedArray(fileMap, fileTotal),
                total: fileTotal
            });
            totalWordsOverall += fileTotal;
        }

        this.masterFrequencies = this.mapToSortedArray(masterMap, totalWordsOverall);
        this.render(document.getElementById('resultsArea'));
    }

    mapToSortedArray(map, total) {
        return Array.from(map.entries()).map(([word, freq]) => ({
            word, frequency: freq, percentage: ((freq / total) * 100).toFixed(2)
        })).sort((a, b) => b.frequency - a.frequency);
    }

    // Generates a single cloud HTML block
    generateCloudHtml(title, data) {
        this.drawShapeMask(this.currentShape);
        const topWords = data.slice(0, 50);
        const maxFreq = topWords[0]?.frequency || 1;
        const placedRects = [];

        const wordsHtml = topWords.map((item, index) => {
            const fontSize = 14 + (item.frequency / maxFreq) * 40;
            const wordWidth = item.word.length * fontSize * 0.7;
            const wordHeight = fontSize * 1.1;
            let x, y, placed = false;

            for (let j = 0; j < 500; j++) {
                let tx = Math.random() * (this.cloudWidth - 60) + 30;
                let ty = Math.random() * (this.cloudHeight - 60) + 30;
                
                const x1 = tx - wordWidth/2, y1 = ty - wordHeight/2, x2 = tx + wordWidth/2, y2 = ty + wordHeight/2;
                const collision = placedRects.some(r => !(x2 < r.x1 || x1 > r.x2 || y2 < r.y1 || y1 > r.y2));

                if (!collision && this.isInsideShape(tx, ty)) {
                    x = tx; y = ty; placed = true;
                    placedRects.push({ x1, y1, x2, y2 });
                    break;
                }
            }
            return placed ? `<span class="cloud-word" style="font-size:${fontSize}px; color:${this.wordColors[index % 7]}; left:${x}px; top:${y}px;">${item.word}</span>` : '';
        }).join('');

        return `
            <div class="cloud-card">
                <div class="cloud-title">${title}</div>
                <div class="cloud-display" style="width:${this.cloudWidth}px; height:${this.cloudHeight}px;">${wordsHtml}</div>
            </div>`;
    }

    render(container) {
        if (!container) return;

        // Generate all clouds (Master + Individual Files)
        let cloudsHtml = this.generateCloudHtml('Master Analysis', this.masterFrequencies);
        this.allFileData.forEach((data, name) => {
            cloudsHtml += this.generateCloudHtml(name, data.frequencies);
        });

        // Generate Master Table
        const tableRows = this.masterFrequencies.slice(0, 100).map((i, idx) => `
            <tr style="border-left: 5px solid ${this.wordColors[idx % 7]}">
                <td>${idx + 1}</td>
                <td class="urdu-td">${i.word}</td>
                <td><span class="count-badge" style="background:${this.wordColors[idx % 7]}22; color:${this.wordColors[idx % 7]}">${i.frequency}</span></td>
                <td>${i.percentage}%</td>
                <td><div class="bar-bg"><div class="bar-fill" style="width:${i.percentage}%; background:${this.wordColors[idx % 7]}"></div></div></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="bibliometrics-container">
                <div class="top-controls">
                    <button class="ctrl-btn" onclick="wordCloudModule.changeShape('circle')">Circle View</button>
                    <button class="ctrl-btn" onclick="wordCloudModule.changeShape('square')">Square View</button>
                    <button class="ctrl-btn csv-btn" onclick="wordCloudModule.exportCSV()">Export All Data (CSV)</button>
                </div>

                <div class="graphs-grid">${cloudsHtml}</div>

                <div class="table-section">
                    <h3>Comprehensive Frequency Analysis</h3>
                    <table class="master-table">
                        <thead>
                            <tr><th>Rank</th><th>Word / Term</th><th>Frequency</th><th>Density</th><th>Distribution</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>

            <style>
                .bibliometrics-container { padding: 20px; background: #fcfcfc; font-family: 'Segoe UI', sans-serif; }
                .top-controls { display: flex; gap: 10px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
                .ctrl-btn { padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px; font-size: 13px; }
                .csv-btn { background: #2ecc71; color: white; border: none; font-weight: bold; }
                
                /* Grid for Graphs */
                .graphs-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-bottom: 40px; }
                .cloud-card { background: white; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 15px; }
                .cloud-title { font-weight: bold; text-align: center; margin-bottom: 10px; color: #444; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px; }
                .cloud-display { position: relative; overflow: hidden; background: #fff; cursor: crosshair; }
                .cloud-word { position: absolute; transform: translate(-50%, -50%); font-weight: 900; white-space: nowrap; transition: 0.3s; }
                .cloud-word:hover { transform: translate(-50%, -50%) scale(1.2); z-index: 100; text-shadow: 0 0 10px rgba(0,0,0,0.1); }

                /* Table Section */
                .table-section { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .master-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .master-table th { background: #f8f9fa; color: #333; text-align: left; padding: 12px; border: 1px solid #dee2e6; font-size: 14px; }
                .master-table td { padding: 12px; border: 1px solid #dee2e6; font-size: 14px; color: #555; }
                .urdu-td { font-family: ${this.urduFont}; font-size: 18px !important; }
                .count-badge { padding: 4px 10px; border-radius: 12px; font-weight: bold; }
                .bar-bg { background: #f0f0f0; height: 8px; border-radius: 4px; width: 100px; }
                .bar-fill { height: 100%; border-radius: 4px; }
            </style>
        `;
    }

    changeShape(shape) {
        this.currentShape = shape;
        this.render(document.getElementById('resultsArea'));
    }

    exportCSV() {
        let csv = 'Word,Frequency,Percentage\n' + this.masterFrequencies.map(i => `"${i.word}",${i.frequency},${i.percentage}%`).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Bibliometrics_Analysis.csv`;
        a.click();
    }
}

// Initial Listener
const wordCloudModule = new WordCloudModule();
document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) wordCloudModule.processFiles(e.target.files);
});