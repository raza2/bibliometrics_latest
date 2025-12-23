// morphology.js - Morphological Analysis Module for AntConc
// Compatible with the modular architecture

const morphologyModule = (function() {
    'use strict';

    // Common Urdu/English affixes
    const COMMON_PREFIXES = {
        english: ['un', 're', 'pre', 'dis', 'mis', 'sub', 'inter', 'over', 'under', 'anti', 'non', 'semi', 'co'],
        urdu: ['بے', 'نا', 'غیر', 'لا', 'بد', 'کم', 'با']
    };

    const COMMON_SUFFIXES = {
        english: ['ing', 'ed', 'er', 'est', 'ly', 'ness', 'ful', 'less', 'ment', 'tion', 'sion', 'able', 'ible', 'ive', 'ous', 'al'],
        urdu: ['وں', 'یں', 'گا', 'گی', 'گے', 'تا', 'تی', 'تے', 'نا', 'ہے', 'ہیں', 'تھا', 'تھی', 'تھے', 'یا', 'یہ']
    };

    /**
     * Process files for morphological analysis
     * @param {Array} files - Array of file objects with content
     * @param {string} query - Search query (optional)
     * @param {number} minFreq - Minimum frequency filter
     * @returns {Promise<object>} Processed morphology data
     */
    async function processFiles(files, query = '', minFreq = 1) {
        let allText = '';
        let fileNames = [];

        // Combine all file contents
        for (const file of files) {
            allText += file.content + ' ';
            fileNames.push(file.name);
        }

        // Analyze morphology
        const morphData = analyzeMorphology(allText, query, minFreq);
        
        return {
            ...morphData,
            files: fileNames,
            fileCount: files.length,
            totalHits: morphData.statistics.totalWords
        };
    }

    /**
     * Analyze morphological structure of text
     * @param {string} text - Input text to analyze
     * @param {string} query - Optional filter query
     * @param {number} minFreq - Minimum frequency
     * @returns {object} Morphological analysis data
     */
    function analyzeMorphology(text, query = '', minFreq = 1) {
        if (!text || text.trim().length === 0) {
            return null;
        }

        // Clean and tokenize text
        const words = text.trim().split(/\s+/).filter(w => w.length > 2);
        const wordFrequency = {};
        
        // Count word frequencies
        words.forEach(word => {
            const cleaned = word.toLowerCase().replace(/[.,،؛:!؟()'"]/g, '');
            if (cleaned.length > 0) {
                wordFrequency[cleaned] = (wordFrequency[cleaned] || 0) + 1;
            }
        });

        // Filter by query if provided
        let filteredWords = wordFrequency;
        if (query) {
            filteredWords = {};
            Object.keys(wordFrequency).forEach(word => {
                if (word.includes(query.toLowerCase())) {
                    filteredWords[word] = wordFrequency[word];
                }
            });
        }

        // Filter by minimum frequency
        Object.keys(filteredWords).forEach(word => {
            if (filteredWords[word] < minFreq) {
                delete filteredWords[word];
            }
        });

        // Analyze each unique word
        const morphAnalysis = {};
        Object.keys(filteredWords).forEach(word => {
            morphAnalysis[word] = analyzeWord(word);
            morphAnalysis[word].frequency = filteredWords[word];
        });

        // Build morphology tree structure
        const treeData = buildMorphologyTree(morphAnalysis);
        
        // Extract patterns
        const patterns = extractPatterns(morphAnalysis);

        return {
            words: Object.keys(filteredWords),
            analysis: morphAnalysis,
            tree: treeData,
            patterns: patterns,
            statistics: calculateMorphStats(morphAnalysis)
        };
    }

    /**
     * Analyze individual word for morphological components
     */
    function analyzeWord(word) {
        const analysis = {
            original: word,
            root: word,
            prefix: null,
            suffix: null,
            type: 'simple',
            language: detectLanguage(word)
        };

        // Check for prefixes
        const prefixList = analysis.language === 'urdu' ? COMMON_PREFIXES.urdu : COMMON_PREFIXES.english;
        for (let prefix of prefixList) {
            if (word.startsWith(prefix) && word.length > prefix.length + 2) {
                analysis.prefix = prefix;
                analysis.root = word.substring(prefix.length);
                analysis.type = 'derived';
                break;
            }
        }

        // Check for suffixes
        const suffixList = analysis.language === 'urdu' ? COMMON_SUFFIXES.urdu : COMMON_SUFFIXES.english;
        const rootToCheck = analysis.root;
        for (let suffix of suffixList) {
            if (rootToCheck.endsWith(suffix) && rootToCheck.length > suffix.length + 2) {
                analysis.suffix = suffix;
                analysis.root = rootToCheck.substring(0, rootToCheck.length - suffix.length);
                analysis.type = 'derived';
                break;
            }
        }

        return analysis;
    }

    /**
     * Detect if word is Urdu or English
     */
    function detectLanguage(word) {
        const urduPattern = /[\u0600-\u06FF]/;
        return urduPattern.test(word) ? 'urdu' : 'english';
    }

    /**
     * Build hierarchical tree structure for morphology
     */
    function buildMorphologyTree(morphAnalysis) {
        const rootGroups = {};

        Object.values(morphAnalysis).forEach(item => {
            const root = item.root;
            if (!rootGroups[root]) {
                rootGroups[root] = {
                    root: root,
                    language: item.language,
                    derivatives: [],
                    count: 0
                };
            }
            rootGroups[root].derivatives.push(item);
            rootGroups[root].count += item.frequency || 1;
        });

        const tree = Object.values(rootGroups)
            .sort((a, b) => b.count - a.count)
            .map(group => ({
                name: group.root,
                language: group.language,
                value: group.count,
                children: group.derivatives.map(d => ({
                    name: d.original,
                    prefix: d.prefix,
                    suffix: d.suffix,
                    value: d.frequency || 1,
                    type: d.type
                }))
            }));

        return tree;
    }

    /**
     * Extract morphological patterns
     */
    function extractPatterns(morphAnalysis) {
        const patterns = [];
        const prefixCounts = {};
        const suffixCounts = {};

        Object.values(morphAnalysis).forEach(item => {
            if (item.prefix) {
                prefixCounts[item.prefix] = (prefixCounts[item.prefix] || 0) + 1;
            }
            if (item.suffix) {
                suffixCounts[item.suffix] = (suffixCounts[item.suffix] || 0) + 1;
            }
        });

        Object.entries(prefixCounts).forEach(([prefix, count]) => {
            patterns.push({
                type: 'prefix',
                affix: prefix,
                count: count,
                examples: Object.values(morphAnalysis)
                    .filter(w => w.prefix === prefix)
                    .slice(0, 5)
                    .map(w => w.original)
            });
        });

        Object.entries(suffixCounts).forEach(([suffix, count]) => {
            patterns.push({
                type: 'suffix',
                affix: suffix,
                count: count,
                examples: Object.values(morphAnalysis)
                    .filter(w => w.suffix === suffix)
                    .slice(0, 5)
                    .map(w => w.original)
            });
        });

        return patterns.sort((a, b) => b.count - a.count);
    }

    /**
     * Calculate morphological statistics
     */
    function calculateMorphStats(morphAnalysis) {
        const total = Object.keys(morphAnalysis).length;
        const simple = Object.values(morphAnalysis).filter(w => w.type === 'simple').length;
        const derived = Object.values(morphAnalysis).filter(w => w.type === 'derived').length;
        const withPrefix = Object.values(morphAnalysis).filter(w => w.prefix).length;
        const withSuffix = Object.values(morphAnalysis).filter(w => w.suffix).length;
        const uniqueRoots = new Set(Object.values(morphAnalysis).map(w => w.root)).size;

        return {
            totalWords: total,
            simpleWords: simple,
            derivedWords: derived,
            wordsWithPrefix: withPrefix,
            wordsWithSuffix: withSuffix,
            uniqueRoots: uniqueRoots,
            derivationRatio: ((derived / total) * 100).toFixed(2) + '%',
            rootDiversity: ((uniqueRoots / total) * 100).toFixed(2) + '%'
        };
    }

    /**
     * Render morphology results in the results area
     * @param {HTMLElement} container - Container element
     * @param {object} data - Morphology data
     */
    function render(container, data) {
        if (!data || !data.statistics) {
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">🌳</div>
                    <div class="placeholder-text">No morphological data available</div>
                    <div class="placeholder-subtext">Upload files and try again</div>
                </div>
            `;
            return;
        }

        const stats = data.statistics;

        container.innerHTML = `
            <div style="padding: 20px;">
                <!-- Statistics Cards -->
                <div id="morphology-stats" style="margin-bottom: 30px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #667eea;">Morphological Statistics</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Total Words</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.totalWords}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #4daf4a 0%, #2e7d32 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(77, 175, 74, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Simple Words</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.simpleWords}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #ff7f00 0%, #d35400 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(255, 127, 0, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Derived Words</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.derivedWords}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #e41a1c 0%, #b71c1c 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(228, 26, 28, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">With Prefix</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.wordsWithPrefix}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #984ea3 0%, #6a1b9a 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(152, 78, 163, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">With Suffix</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.wordsWithSuffix}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #377eb8 0%, #1565c0 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(55, 126, 184, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Unique Roots</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.uniqueRoots}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #f9a825 0%, #f57f17 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(249, 168, 37, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Derivation Ratio</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.derivationRatio}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #00897b 0%, #00695c 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(0, 137, 123, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Root Diversity</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.rootDiversity}</div>
                        </div>
                    </div>
                </div>

                <!-- Morphology Tree Visualization -->
                <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #667eea;">Morphology Tree</h3>
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <p style="color: #6c757d; font-size: 13px; margin: 0;">
                            <strong>Legend:</strong> 
                            <span style="color: #764ba2;">● Root</span> | 
                            <span style="color: #667eea;">● Derived</span> | 
                            <span style="color: #4daf4a;">● Simple</span>
                        </p>
                    </div>
                    <div id="morphology-tree-container" style="width: 100%; height: 600px; overflow: auto;">
                        <svg id="morphology-svg" style="width: 100%; height: 100%;"></svg>
                    </div>
                </div>

                <!-- Morphological Patterns Table -->
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">Morphological Patterns</h3>
                    <div style="overflow-x: auto;">
                        <table class="kwic-table">
                            <thead>
                                <tr>
                                    <th style="width: 8%;">#</th>
                                    <th style="width: 15%;">Type</th>
                                    <th style="width: 15%;">Affix</th>
                                    <th style="width: 12%;">Count</th>
                                    <th style="width: 50%;">Examples</th>
                                </tr>
                            </thead>
                            <tbody id="morphology-patterns-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render tree visualization
        renderMorphologyTree(data.tree);

        // Display patterns
        displayMorphologyPatterns(data.patterns);
    }

    /**
     * Render morphology tree using D3.js
     */
    function renderMorphologyTree(treeData) {
        if (!window.d3) {
            console.error('D3.js is required');
            return;
        }

        const container = document.getElementById('morphology-tree-container');
        if (!container) return;

        const width = container.clientWidth || 1000;
        const height = 600;

        d3.select('#morphology-svg').selectAll('*').remove();

        const svg = d3.select('#morphology-svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', 'translate(80, 50)');

        const treeLayout = d3.tree()
            .size([height - 100, width - 250]);

        const root = d3.hierarchy({ name: 'Corpus', children: treeData.slice(0, 20) }, d => d.children);
        
        treeLayout(root);

        // Links
        g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('d', d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x))
            .attr('fill', 'none')
            .attr('stroke', '#667eea')
            .attr('stroke-width', 2)
            .attr('opacity', 0.4);

        // Nodes
        const nodes = g.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodes.append('circle')
            .attr('r', d => d.depth === 0 ? 10 : (d.data.value ? Math.sqrt(d.data.value) * 2 + 4 : 5))
            .attr('fill', d => d.depth === 0 ? '#764ba2' : (d.data.type === 'derived' ? '#667eea' : '#4daf4a'))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Labels
        nodes.append('text')
            .attr('dy', 4)
            .attr('x', d => d.children ? -15 : 15)
            .style('text-anchor', d => d.children ? 'end' : 'start')
            .style('font-size', d => d.depth === 0 ? '14px' : '12px')
            .style('font-weight', d => d.depth <= 1 ? 'bold' : 'normal')
            .style('font-family', "'Jameel Noori Nastaleeq', Arial, sans-serif")
            .text(d => d.data.name);

        // Affix labels
        nodes.filter(d => d.data.prefix || d.data.suffix)
            .append('text')
            .attr('dy', 18)
            .attr('x', 15)
            .style('text-anchor', 'start')
            .style('font-size', '10px')
            .style('fill', '#6c757d')
            .style('font-family', "'Jameel Noori Nastaleeq', Arial, sans-serif")
            .text(d => {
                const parts = [];
                if (d.data.prefix) parts.push(`↖${d.data.prefix}`);
                if (d.data.suffix) parts.push(`↘${d.data.suffix}`);
                return parts.join(' ');
            });
    }

    /**
     * Display patterns in table
     */
    function displayMorphologyPatterns(patterns) {
        const tbody = document.getElementById('morphology-patterns-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        patterns.slice(0, 50).forEach((pattern, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td style="text-align: center;">${pattern.type === 'prefix' ? '🔤 Prefix' : '🔡 Suffix'}</td>
                <td style="font-weight: bold; direction: rtl; text-align: right; font-family: 'Jameel Noori Nastaleeq', Arial, sans-serif;">${pattern.affix}</td>
                <td style="text-align: center; font-weight: 600; color: #667eea;">${pattern.count}</td>
                <td style="direction: rtl; text-align: right; font-family: 'Jameel Noori Nastaleeq', Arial, sans-serif; color: #495057;">${pattern.examples.join('، ')}</td>
            `;
        });
    }

    // Public API
    return {
        processFiles,
        render
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.morphologyModule = morphologyModule;
}