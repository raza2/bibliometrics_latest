const tokenTypeModule = {

    async processFiles(files, query = '', minFreq = 1) {
        if (!files || files.length === 0) {
            return { success: false, message: 'Please upload files first' };
        }

        try {
            const fileArray = Array.from(files);

            const fileContents = await Promise.all(
                fileArray.map(async (file) => {
                    if (file && typeof file.content === 'string') {
                        return file.content;
                    }

                    if (file instanceof File || file instanceof Blob) {
                        return await file.text();
                    }

                    console.warn('Unknown file type:', file);
                    return '';
                })
            );

            const combinedText = fileContents.join(' ').trim();

            if (!combinedText) {
                return {
                    success: false,
                    message: 'Files are empty or unreadable.'
                };
            }

            const tokens = combinedText.match(/[\u0600-\u06FF]+/g);

            if (!tokens || tokens.length === 0) {
                return {
                    success: false,
                    message: 'No Urdu text found.'
                };
            }

            const posResults = tokens.map((word, i) => ({
                word,
                pos: 'UNKNOWN',
                pos_type: '-',
                before: i > 0 ? tokens[i - 1] : '',
                after: i < tokens.length - 1 ? tokens[i + 1] : ''
            }));

            if (typeof this.analyzeTokenTypes !== 'function') {
                throw new Error('analyzeTokenTypes() is not defined');
            }

            const analysis = this.analyzeTokenTypes(posResults, query, minFreq);

            return {
                success: true,
                results: analysis.results || [],
                statistics: analysis.statistics || {},
                query,
                minFreq
            };

        } catch (error) {
            return {
                success: false,
                message: 'Error processing files: ' + error.message
            };
        }
    },

    analyzeTokenTypes(posResults, query = '', minFreq = 1) {
        const totalTokens = posResults.length;
        const wordMap = new Map();
        const posMap = new Map();
        
        posResults.forEach((item, index) => {
            const word = item.word;
            const pos = item.pos || 'UNKNOWN';
            
            if (!wordMap.has(word)) {
                wordMap.set(word, {
                    word: word,
                    frequency: 0,
                    pos: pos,
                    pos_type: item.pos_type || '-',
                    occurrences: []
                });
            }
            
            const wordData = wordMap.get(word);
            wordData.frequency++;
            
            // Limit occurrences to save memory
            if (wordData.occurrences.length < 5) {
                wordData.occurrences.push({
                    before: item.before || '',
                    after: item.after || '',
                    position: index
                });
            }
            
            posMap.set(pos, (posMap.get(pos) || 0) + 1);
        });

        const totalTypes = wordMap.size;
        const sttr = this.calculateSTTR(posResults);
        
        let filteredResults = Array.from(wordMap.values());
        
        // Apply Query Filter
        if (query && query.trim()) {
            const q = query.trim().toLowerCase();
            filteredResults = filteredResults.filter(item => 
                item.word.includes(q) || item.pos.toLowerCase().includes(q)
            );
        }
        
        // Apply Frequency Filter
        filteredResults = filteredResults.filter(item => item.frequency >= minFreq);
        filteredResults.sort((a, b) => b.frequency - a.frequency);

        // Final Statistics Object
        const statistics = {
            totalTokens: totalTokens,
            totalTypes: totalTypes,
            typeTokenRatio: ((totalTypes / totalTokens) * 100).toFixed(2) + '%',
            sttr: sttr.toFixed(2) + '%',
            hapaxLegomena: Array.from(wordMap.values()).filter(i => i.frequency === 1).length,
            averageWordFrequency: (totalTokens / totalTypes).toFixed(2),
            uniquePOSTags: posMap.size
        };

        return {
            results: filteredResults.map(item => ({
                ...item,
                percentage: ((item.frequency / totalTokens) * 100).toFixed(2) + '%',
                typeCategory: this.categorizeByFrequency(item.frequency)
            })),
            statistics: statistics
        };
    },

    calculateSTTR(posResults, chunkSize = 1000) {
        if (posResults.length === 0) return 0;
        const ttrs = [];
        for (let i = 0; i < posResults.length; i += chunkSize) {
            const chunk = posResults.slice(i, i + chunkSize);
            const unique = new Set(chunk.map(item => item.word)).size;
            ttrs.push(unique / chunk.length);
        }
        return (ttrs.reduce((a, b) => a + b, 0) / ttrs.length) * 100;
    },

    categorizeByFrequency(f) {
        if (f === 1) return 'Hapax Legomena';
        if (f === 2) return 'Hapax Dislegomena';
        if (f <= 10) return 'Low Frequency';
        return 'High Frequency';
    },

    /**
     * Render the analysis results
     */
    render(container, data) {
        if (!data.success) {
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">❌</div>
                    <div class="placeholder-text">Error</div>
                    <div class="placeholder-subtext">${data.message || 'Failed to analyze tokens/types'}</div>
                </div>
            `;
            return;
        }

        const results = data.results || [];
        const stats = data.statistics || {};

        if (results.length === 0) {
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">📊</div>
                    <div class="placeholder-text">No Results</div>
                    <div class="placeholder-subtext">No token/type data to display</div>
                </div>
            `;
            return;
        }

        let html = `
            <style>
                .tokentype-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .tokentype-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    text-align: center;
                }
                
                .tokentype-header h2 {
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                
                .tokentype-header p {
                    margin: 0;
                    opacity: 0.9;
                    font-size: 14px;
                }
                
                .tokentype-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                }
                
                .tokentype-stat-card {
                    background: white;
                    padding: 16px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border-left: 4px solid #667eea;
                    transition: transform 0.2s;
                }
                
                .tokentype-stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .tokentype-stat-label {
                    font-size: 12px;
                    color: #6c757d;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                    font-weight: 600;
                }
                
                .tokentype-stat-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: #667eea;
                    line-height: 1;
                }
                
                .tokentype-stat-subtext {
                    font-size: 11px;
                    color: #6c757d;
                    margin-top: 4px;
                }
                
                .tokentype-tabs {
                    display: flex;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                    padding: 0 20px;
                }
                
                .tokentype-tab {
                    padding: 12px 24px;
                    border: none;
                    background: transparent;
                    color: #6c757d;
                    font-weight: 600;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s;
                }
                
                .tokentype-tab:hover {
                    color: #667eea;
                    background: rgba(102, 126, 234, 0.1);
                }
                
                .tokentype-tab.active {
                    color: #667eea;
                    border-bottom-color: #667eea;
                    background: white;
                }
                
                .tokentype-table-container {
                    overflow-x: auto;
                    max-height: 500px;
                    overflow-y: auto;
                }
                
                .tokentype-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                
                .tokentype-table thead {
                    position: sticky;
                    top: 0;
                    background: #667eea;
                    color: white;
                    z-index: 10;
                }
                
                .tokentype-table th {
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                    border-bottom: 2px solid #5568d3;
                }
                
                .tokentype-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #dee2e6;
                    text-align: center;
                }
                
                .tokentype-table td.rtl-text {
                    direction: rtl;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                }
                
                .tokentype-table tbody tr:hover {
                    background: #f8f9fa;
                }
                
                .tokentype-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }
                
                .frequency-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .freq-hapax-1 {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .freq-hapax-2 {
                    background: #d1ecf1;
                    color: #0c5460;
                }
                
                .freq-low {
                    background: #d4edda;
                    color: #155724;
                }
                
                .freq-medium {
                    background: #cce5ff;
                    color: #004085;
                }
                
                .freq-high {
                    background: #f8d7da;
                    color: #721c24;
                }
                
                .type-category {
                    font-size: 12px;
                    color: #6c757d;
                }
            </style>
            
            <div class="tokentype-container">
                <div class="tokentype-header">
                    <h2>📊 Token/Type Ratio Analysis</h2>
                    <p>Lexical Richness and Vocabulary Diversity Metrics</p>
                </div>
                
                <div class="tokentype-stats-grid">
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Total Tokens</div>
                        <div class="tokentype-stat-value">${stats.totalTokens?.toLocaleString() || 0}</div>
                        <div class="tokentype-stat-subtext">All word occurrences</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Total Types</div>
                        <div class="tokentype-stat-value">${stats.totalTypes?.toLocaleString() || 0}</div>
                        <div class="tokentype-stat-subtext">Unique words</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Type/Token Ratio</div>
                        <div class="tokentype-stat-value">${stats.typeTokenRatio || '0%'}</div>
                        <div class="tokentype-stat-subtext">Lexical diversity</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Standardized TTR</div>
                        <div class="tokentype-stat-value">${stats.sttr || '0%'}</div>
                        <div class="tokentype-stat-subtext">Per 1000 tokens</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Hapax Legomena</div>
                        <div class="tokentype-stat-value">${stats.hapaxLegomena || 0}</div>
                        <div class="tokentype-stat-subtext">${stats.hapaxPercentage || '0%'} of types</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Hapax Dislegomena</div>
                        <div class="tokentype-stat-value">${stats.hapaxDislegomena || 0}</div>
                        <div class="tokentype-stat-subtext">Words appearing twice</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Lexical Density</div>
                        <div class="tokentype-stat-value">${stats.lexicalDensity || '0%'}</div>
                        <div class="tokentype-stat-subtext">Content words ratio</div>
                    </div>
                    
                    <div class="tokentype-stat-card">
                        <div class="tokentype-stat-label">Avg Frequency</div>
                        <div class="tokentype-stat-value">${stats.averageWordFrequency || '0'}</div>
                        <div class="tokentype-stat-subtext">Per word type</div>
                    </div>
                </div>
                
                <div class="tokentype-table-container">
                    <table class="tokentype-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Word</th>
                                <th>POS</th>
                                <th>Type</th>
                                <th>Frequency</th>
                                <th>Percentage</th>
                                <th>Category</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        results.forEach((item, index) => {
            const categoryClass = item.typeCategory.replace(/ /g, '-').toLowerCase();
            const freqClass = `freq-${categoryClass.split('-')[0]}`;
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="rtl-text" style="font-weight: 600; font-size: 16px;">${item.word}</td>
                    <td><span class="frequency-badge" style="background: #e7f3ff; color: #0066cc;">${item.pos}</span></td>
                    <td class="type-category">${item.pos_type}</td>
                    <td style="font-weight: 600; color: #28a745;">${item.frequency}</td>
                    <td style="font-weight: 600; color: #667eea;">${item.percentage}</td>
                    <td><span class="frequency-badge ${freqClass}">${item.typeCategory}</span></td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};

// Make it globally available
window.tokenTypeModule = tokenTypeModule;
