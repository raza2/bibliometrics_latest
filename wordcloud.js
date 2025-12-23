// wordcloud.js - Word Cloud Module (Fixed for Urdu/Arabic support)

class WordCloudModule {
    constructor() {
        this.wordFrequencies = [];
        this.stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'is', 'was']); // truncated for brevity
        this.includeStopWords = false;
        this.wordColors = ['#FF6347', '#4682B4', '#3CB371', '#DA70D6', '#B45A00'];
        
        this.cloudWidth = 950;
        this.cloudHeight = 600;
        this.urduFont = 'JameelNoori, "Noto Nastaliq Urdu", Arial, sans-serif';
        
        // --- NEW PROPERTIES ---
        this.currentShape = 'circle'; 
        this.maskCanvas = document.createElement('canvas');
        this.maskContext = this.maskCanvas.getContext('2d', { willReadFrequently: true });
        this.maskImage = null;
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async processFiles(files, searchTerm = '', minFrequency = 2) {
        const wordMap = new Map();
        let totalWords = 0;

        console.log('WordCloud: Processing files');

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const words = this.tokenize(content);
                
                console.log('Sample words before cleaning:', words.slice(0, 10));
                
                words.forEach(word => {
                    const cleaned = this.cleanWord(word);
                    if (this.isValidWord(cleaned)) {
                        wordMap.set(cleaned, (wordMap.get(cleaned) || 0) + 1);
                        totalWords++;
                    }
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        this.wordFrequencies = Array.from(wordMap.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([word, freq]) => ({
                word: word,
                frequency: freq,
                percentage: ((freq / totalWords) * 100).toFixed(2)
            }))
            .sort((a, b) => b.frequency - a.frequency);

        console.log('WordCloud: Generated', this.wordFrequencies.length, 'unique words');
        console.log('Sample words:', this.wordFrequencies.slice(0, 10));

        return {
            wordFrequencies: this.wordFrequencies,
            totalUniqueWords: this.wordFrequencies.length,
            totalWords: totalWords,
            searchTerm: searchTerm
        };
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8'); // Explicitly set UTF-8 encoding
        });
    }

    tokenize(content) {
        // Split by whitespace for both English and Urdu
        return content.split(/\s+/).filter(w => w.length > 0);
    }

    cleanWord(word) {
        // FIXED: Keep Urdu/Arabic characters (Unicode range: \u0600-\u06FF)
        // Also keep English letters, numbers, apostrophes, and hyphens
        return word.replace(/[^\w\u0600-\u06FF'-]/g, '');
    }

    isValidWord(word) {
        if (!word || word.length < 2) return false;
        
        // Check if word contains Urdu/Arabic characters
        const hasUrdu = /[\u0600-\u06FF]/.test(word);
        
        // Only apply stop words filter to English words
        if (!hasUrdu && !this.includeStopWords && this.stopWords.has(word.toLowerCase())) {
            return false;
        }
        
        // Skip pure numbers
        if (/^\d+$/.test(word)) return false;
        
        return true;
    }

    render(containerElement, data) {
        if (this.wordFrequencies.length === 0) {
            containerElement.innerHTML = `
                <div class="wordcloud-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">☁️</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No words found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try adjusting the minimum frequency</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="wordcloud-container" style="font-family: ${this.urduFont};">
                <div class="wordcloud-header">
                    <h3>Word Cloud</h3>
                    <div class="wordcloud-stats">
                        <span class="stat-badge">Unique Words: ${data.totalUniqueWords}</span>
                        <span class="stat-badge">Total Words: ${data.totalWords.toLocaleString()}</span>
                    </div>
                </div>

                <div class="wordcloud-controls">
                    <button class="wordcloud-btn" onclick="wordCloudModule.toggleStopWords()">
                        ${this.includeStopWords ? '✓' : '○'} Include Stop Words
                    </button>
                    <button class="wordcloud-btn" onclick="wordCloudModule.exportData()">📥 Export CSV</button>
                    <button class="wordcloud-btn" onclick="wordCloudModule.toggleView('cloud')">☁️ Cloud View</button>
                    <button class="wordcloud-btn" onclick="wordCloudModule.toggleView('list')">📋 List View</button>
                    <button class="wordcloud-btn" onclick="wordCloudModule.toggleView('chart')">📊 Chart View</button>
                </div>

                <div class="wordcloud-views">
                    <div id="cloudView" class="wordcloud-view active">
                        ${this.renderD3LikeCloud()}
                    </div>
                    <div id="listView" class="wordcloud-view">
                        ${this.renderListView()}
                    </div>
                    <div id="chartView" class="wordcloud-view">
                        ${this.renderChartView()}
                    </div>
                </div>
            </div>

            <style>
                .wordcloud-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    font-family: ${this.urduFont};
                    text-rendering: optimizeLegibility;
                }
                
                .wordcloud-header { 
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                
                .wordcloud-header h3 { 
                    margin: 0; 
                    font-size: 20px;
                    font-weight: 600;
                }
                
                .wordcloud-stats { 
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
                
                .wordcloud-controls { 
                    padding: 16px 24px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    display: flex; 
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .wordcloud-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .wordcloud-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }
                
                .wordcloud-views { 
                    padding: 24px;
                }
                
                .wordcloud-view { 
                    display: none; 
                }
                
                .wordcloud-view.active { 
                    display: block; 
                }
                
                .wordcloud-empty { 
                    text-align: center; 
                    padding: 60px 20px;
                    color: #6c757d;
                }

                .cloud-display {
                    position: relative;
                    width: ${this.cloudWidth}px;
                    height: ${this.cloudHeight}px;
                    margin: 0 auto;
                    overflow: hidden;
                    background: #fafbfc;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }

                .cloud-word {
                    display: block;
                    position: absolute;
                    font-weight: 900;
                    white-space: nowrap;
                    cursor: pointer;
                    padding: 0; 
                    margin: 0;
                    background: none; 
                    box-shadow: none;
                    transition: transform 0.2s, opacity 0.2s;
                    line-height: 1;
                    font-family: ${this.urduFont};
                }

                .cloud-word:hover {
                    transform: scale(1.1);
                    opacity: 1 !important;
                }
                
                .list-display {
                    max-height: 600px;
                    overflow-y: auto;
                }
                
                .list-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .list-table thead {
                    position: sticky;
                    top: 0;
                    background: #f8f9fa;
                    z-index: 10;
                }
                
                .list-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #495057;
                    border-bottom: 2px solid #dee2e6;
                    font-size: 13px;
                    text-transform: uppercase;
                }
                
                .list-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 14px;
                }
                
                .list-table tbody tr:hover {
                    background: #f8f9fa;
                }
                
                .list-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }
                
                .list-rank {
                    width: 60px;
                    text-align: center;
                    font-weight: 600;
                    color: #6c757d;
                }
                
                .list-word {
                    font-weight: 600;
                    color: #495057;
                    font-family: ${this.urduFont};
                    direction: rtl;
                    text-align: right;
                }
                
                .list-frequency {
                    width: 120px;
                    text-align: center;
                    font-weight: 600;
                    color: #28a745;
                }
                
                .list-percentage {
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
                    transition: width 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
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
                    width: 200px;
                    font-weight: 600;
                    color: #495057;
                    font-size: 13px;
                    font-family: ${this.urduFont};
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
            </style>
        `;

        containerElement.innerHTML = html;
    }

    renderD3LikeCloud() {
        if (this.wordFrequencies.length === 0) return '';
        
        const maxFreq = Math.max(...this.wordFrequencies.map(w => w.frequency));
        const wordsToShow = this.wordFrequencies.slice(0, 150);

        const largestWord = wordsToShow[0];
        const wordsToRandomize = this.shuffleArray(wordsToShow.slice(1));
        const randomizedWords = [largestWord, ...wordsToRandomize];

        const centerX = this.cloudWidth / 2;
        const centerY = this.cloudHeight / 2;
        
        let words = '';
        
        randomizedWords.forEach((item, index) => {
            const size = 14 + (item.frequency / maxFreq) * 50;
            const opacity = 0.6 + (item.frequency / maxFreq) * 0.4;
            const color = this.wordColors[index % this.wordColors.length];
            
            const angle = Math.random() < 0.85 ? 0 : 90;

            let x, y;
            if (item === largestWord) {
                x = centerX;
                y = centerY;
            } else {
                const radius = Math.sqrt(index) * 20 + size * 0.5;
                const theta = index * 137.5;
                x = centerX + radius * Math.cos(theta);
                y = centerY + radius * Math.sin(theta);
            }

            x = Math.max(20, Math.min(x, this.cloudWidth - 100));
            y = Math.max(20, Math.min(y, this.cloudHeight - 20));
            
            words += `
                <span class="cloud-word" 
                    style="
                        font-size: ${size}px; 
                        opacity: ${opacity}; 
                        color: ${color};
                        left: ${x}px; 
                        top: ${y}px;
                        transform: translate(-50%, -50%) rotate(${angle}deg);
                        font-family: ${this.urduFont};
                    "
                    title="${item.word}: ${item.frequency} occurrences (${item.percentage}%)">
                    ${this.escapeHtml(item.word)}
                </span>
            `;
        });

        return `<div class="cloud-display">${words}</div>`;
    }

    renderListView() {
        const rows = this.wordFrequencies.slice(0, 200).map((item, index) => `
            <tr>
                <td class="list-rank">${index + 1}</td>
                <td class="list-word">${this.escapeHtml(item.word)}</td>
                <td class="list-frequency">${item.frequency}</td>
                <td class="list-percentage">${item.percentage}%</td>
                <td class="frequency-bar">
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${item.percentage}%">
                            ${item.frequency > 10 ? item.frequency : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="list-display">
                <table class="list-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Word</th>
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

    renderChartView() {
        const maxFreq = Math.max(...this.wordFrequencies.map(w => w.frequency));
        const top50 = this.wordFrequencies.slice(0, 50);

        const rows = top50.map(item => {
            const width = (item.frequency / maxFreq) * 100;
            return `
                <div class="chart-row">
                    <div class="chart-label">${this.escapeHtml(item.word)}</div>
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

    toggleView(viewName) {
        document.querySelectorAll('.wordcloud-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');
    }

    async toggleStopWords() {
        this.includeStopWords = !this.includeStopWords;
        const container = document.getElementById('resultsArea');
        const query = document.getElementById('searchQuery') ? document.getElementById('searchQuery').value : '';
        const minFreq = document.getElementById('minFreq') ? document.getElementById('minFreq').value : 2;
        
        if (window.selectedFiles && window.selectedFiles.length > 0) {
            const data = await this.processFiles(window.selectedFiles, query, parseInt(minFreq));
            this.render(container, data);
        }
    }

    highlightWord(word) {
        alert(`Word: ${word}\n\nClick "Search" with this term to see it in context (KWIC view)`);
    }

    exportData() {
        const csvRows = [
            ['Rank', 'Word', 'Frequency', 'Percentage'].join(',')
        ];

        this.wordFrequencies.forEach((item, index) => {
            csvRows.push([
                index + 1,
                `"${item.word.replace(/"/g, '""')}"`,
                item.frequency,
                item.percentage
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wordcloud_frequencies_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const wordCloudModule = new WordCloudModule();