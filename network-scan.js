const { exec } = require('child_process');
const fs = require('fs');
const xml2js = require('xml2js');

// Function to check if Nmap is installed
const checkNmapInstalled = (callback) => {
    exec('nmap --version', (error, stdout, stderr) => {
        if (error) {
            console.log('Nmap is not installed. Installing Nmap...');
            installNmap(callback);
        } else {
            console.log('Nmap is already installed.');
            callback();
        }
    });
};

// Function to install Nmap
const installNmap = (callback) => {
    const installCommand = process.platform === 'win32' ? 'choco install nmap' : 'sudo apt-get install -y nmap';
    exec(installCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error installing Nmap: ${error.message}`);
            return;
        }

        if (stderr) {
            console.error(`Installation stderr: ${stderr}`);
            return;
        }

        console.log('Nmap installation complete.');
        callback();
    });
};

// Function to run Nmap scan
const runNmapScan = (target = '192.168.1.0/24', outputFile = 'nmap_output.xml') => {
    exec(`nmap -oX ${outputFile} ${target}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Nmap: ${error.message}`);
            return;
        }

        if (stderr) {
            console.error(`Nmap stderr: ${stderr}`);
            return;
        }

        console.log(`Nmap scan complete. Output saved to ${outputFile}`);
        parseNmapXml(outputFile);
    });
};

// Function to parse Nmap XML output
const parseNmapXml = (xmlFile) => {
    const parser = new xml2js.Parser();
    fs.readFile(xmlFile, (err, data) => {
        if (err) {
            console.error(`Error reading XML file: ${err.message}`);
            return;
        }

        parser.parseString(data, (err, result) => {
            if (err) {
                console.error(`Error parsing XML: ${err.message}`);
                return;
            }

            const networkData = result.nmaprun.host.map(host => {
                const ip = host.address[0].$.addr;
                const hostname = host.hostnames[0].hostname ? host.hostnames[0].hostname[0].$.name : 'Unknown';
                return { ip, hostname };
            });

            generateHtml(networkData);
        });
    });
};

// Function to generate HTML with D3.js visualization
const generateHtml = (networkData) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Network Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        .node {
            stroke: #fff;
            stroke-width: 1.5px;
        }
        .link {
            stroke: #999;
            stroke-opacity: 0.6;
        }
    </style>
</head>
<body>
    <svg width="960" height="600"></svg>
    <script>
        const networkData = ${JSON.stringify(networkData)};

        const svg = d3.select("svg"),
              width = +svg.attr("width"),
              height = +svg.attr("height");

        const simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.ip))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const graph = {
            nodes: networkData,
            links: networkData.map((node, index) => ({
                source: 0,
                target: index
            })).slice(1)
        };

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link");

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graph.nodes)
            .enter().append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("title")
            .text(d => d.hostname + " (" + d.ip + ")");

        simulation
            .nodes(graph.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(graph.links);

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    </script>
</body>
</html>
    `;

    fs.writeFile('network_visualization.html', htmlContent, (err) => {
        if (err) {
            console.error(`Error writing HTML file: ${err.message}`);
            return;
        }

        console.log('Network visualization HTML generated: network_visualization.html');
    });
};

// Main function to check and install Nmap, then run the scan
const main = () => {
    checkNmapInstalled(() => {
        runNmapScan();
    });
};

main();
