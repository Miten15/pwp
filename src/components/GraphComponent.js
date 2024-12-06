import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Network, Server, Router, Monitor, Cpu } from 'lucide-react';
import ReactDOMServer from "react-dom/server";
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";
import { CircuitBoard } from 'lucide-react';

// Add CSS for the blinking animation and other visual effects
const styles = `
  @keyframes blink {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }
  .status-indicator {
    animation: blink 2s infinite;
  }
  .node text {
    text-shadow: 0 0 10px rgba(255,255,255,0.3);
    font-weight: 500;
  }
  .link {
    stroke: rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;
  }
  .link:hover {
    stroke: rgba(255, 255, 255, 0.8);
  }
`;

const GraphComponent = ({ data }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    // Add the styles to the document
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format. Expected an array with "mac_data".');
      return;
    }

    const macData = data[0].mac_data;
    const nodes = [];
    const links = [];
    const unknownNodes = [];

    // Define cluster nodes with fixed positions, larger areas, and icons
    const clusters = {
      IT: {
        id: "IT_Cluster",
        label: "IT Cluster",
        color: "#4287f5",
        x: 400,
        y: 800,
        width: 600,
        height: 1800,
        icon: CiServer,
      },
      Network: {
        id: "Network_Cluster",
        label: "Network Cluster",
        color: "#f54242",
        x: 950,
        y: 600,
        width: 600,
        height: 1800,
        icon: CiRouter,
      },
      OT: {
        id: "OT_Cluster",
        label: "OT Cluster",
        color: "#42f54e",
        x: 1500,
        y: 800,
        width: 600,
        height: 1800,
        icon: Network,
      },
    };

    // Add cluster nodes
    Object.values(clusters).forEach((cluster) => {
      nodes.push({
        ...cluster,
        fx: cluster.x,
        fy: cluster.y,
      });
    });

    // Add inter-cluster links
    const clusterLinks = [
      {
        source: "IT_Cluster",
        target: "Network_Cluster",
        protocol: "Inter-cluster Communication",
      },
      {
        source: "Network_Cluster",
        target: "OT_Cluster",
        protocol: "Inter-cluster Communication",
      },
      {
        source: "OT_Cluster",
        target: "IT_Cluster",
        protocol: "Inter-cluster Communication",
      },
    ];
    links.push(...clusterLinks);

    // Process device nodes and create links based on connections
    const nodeMap = new Map();

    macData.forEach((category) => {
      const deviceType = Object.keys(category)[0].split(" ")[0];
      const devices = category[Object.keys(category)[0]];

      devices.forEach((device, deviceIndex) => {
        const cluster = clusters[deviceType];
        const gridSize = 150;
        const gridX = cluster.x + (Math.floor(deviceIndex / 5) * gridSize);
        const gridY = cluster.y + ((deviceIndex % 5) * gridSize);

        const deviceNode = {
          id: device.MAC,
          IP: Array.isArray(device.IP) ? device.IP.join(", ") : device.IP,
          MAC: device.MAC,
          Vendor: device.Vendor,
          Protocol: Array.isArray(device.Protocol)
            ? device.Protocol.join(", ")
            : device.Protocol,
          Port: Array.isArray(device.Port)
            ? device.Port.join(", ")
            : device.Port,
          status: device.status,
          type: deviceType,
          connections: device[device.MAC],
          x: gridX,
          y: gridY,
        };
        nodeMap.set(device.MAC, deviceNode);

        // Create links based on device connections
        if (Array.isArray(device[device.MAC])) {
          device[device.MAC].forEach((connectedMAC) => {
            if (connectedMAC !== "00:00:00:00:00:00") {
              links.push({
                source: device.MAC,
                target: connectedMAC,
                protocol: Array.isArray(device.Protocol)
                  ? device.Protocol
                  : [device.Protocol],
              });

              // Ensure the connected node exists
              if (!nodeMap.has(connectedMAC)) {
                nodeMap.set(connectedMAC, {
                  id: connectedMAC,
                  MAC: connectedMAC,
                  type: "Unknown",
                  Vendor: "Unknown",
                  status: "false",
                });
              }
            }
          });
        }

        // Add link to cluster
        links.push({
          source: device.MAC,
          target: `${deviceType}_Cluster`,
          protocol: Array.isArray(device.Protocol)
            ? device.Protocol
            : [device.Protocol],
        });
      });
    });

    // Convert nodeMap to nodes array
    nodes.push(...nodeMap.values());

    // Separate unknown nodes for individual simulation
    unknownNodes.push(...nodeMap.values().filter(node => node.type === "Unknown"));

    const width = 1950;
    const height = 1200;

    // Remove existing tooltips
    d3.selectAll(".graph-tooltip").remove();
    d3.selectAll(".link-tooltip").remove();

    // Create node tooltip with mouse following behavior
    const tooltipContainer = d3
      .select("body")
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("width", "max-content")
      .style("max-width", "600px")
      .style("background-color", "#1a1a1a")
      .style("color", "white")
      .style("padding", "12px 16px")
      .style("border", "1px solid rgba(255, 255, 255, 0.1)")
      .style("border-radius", "8px")
      .style("font-size", "13px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 9999)
      .style("box-shadow", "0 4px 16px rgba(0, 0, 0, 0.4)")
      .style("backdrop-filter", "blur(8px)")
      .style("transition", "opacity 0.2s ease-out")
      .style("overflow-wrap", "break-word")
      .style("word-wrap", "break-word");

    // Create link tooltip with smooth animation
    const linkTooltip = d3
      .select("body")
      .append("div")
      .attr("class", "link-tooltip")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 9999)
      .style("transition", "all 0.2s ease-out");

    // Clear existing SVG content
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Add a subtle gradient background
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "bg-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("style", "stop-color:#1a1a1a;stop-opacity:1");

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("style", "stop-color:#2d2d2d;stop-opacity:1");

    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#bg-gradient)");


    svg.selectAll("*").remove();

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create a container for all elements
    const container = svg.append("g");

    // Create arrow marker for links
    svg
      .append("defs")
      .selectAll("marker")
      .data(["end"])
      .join("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(200).strength(0.2))
      .force("charge", d3.forceManyBody().strength(-1500))
      .force("collision", d3.forceCollide().radius(80).strength(0.9))
      .force("x", d3.forceX(d => {
        if (d.id.includes("Cluster")) return d.fx;
        const gridSize = 200;
        return Math.round(d.x / gridSize) * gridSize;
      }).strength(0.3))
      .force("y", d3.forceY(d => {
        if (d.id.includes("Cluster")) return d.fy;
        const gridSize = 200;
        return Math.round(d.y / gridSize) * gridSize;
      }).strength(0.3));


    // Update the unknown nodes simulation
    const unknownSimulation = d3.forceSimulation(unknownNodes)
      .force("x", d3.forceX(width * 0.95).strength(0.7))
      .force("y", d3.forceY(height * 0.95).strength(0.7))
      .force("collision", d3.forceCollide().radius(40));

    // Draw links with curved paths
    const linkHitArea = container
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", "transparent")
      .attr("stroke-width", 10)
      .attr("fill", "none")
      .on("mouseover", (event, d) => {
        const content = `
          <strong>Protocols:</strong><br>
          ${Array.isArray(d.protocol) ? d.protocol.join("<br>") : d.protocol}
        `;

        const mouseX = event.pageX;
        const mouseY = event.pageY;

        linkTooltip
          .html(content)
          .style("left", `${mouseX + 15}px`)
          .style("top", `${mouseY}px`)
          .style("opacity", 1);

        // Highlight the corresponding visible link
        link
          .filter((l) => l === d)
          .attr("stroke-opacity", 1)
          .attr("stroke-width", (d) =>
            d.source.id?.includes("Cluster") && d.target.id?.includes("Cluster")
              ? 4
              : 2
          );
      })
      .on("mouseout", (event, d) => {
        linkTooltip.style("opacity", 0);
        link
          .filter((l) => l === d)
          .attr("stroke-opacity", 0.4)
          .attr("stroke-width", (d) =>
            d.source.id?.includes("Cluster") && d.target.id?.includes("Cluster")
              ? 2
              : 1
          );
      });

    // Draw nodes with improved hit detection
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    // Add hit area for better interaction
    const nodeHitArea = nodeGroup
      .append("rect")
      .attr("width", 24)
      .attr("height", 24)
      .attr("x", -12)
      .attr("y", -12)
      .attr("fill", "transparent")
      .style("pointer-events", "all");

    // Add icons for all nodes
    const getIconForDevice = (type) => {
      const iconMap = {
        IT: CiDesktop,
        OT: CircuitBoard,
        Network: Router,
        IT_Cluster: CiServer,
        OT_Cluster: Network,
        Network_Cluster: CiRouter,
      };
      return iconMap[type] || Network;
    };

    nodeGroup.each(function (d) {
      const IconComponent = getIconForDevice(d.type || d.id);
      if (IconComponent) {
        const foreignObject = d3
          .select(this)
          .append("foreignObject")
          .attr("width", 24)
          .attr("height", 24)
          .attr("x", -12)
          .attr("y", -12)
          .style("pointer-events", "none");

        const div = foreignObject
          .append("xhtml:div")
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "flex")
          .style("align-items", "center")
          .style("justify-content", "center")
          .style("pointer-events", "none");

        const icon = document.createElement("div");
        icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
          <IconComponent
            width={16}
            height={16}
            stroke="white"
            strokeWidth={1}
          />
        );
        div.node().appendChild(icon.firstChild);
      }

      // Add status indicator dot below the icon
      if (!d.id.includes("Cluster")) {
        d3.select(this)
          .append("circle")
          .attr("class", "status-indicator")
          .attr("r", 3)
          .attr("cx", 0)
          .attr("cy", 14)
          .attr("fill", d.status === "true" ? "#00ff00" : "#ff0000")
          .style("pointer-events", "none");
      }

      if (d.id.includes("Cluster")) {
        d3.select(this)
          .append("circle")
          .attr("r", 30)
          .attr("fill", d.color || "#666")
          .attr("opacity", 0.3)
          .style("pointer-events", "none");
      }
    });

    // Add labels with pointer-events disabled and collision detection
    const labels = nodeGroup
      .append("text")
      .attr("dy", (d) => (d.id.includes("Cluster") ? -30 : -18))
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "12px")
      .style("pointer-events", "none")
      .text((d) => (d.id.includes("Cluster") ? d.label : d.Vendor));

    // Enhanced tooltip behavior with mouse following and dynamic sizing
    const showTooltip = (event, d) => {
      if (!d.id.includes("Cluster")) {
        const content = `
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; gap: 4px;">
              <div style="display: flex; gap: 8px; align-items: start;">
                <div style="color: rgba(255,255,255,0.7); min-width: 70px;">MAC:</div>
                <div style="font-family: monospace; word-break: break-all;">${
                  d.MAC
                }</div>
              </div>
              <div style="display: flex; gap: 8px; align-items: start;">
                <div style="color: rgba(255,255,255,0.7); min-width: 70px;">IP:</div>
                <div style="font-family: monospace;">${d.IP || "N/A"}</div>
              </div>
              <div style="display: flex; gap: 8px; align-items: start;">
                <div style="color: rgba(255,255,255,0.7); min-width: 70px;">Vendor:</div>
                <div>${d.Vendor || "Unknown"}</div>
              </div>
              <div style="display: flex; gap: 8px; align-items: start;">
                <div style="color: rgba(255,255,255,0.7); min-width: 70px;">Type:</div>
                <div>${d.type}</div>
              </div>
              <div style="display: flex; gap: 8px; align-items: start;">
                <div style="color: rgba(255,255,255,0.7); min-width: 70px;">Status:</div>
                <div>${d.status === "true" ? "Active" : "Inactive"}</div>
              </div>
              ${
                d.connections
                  ? `
              <div style="display: grid; gap: 8px;">
                  <div style="color: rgba(255,255,255,0.7);">Connected to:</div>
                   <div style="display: grid; grid-template-columns: repeat(3, auto); gap: 8px; font-family: monospace;">
                     ${d.connections
                       .map((conn) => `<div>${conn}</div>`)
                       .join("")}
                   </div>
              </div>
              `
                  : ""
              }
            </div>
          </div>
        `;

        const mouseX = event.pageX;
        const mouseY = event.pageY;

        // First position the tooltip off-screen to measure its size
        tooltipContainer
          .html(content)
          .style("left", "-9999px")
          .style("top", "-9999px")
          .style("opacity", "0")
          .style("display", "block");

        // Get the actual dimensions after rendering content
        const tooltipNode = tooltipContainer.node();
        const tooltipRect = tooltipNode.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        // Calculate position to keep tooltip within viewport
        let left = mouseX + 20;
        let top = mouseY - 10;

        // Adjust horizontal position if tooltip would overflow viewport
        if (left + tooltipWidth > window.innerWidth - 20) {
          left = mouseX - tooltipWidth - 20;
        }

        // Adjust vertical position if tooltip would overflow viewport
        if (top + tooltipHeight > window.innerHeight - 20) {
          top = window.innerHeight - tooltipHeight - 20;
        }

        // Apply the calculated position
        tooltipContainer
          .style("left", `${left}px`)
          .style("top", `${top}px`)
          .style("opacity", 1);

        // Highlight the node
        d3.select(event.currentTarget.parentNode)
          .select("foreignObject")
          .transition()
          .duration(200)
          .attr("width", 28)
          .attr("height", 28)
          .attr("x", -14)
          .attr("y", -14);
      }
    };

    const hideTooltip = (event) => {
      tooltipContainer.transition().duration(200).style("opacity", 0);

      d3.select(event.currentTarget.parentNode)
        .select("foreignObject")
        .transition()
        .duration(200)
        .attr("width", 24)
        .attr("height", 24)
        .attr("x", -12)
        .attr("y", -12);
    };

    // Update mousemove handler for smooth tooltip following
    nodeHitArea
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip)
      .on("mousemove", (event, d) => {
        if (!d.id.includes("Cluster")) {
          const x = event.clientX + window.pageXOffset;
          const y = event.clientY + window.pageYOffset;

          tooltipContainer
            .style("left", `${x + 15}px`)
            .style("top", `${y - 10}px`);
        }
      });

    // Modified linkArc function to create straight lines
    function linkArc(d) {
      const sourceNode = d.source;
      const targetNode = d.target;

      // Calculate the angle between nodes
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const angle = Math.atan2(dy, dx);

      // Set offset based on node type
      const sourceOffset = sourceNode.id?.includes("Cluster") ? 30 : 12;
      const targetOffset = targetNode.id?.includes("Cluster") ? 30 : 12;

      // Calculate start and end points
      const startX = sourceNode.x + Math.cos(angle) * sourceOffset;
      const startY = sourceNode.y + Math.sin(angle) * sourceOffset;
      const endX = targetNode.x - Math.cos(angle) * targetOffset;
      const endY = targetNode.y - Math.sin(angle) * targetOffset;

      // Return a straight line path
      return `M${startX},${startY}L${endX},${endY}`;
    }

    // Update link paths to use straight lines
    const link = container
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", d => 
        d.source.id?.includes("Cluster") && d.target.id?.includes("Cluster")
          ? 2
          : 1
      )
      .attr("fill", "none")
      .attr("marker-end", "url(#arrow)")
      .on("mouseover", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-opacity", 0.8)
          .attr("stroke-width", d => 
            d.source.id?.includes("Cluster") && d.target.id?.includes("Cluster")
              ? 3
              : 2
          );
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-opacity", 0.15)
          .attr("stroke-width", d => 
            d.source.id?.includes("Cluster") && d.target.id?.includes("Cluster")
              ? 2
              : 1
          );
      });

    // Simulation update
    simulation.on("tick", () => {
      // Update link paths
      link.attr("d", linkArc);
      linkHitArea.attr("d", linkArc);

      // Update node positions
      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    unknownSimulation.on("tick", () => {
      // Update node positions for unknown nodes
      unknownNodes.forEach(node => {
        node.x = Math.round(node.x / 150) * 150;
        node.y = Math.round(node.y / 150) * 150;
      });
    });

    // Add double-click behavior for centering view
    nodeHitArea.on("dblclick", (event, d) => {
      event.stopPropagation();

      const transform = d3.zoomTransform(svg.node());
      const scale = transform.k;
      const x = width / 2 - d.x * scale;
      const y = height / 2 - d.y * scale;

      svg
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    });

    // Add double-click on background to reset zoom
    svg.on("dblclick", (event) => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    // Add legend
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(20, 20)`);

    // Add status legend
    const statusLegend = legend
      .append("g")
      .attr("transform", "translate(0, 0)");

    statusLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("fill", "white")
      .text("Status:");

    const statusItems = [
      { label: "Active", color: "#00ff00" },
      { label: "Inactive", color: "#ff0000" },
    ];

    statusItems.forEach((item, i) => {
      const g = statusLegend
        .append("g")
        .attr("transform", `translate(0, ${i * 25 + 15})`);

      g.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", item.color);

      g.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .attr("fill", "white")
        .text(item.label);
    });

    // Add node type legend
    const typeLegend = legend.append("g").attr("transform", "translate(0, 80)");

    typeLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("fill", "white")
      .text("Node Types:");

    const nodeTypes = [
      { type: "IT", label: "IT", icon: CiDesktop },
      { type: "Network", label: "Network", icon: Router },
      { type: "OT", label: "OT", icon: CircuitBoard },
    ];

    nodeTypes.forEach((item, i) => {
      const g = typeLegend
        .append("g")
        .attr("transform", `translate(0, ${i * 25 + 15})`);

      const icon = document.createElement("div");
      icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
        <item.icon width={16} height={16} stroke="white" strokeWidth={1} />
      );

      g.append("foreignObject")
        .attr("width", 16)
        .attr("height", 16)
        .style("pointer-events", "none")
        .append("xhtml:div")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .node()
        .appendChild(icon.firstChild);

      g.append("text")
        .attr("x", 24)
        .attr("y", 12)
        .attr("fill", "white")
        .text(item.label);
    });

    // Add instructions text
    const instructions = svg
      .append("g")
      .attr("class", "instructions")
      .attr("transform", `translate(20, ${height - 60})`);

    instructions
      .append("text")
      .attr("fill", "white")
      .attr("opacity", 0.7)
      .selectAll("tspan")
      .data([
        "Instructions:",
        "• Hover over nodes to see details",
        "• Double-click node to center view",
        "• Double-click background to reset view",
        "• Drag nodes to reposition",
      ])
      .join("tspan")
      .attr("x", 0)
      .attr("dy", (d, i) => (i === 0 ? 0 : "1.2em"))
      .text((d) => d);

    // Cleanup function
    return () => {
      simulation.stop();
      unknownSimulation.stop();
      d3.selectAll(".graph-tooltip").remove();
      d3.selectAll(".link-tooltip").remove();
      document.head.removeChild(styleSheet);
    };
  }, [data]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphComponent;

