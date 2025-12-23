/**
 * bibliometrics.js
 * Features: 2-Column Grid, Tooltips (Freq & Link count), 
 * Boxed/Bubble Styles, and Master View.
 */
const bibliometricsModule = (() => {
    const colors = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#a78bfa", "#2dd4bf", "#fb923c"];
    let activeFilter = null; 

    function tokenize(text) {
        return text.toLowerCase()
            .replace(/[.,،؛:!؟()\[\]{}`\-—]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 1);
    }

    async function processSingleFile(file, minFreq) {
        const freq = {};
        const linkFreq = {};
        let concordanceMap = {};
        const text = await file.text();
        const tokens = tokenize(text);

        tokens.forEach((word, i) => {
            freq[word] = (freq[word] || 0) + 1;
            if (!concordanceMap[word]) concordanceMap[word] = [];
            if (concordanceMap[word].length < 5) {
                concordanceMap[word].push(`${tokens[i-1] || '...'} [${word}] ${tokens[i+1] || '...'}`);
            }
            if (i + 1 < tokens.length) {
                const nextWord = tokens[i + 1];
                const pair = [word, nextWord].sort().join('---');
                linkFreq[pair] = (linkFreq[pair] || 0) + 1;
            }
        });

        const nodes = Object.entries(freq)
            .map(([id, val]) => ({ 
                id, freq: val, 
                color: colors[Math.floor(Math.random() * colors.length)],
                sources: [file.name] 
            }))
            .filter(n => n.freq >= minFreq);

        const nodeIds = new Set(nodes.map(n => n.id));
        const links = Object.entries(linkFreq)
            .map(([key, value]) => {
                const [s, t] = key.split('---');
                return { source: s, target: t, value: value };
            })
            .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

        return { graph: { nodes, links }, concordance: concordanceMap, fileName: file.name };
    }

    function generateMasterData(results) {
        const masterFreq = {};
        const masterLinks = {};
        const masterConcordance = {};
        const masterSources = {};

        results.forEach(res => {
            res.graph.nodes.forEach(n => {
                masterFreq[n.id] = (masterFreq[n.id] || 0) + n.freq;
                if (!masterConcordance[n.id]) masterConcordance[n.id] = [];
                masterConcordance[n.id].push(...res.concordance[n.id]);
                if (!masterSources[n.id]) masterSources[n.id] = new Set();
                masterSources[n.id].add(res.fileName);
            });
            res.graph.links.forEach(l => {
                const sId = l.source.id || l.source;
                const tId = l.target.id || l.target;
                const pair = [sId, tId].sort().join('---');
                masterLinks[pair] = (masterLinks[pair] || 0) + l.value;
            });
        });

        const nodes = Object.entries(masterFreq).map(([id, freq]) => ({
            id, freq, color: colors[Math.floor(Math.random() * colors.length)],
            sources: Array.from(masterSources[id])
        }));
        const links = Object.entries(masterLinks).map(([key, val]) => {
            const [s, t] = key.split('---');
            return { source: s, target: t, value: val };
        });

        return { graph: { nodes, links }, concordance: masterConcordance, fileName: "Master Combined View" };
    }

    async function processFiles(files, query, minFreq) {
        const results = [];
        for (const file of files) {
            results.push(await processSingleFile(file, minFreq));
        }
        return results;
    }

    function render(container, dataArray, chartType) {
        container.innerHTML = '';
        if (!document.getElementById('bib-global-styles')) {
            const style = document.createElement('style');
            style.id = 'bib-global-styles';
            style.textContent = `
                .bib-grid-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(48%, 1fr)); gap: 20px; width: 100%; }
                .bib-column { display: flex; flex-direction: column; gap: 10px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #f8fafc; }
                .bib-viz-area { height: 400px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; position: relative; }
                .bib-table-wrapper { height: 250px; overflow-y: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; }
                .bib-grid-table { width: 100%; border-collapse: collapse; direction: rtl; text-align: right; font-size: 13px; }
                .bib-grid-table th { background: #1e293b; color: #fff; padding: 8px; position: sticky; top: 0; }
                .bib-grid-table td { padding: 8px; border: 1px solid #e2e8f0; }
                .bib-tooltip { position: absolute; padding: 8px; background: rgba(0,0,0,0.8); color: #fff; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 100; display: none; }
                .bib-toolbar { display: flex; gap: 10px; margin-bottom: 5px; }
                .search-bar { flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #cbd5e1; direction: rtl; }
            `;
            document.head.appendChild(style);
        }

        const tooltip = d3.select(container).append("div").attr("class", "bib-tooltip");
        const nav = d3.select(container).append("div").attr("style", "margin-bottom:20px; display:flex; gap:10px;");
        const displayArea = d3.select(container).append("div").attr("class", "bib-grid-layout");

        const renderLogic = (dataToRender) => {
            displayArea.selectAll("*").remove();
            dataToRender.forEach((data, idx) => {
                const col = displayArea.append("div").attr("class", "bib-column");
                col.append("h4").text(data.fileName).attr("style", "margin:0; color:#475569;");
                
                const toolbar = col.append("div").attr("class", "bib-toolbar");
                const search = toolbar.append("input").attr("class", "search-bar").attr("placeholder", "تلاش کریں...");

                const viz = col.append("div").attr("id", `viz-${idx}`).attr("class", "bib-viz-area");
                const tabWrap = col.append("div").attr("class", "bib-table-wrapper");

                const network = renderNetwork(viz.node(), data, chartType, tabWrap.node(), tooltip);
                renderTable(tabWrap.node(), data, network);

                search.on("input", (e) => {
                    const term = e.target.value.trim();
                    if(!term) { resetView(network, tabWrap.node(), data); return; }
                    const node = data.graph.nodes.find(n => n.id.includes(term));
                    if(node) {
                        highlightAndCluster(node, data.graph.links, network);
                        renderTable(tabWrap.node(), data, network, node.id);
                    }
                });
            });
        };

        if (dataArray.length > 1) {
            const masterData = generateMasterData(dataArray);
            nav.append("button").attr("class", "bib-btn").text("🌐 Master Graph").on("click", () => renderLogic([masterData]));
            nav.append("button").attr("class", "bib-btn").text("📄 Side-by-Side View").on("click", () => renderLogic(dataArray));
            renderLogic([masterData]);
        } else { renderLogic(dataArray); }
    }

    function renderNetwork(vizArea, data, shapeType, tableContainer, tooltip) {
        const { nodes, links } = data.graph;
        const width = vizArea.clientWidth;
        const svg = d3.select(vizArea).append("svg").attr("width", "100%").attr("height", "100%");
        const g = svg.append("g");
        const zoom = d3.zoom().on("zoom", (e) => g.attr("transform", e.transform));
        svg.call(zoom);

        const sim = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, 200));

        const linkElements = g.append("g").selectAll("line").data(links).join("line")
            .attr("stroke", "#cbd5e1").attr("stroke-width", d => Math.sqrt(d.value) + 1)
            .on("mouseover", (e, d) => {
                tooltip.style("display", "block").html(`تعلق: <b>${d.source.id} & ${d.target.id}</b><br>تعداد: ${d.value}`);
            })
            .on("mousemove", (e) => tooltip.style("left", (e.pageX + 10) + "px").style("top", (e.pageY - 20) + "px"))
            .on("mouseout", () => tooltip.style("display", "none"));

        const nodeGroups = g.append("g").selectAll("g").data(nodes).join("g").attr("cursor", "pointer")
            .on("mouseover", (e, d) => {
                tooltip.style("display", "block").html(`لفظ: <b>${d.id}</b><br>تعدد: ${d.freq}`);
            })
            .on("mousemove", (e) => tooltip.style("left", (e.pageX + 10) + "px").style("top", (e.pageY - 20) + "px"))
            .on("mouseout", () => tooltip.style("display", "none"))
            .on("click", (e, d) => {
                highlightAndCluster(d, links, {nodeGroups, links: linkElements, sim});
                renderTable(tableContainer, data, {nodeGroups, links: linkElements, sim}, d.id);
            });

        if (shapeType === 'bubble') {
            nodeGroups.append("circle").attr("r", d => Math.sqrt(d.freq) * 3 + 10).attr("fill", d => d.color).attr("stroke", "#fff");
        } else {
            nodeGroups.append("rect").attr("x", d => -(d.id.length * 4 + 10)).attr("y", -15).attr("width", d => d.id.length * 8 + 20).attr("height", 30).attr("rx", 5).attr("fill", d => d.color).attr("stroke", "#fff");
        }

        nodeGroups.append("text").attr("dy", 5).attr("text-anchor", "middle").style("font-size", "12px").text(d => d.id);

        sim.on("tick", () => {
            linkElements.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            nodeGroups.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return { nodeGroups, links: linkElements, sim, svg, zoom };
    }

    function renderTable(container, data, network, filterId = null) {
        let sorted = [...data.graph.nodes].sort((a,b) => b.freq - a.freq);
        if (filterId) sorted = sorted.filter(n => n.id === filterId);

        let html = `<table class="bib-grid-table"><thead><tr><th>لفظ</th><th>تعدد</th><th>روابط</th><th>ماخذ</th></tr></thead><tbody>`;
        sorted.forEach(n => {
            // Calculate how many links this word has
            const linkCount = data.graph.links.filter(l => l.source.id === n.id || l.target.id === n.id || l.source === n.id || l.target === n.id).length;
            html += `<tr><td><b>${n.id}</b></td><td>${n.freq}</td><td>${linkCount}</td><td>${n.sources.join(', ')}</td></tr>`;
        });
        container.innerHTML = html + `</tbody></table>`;
    }

    function highlightAndCluster(d, allLinks, network) {
        const neighbors = new Set([d.id]);
        allLinks.forEach(l => {
            const s = l.source.id || l.source; const t = l.target.id || l.target;
            if (s === d.id) neighbors.add(t); if (t === d.id) neighbors.add(s);
        });
        network.nodeGroups.style("display", n => neighbors.has(n.id) ? "inline" : "none");
        network.links.style("display", l => {
            const s = l.source.id || l.source; const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? "inline" : "none";
        });
        network.sim.alphaTarget(0.2).restart();
    }

    function resetView(network, tableContainer, data) {
        network.nodeGroups.style("display", "inline");
        network.links.style("display", "inline");
        network.sim.alphaTarget(0);
        renderTable(tableContainer, data, network);
    }

    return { processFiles, render };
})();
window.bibliometricsModule = bibliometricsModule;