const { exec, execSync } = require('child_process');
const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

// Dynamically import chalk
let chalk;
import('chalk').then((module) => {
    chalk = module.default;
    main();
}).catch((error) => {
    console.error('Error importing chalk:', error);
});

// Function to check if Chocolatey is installed (Windows only)
const checkChocolateyInstalled = (callback) => {
    exec('choco --version', (error, stdout, stderr) => {
        if (error) {
            console.log(chalk.red('Chocolatey is not installed. Please install Chocolatey first.'));
            return;
        } else {
            console.log(chalk.green('Chocolatey is already installed.'));
            callback();
        }
    });
};

// Function to install Chocolatey (Windows only)
const installChocolatey = (callback) => {
    const installCommand = 'Set-ExecutionPolicy Bypass -Scope Process -Force; ' +
        '[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ' +
        'iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))';

    exec(`powershell.exe -Command "${installCommand}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(chalk.red(`Error installing Chocolatey: ${error.message}`));
            console.error(chalk.red(`stderr: ${stderr}`));
            console.error(chalk.red(`stdout: ${stdout}`));
            return;
        }

        if (stderr) {
            console.error(chalk.yellow(`Installation stderr: ${stderr}`));
        }

        console.log(chalk.green(`Installation stdout: ${stdout}`));
        console.log(chalk.green('Chocolatey installation complete.'));
        callback();
    });
};

// Function to check if Nmap is installed
const checkNmapInstalled = (callback) => {
    exec('nmap --version', (error, stdout, stderr) => {
        if (error) {
            console.log(chalk.yellow('Nmap is not installed. Installing Nmap...'));
            installNmap(callback);
        } else {
            console.log(chalk.green('Nmap is already installed.'));
            callback();
        }
    });
};

// Function to install Nmap
const installNmap = (callback) => {
    let installCommand;

    if (process.platform === 'win32') {
        checkChocolateyInstalled(() => {
            installCommand = 'choco install nmap -y';
            console.log(chalk.yellow('Attempting to install Nmap using Chocolatey...'));
            executeInstallCommand(installCommand, callback);
        });
    } else if (process.platform === 'darwin') {
        installCommand = 'brew install nmap';
        console.log(chalk.yellow('Attempting to install Nmap using Homebrew...'));
        executeInstallCommand(installCommand, callback);
    } else {
        installCommand = 'sudo apt-get install -y nmap';
        console.log(chalk.yellow('Attempting to install Nmap using apt-get...'));
        executeInstallCommand(installCommand, callback);
    }
};

// Function to execute the installation command
const executeInstallCommand = (installCommand, callback) => {
    exec(installCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(chalk.red(`Error installing Nmap: ${error.message}`));
            console.error(chalk.red(`stderr: ${stderr}`));
            console.error(chalk.red(`stdout: ${stdout}`));
            return;
        }

        if (stderr) {
            console.error(chalk.yellow(`Installation stderr: ${stderr}`));
        }

        console.log(chalk.green(`Installation stdout: ${stdout}`));
        console.log(chalk.green('Nmap installation complete.'));
        refreshEnv(() => {
            callback();
        });
    });
};

// Function to refresh environment variables (Windows only)
const refreshEnv = (callback) => {
    if (process.platform === 'win32') {
        const refreshCommand = 'Import-Module "$env:ChocolateyInstall\\helpers\\chocolateyProfile.psm1"; refreshenv';
        exec(`powershell.exe -Command "${refreshCommand}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(chalk.red(`Error refreshing environment: ${error.message}`));
                console.error(chalk.red(`stderr: ${stderr}`));
                console.error(chalk.red(`stdout: ${stdout}`));
                return;
            }

            if (stderr) {
                console.error(chalk.yellow(`Refresh env stderr: ${stderr}`));
            }

            console.log(chalk.green(`Refresh env stdout: ${stdout}`));
            callback();
        });
    } else {
        callback();
    }
};

// Function to locate Nmap executable
const locateNmap = () => {
    const possiblePaths = [
        'C:\\Program Files\\Nmap\\nmap.exe',
        'C:\\Program Files (x86)\\Nmap\\nmap.exe'
    ];

    for (const nmapPath of possiblePaths) {
        if (fs.existsSync(nmapPath)) {
            return nmapPath;
        }
    }

    try {
        const nmapPath = execSync('where nmap').toString().trim();
        if (fs.existsSync(nmapPath)) {
            return nmapPath;
        }
    } catch (error) {
        console.error(chalk.red(`Error locating Nmap: ${error.message}`));
    }

    throw new Error('Nmap executable not found.');
};

// Function to run Nmap scan
const runNmapScan = (target, outputFile = 'nmap_output.xml') => {
    try {
        const nmapPath = locateNmap();
        const command = `"${nmapPath}" -A -T4 -oX ${outputFile} ${target}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(chalk.red(`Error executing Nmap: ${error.message}`));
                return;
            }

            if (stderr) {
                console.error(chalk.yellow(`Nmap stderr: ${stderr}`));
            }

            console.log(chalk.green(`Nmap scan complete. Output saved to ${outputFile}`));
            parseNmapXml(outputFile);
        });
    } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
    }
};

// Function to parse Nmap XML output
const parseNmapXml = (xmlFile) => {
    const parser = new xml2js.Parser();
    fs.readFile(xmlFile, (err, data) => {
        if (err) {
            console.error(chalk.red(`Error reading XML file: ${err.message}`));
            return;
        }

        parser.parseString(data, (err, result) => {
            if (err) {
                console.error(chalk.red(`Error parsing XML: ${err.message}`));
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

        const g = svg.append("g");

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        const simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.ip).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const graph = {
            nodes: networkData,
            links: networkData.map((node, index) => ({
                source: networkData[0].ip,
                target: node.ip
            })).slice(1)
        };

        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link");

        const node = g.append("g")
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
            console.error(chalk.red(`Error writing HTML file: ${err.message}`));
            return;
        }

        console.log(chalk.green('Network visualization HTML generated: network_visualization.html'));
    });
};

// Main function to check and install Nmap, then run the scan
const main = () => {
    const targetRange = process.argv[2] || '192.168.200.0/24'; // Get IP range from command-line arguments or use default
    checkNmapInstalled(() => {
        runNmapScan(targetRange);
    });
};

main();
