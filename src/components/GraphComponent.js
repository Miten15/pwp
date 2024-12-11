import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Network, Server, Router, Monitor, Cpu, Laptop, Database } from 'lucide-react';
import ReactDOMServer from "react-dom/server";
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";

// Add after imports
const sanitizeId = (str) => str.replace(/[^a-zA-Z0-9]/g, '_');

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
  .cluster-boundary {
    fill: none;
    stroke-width: 2;
    stroke-dasharray: 5;
  }
  .cluster-center {
    fill: rgba(255, 255, 255, 0.1);
  }
  .node-not-found {
    opacity: 0.5;
  }
  .graph-tooltip {
    position: fixed;
    background-color: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 14px;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 300px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .graph-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    z-index: 50;
    pointer-events: all;
  }
  .graph-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 40;
  }
`;

const GraphComponent = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format');
      return;
    }

    const width = 1600;
    const height = 1200;
    const verticalSpacing = height / 3;

    // Define clusters with increased spacing
    const clusters = {
      IT: {
        id: "IT_Cluster",
        label: "IT",
        color: "#ffffff",
        x: width * 0.25,
        y: height * 0.3,
        radius: 250,
        icon: Laptop,
        nodeIcon: Laptop
      },
      Network: {
        id: "Network_Cluster",
        label: "Network",
        color: "#3b82f6",
        x: width * 0.75,
        y: height * 0.3,
        radius: 250,
        icon: Router,
        nodeIcon: Router
      },
      OT: {
        id: "OT_Cluster",
        label: "OT",
        color: "#f97316",
        x: width * 0.5,
        y: height * 0.7,
        radius: 250,
        icon: Cpu,
        nodeIcon: Cpu
      },
    };

    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // Add cluster center nodes
    Object.values(clusters).forEach((cluster) => {
      const clusterNode = {
        ...cluster,
        fx: cluster.x,
        fy: cluster.y,
        isCluster: true,
      };
      nodes.push(clusterNode);
      nodeMap.set(cluster.id, clusterNode);
    });

    // Process device nodes
    data[0].mac_data.forEach((category) => {
      const deviceType = Object.keys(category)[0].split(" ")[0];
      const devices = category[Object.keys(category)[0]];

      devices.forEach((device) => {
        const deviceNode = {
          id: device.MAC,
          IP: Array.isArray(device.IP) ? device.IP.join(", ") : device.IP,
          MAC: device.MAC,
          Vendor: device.Vendor,
          Protocol: Array.isArray(device.Protocol) ? device.Protocol.join(", ") : device.Protocol,
          Port: Array.isArray(device.Port) ? device.Port.join(", ") : device.Port,
          status: device.status,
          type: deviceType,
          cluster: deviceType,
        };

        nodeMap.set(device.MAC, deviceNode);
        nodes.push(deviceNode);

        // Add link to cluster center
        links.push({
          source: device.MAC,
          target: `${deviceType}_Cluster`,
          type: deviceType.toLowerCase(),
        });

        // Create links based on device connections
        if (Array.isArray(device[device.MAC])) {
          device[device.MAC].forEach((connectedMAC) => {
            if (connectedMAC !== "00:00:00:00:00:00") {
              links.push({
                source: device.MAC,
                target: connectedMAC,
                type: deviceType.toLowerCase(),
              });
            }
          });
        }
      });
    });

    // Add nodes for MACs that are not found in the original data
    links.forEach((link) => {
      ['source', 'target'].forEach((endpoint) => {
        if (typeof link[endpoint] === 'string' && !nodeMap.has(link[endpoint])) {
          const notFoundNode = {
            id: link[endpoint],
            MAC: link[endpoint],
            Vendor: "Unknown",
            type: "Not Found",
            cluster: "Not Found",
            status: "false",
          };
          nodeMap.set(link[endpoint], notFoundNode);
          nodes.push(notFoundNode);
        }
      });
    });

    // Add inter-cluster links
    Object.values(clusters).forEach((source, index, array) => {
      const target = array[(index + 1) % array.length];
      links.push({
        source: source.id,
        target: target.id,
        type: 'inter-cluster',
      });
    });

    // SVG setup with improved zoom handling
    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background", "#111")
      .classed("graph-svg", true);

    svg.selectAll("*").remove();

    // Enhanced zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom)
      .on("dblclick.zoom", null); // Disable double-click zoom

    const container = svg.append("g");

    // Add zoom in and zoom out buttons
    const zoomIn = svg.append("g")
      .attr("class", "zoom-button")
      .attr("transform", "translate(20, 20)")
      .on("click", () => zoom.scaleBy(svg.transition().duration(750), 1.3));

    zoomIn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("rx", 5);

    zoomIn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .text("+");

    const zoomOut = svg.append("g")
      .attr("class", "zoom-button")
      .attr("transform", "translate(20, 60)")
      .on("click", () => zoom.scaleBy(svg.transition().duration(750), 1 / 1.3));

    zoomOut.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("rx", 5);

    zoomOut.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .text("-");

    // Add cluster boundaries
    const clusterBoundaries = container.selectAll(".cluster-boundary")
      .data(Object.values(clusters))
      .join("circle")
      .attr("class", d => `cluster-boundary cluster-${d.id.toLowerCase()}`)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", d => d.radius)
      .attr("stroke", d => d.color)
      .style("stroke-dasharray", "5,5")
      .style("fill", "none");

    // Enhanced tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "graph-tooltip")
      .style("opacity", 0);

    // Improved getOverlappingLinks function
    function getOverlappingLinks(x, y) {
      const threshold = 5;
      return links.filter(linkData => {
        const linkElement = d3.select(`path.link[id="${linkData.id}"]`).node();
        if (linkElement) {
          const pathLength = linkElement.getTotalLength();
          for (let i = 0; i < pathLength; i += 5) {
            const p = linkElement.getPointAtLength(i);
            if (Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Draw links
    const link = container.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link")
      // Update the link ID attribute
      .attr("id", d => `link-${sanitizeId(d.source.id || d.source)}-${sanitizeId(d.target.id || d.target)}`)
      .attr("stroke", d => {
        if (d.type === 'it') return "#ffffff";
        if (d.type === 'network') return "#3b82f6";
        if (d.type === 'ot') return "#f97316";
        if (d.type === 'inter-cluster') return "#666";
        return "#666";
      })
      .attr("stroke-opacity", d => d.type === 'inter-cluster' ? 0.4 : 0.2)
      .attr("stroke-width", d => d.type === 'inter-cluster' ? 3 : 1.5)
      .attr("fill", "none");

    // Add invisible wider path for better hover detection
    const linkHitArea = container.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link-hit-area")
      .attr("stroke", "transparent")
      .attr("stroke-width", 10)
      .attr("fill", "none")
      .on("mouseover", (event, d) => {
        // Highlight the corresponding link
        // Update the selector in mouseover
        d3.select(`#link-${sanitizeId(d.source.id || d.source)}-${sanitizeId(d.target.id || d.target)}`)
          .attr("stroke-opacity", 0.8)
          .attr("stroke-width", d.type === 'inter-cluster' ? 4 : 2);

        // Show tooltip with connection information
        tooltip.transition()
          .duration(200)
          .style("opacity", 1);

        const sourceNode = nodeMap.get(typeof d.source === 'string' ? d.source : d.source.id);
        const targetNode = nodeMap.get(typeof d.target === 'string' ? d.target : d.target.id);

        const content = `
          <div style="margin-bottom: 8px;">
            <strong style="font-size: 16px;">Connection Details</strong>
          </div>
          <div style="margin-bottom: 4px;">
            <strong>From:</strong> ${sourceNode?.Vendor || sourceNode?.label || 'Unknown'}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>To:</strong> ${targetNode?.Vendor || targetNode?.label || 'Unknown'}
          </div>
          ${sourceNode?.Protocol ? `
          <div style="margin-bottom: 4px;">
            <strong>Protocol:</strong> ${sourceNode.Protocol}
          </div>
          ` : ''}
          ${sourceNode?.Port ? `
          <div style="margin-bottom: 4px;">
            <strong>Port:</strong> ${sourceNode.Port}
          </div>
          ` : ''}
          <div style="margin-bottom: 4px;">
            <strong>Type:</strong> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)} Connection
          </div>
        `;

        tooltip.html(content)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 15) + "px");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 15) + "px");
      })
      .on("mouseout", () => {
        // Reset link appearance
        link.attr("stroke-opacity", d => d.type === 'inter-cluster' ? 0.4 : 0.2)
          .attr("stroke-width", d => d.type === 'inter-cluster' ? 3 : 1.5);

        // Hide tooltip
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });

    // Draw nodes
    const node = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", d => `node ${d.type === 'Not Found' ? 'node-not-found' : ''}`)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add background circles for cluster centers
    node.filter(d => d.isCluster)
      .append("circle")
      .attr("class", "cluster-center")
      .attr("r", 30)
      .attr("fill", d => d.color)
      .attr("fill-opacity", 0.2)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2);

    // Add icons for nodes
    node.each(function(d) {
      const IconComponent = d.isCluster ? d.icon : (clusters[d.type]?.nodeIcon || Database);
      if (IconComponent) {
        const foreignObject = d3.select(this)
          .append("foreignObject")
          .attr("width", d.isCluster ? 40 : 24)
          .attr("height", d.isCluster ? 40 : 24)
          .attr("x", d.isCluster ? -20 : -12)
          .attr("y", d.isCluster ? -20 : -12);

        const div = foreignObject
          .append("xhtml:div")
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "flex")
          .style("align-items", "center")
          .style("justify-content", "center");

        const icon = document.createElement("div");
        icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
          <IconComponent 
            width={d.isCluster ? 24 : 16} 
            height={d.isCluster ? 24 : 16} 
            stroke={d.type === "Not Found" ? "#999" : "white"} 
            strokeWidth={1.5} 
          />
        );
        div.node().appendChild(icon.firstChild);
      }
    });

    // Add labels
    node.append("text")
      .attr("dy", d => d.isCluster ? -40 : -20)
      .attr("text-anchor", "middle")
      .text(d => d.isCluster ? d.label : (d.Vendor || d.id))
      .attr("fill", "white")
      .attr("font-size", d => d.isCluster ? "16px" : "12px");

    // Add status indicators
    node.filter(d => !d.isCluster)
      .append("circle")
      .attr("class", "status-indicator")
      .attr("r", 3)
      .attr("cy", 8)
      .attr("fill", d => d.status === "true" ? "#4CAF50" : "#F44336");

    // Node tooltip with improved visibility
    node.on("mouseover", (event, d) => {
      if (!d.isCluster) {
        tooltip.transition()
          .duration(200)
          .style("opacity", 1);
        
        const content = `
          <div style="margin-bottom: 8px;">
            <strong style="font-size: 16px;">${d.Vendor || "Unknown Device"}</strong>
          </div>
          <div style="margin-bottom: 4px;">
            <strong>MAC:</strong> ${d.MAC}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>IP:</strong> ${d.IP || "N/A"}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Type:</strong> ${d.type}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Status:</strong> 
            <span style="color: ${d.status === "true" ? "#4CAF50" : "#F44336"}">
              ${d.status === "true" ? "Active" : "Inactive"}
            </span>
          </div>
          ${d.Protocol ? `<div style="margin-bottom: 4px;"><strong>Protocol:</strong> ${d.Protocol}</div>` : ''}
          ${d.Port ? `<div><strong>Port:</strong> ${d.Port}</div>` : ''}
        `;

        tooltip.html(content)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 15) + "px");
      }
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 15) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    });

    // Mouse wheel zoom handler
    svg.on("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY;
      const scaleFactor = delta > 0 ? 0.9 : 1.1;
      
      const [mouseX, mouseY] = d3.pointer(event);
      const transform = d3.zoomTransform(svg.node());
      
      zoom.scaleBy(svg.transition().duration(200), scaleFactor);
    });

    // Double click to focus on node or reset
    node.on("dblclick", (event, d) => {
      event.stopPropagation();
      const scale = 2;
      const [x, y] = d3.pointer(event, container.node());
      
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2 - scale * x, height / 2 - scale * y)
          .scale(scale)
      );
    });

    // Double click on background to reset view
    svg.on("dblclick", () => {
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
      );
    });

    // Force simulation with stronger containment and increased node distance
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(d => d.id)
        .distance(d => {
          if (d.source.isCluster && d.target.isCluster) return 400;
          if (d.source.isCluster || d.target.isCluster) return 200; // Increased from 150
          return 120; // Increased from 80 for better node separation
        })
      )
      .force("charge", d3.forceManyBody().strength(d => d.isCluster ? -1000 : -300)) // Increased repulsion
      .force("collision", d3.forceCollide().radius(d => d.isCluster ? 80 : 40)) // Increased collision radius
      .force("x", d3.forceX(d => {
        if (d.type === "Not Found") return width * 0.9;
        const cluster = clusters[d.cluster];
        return cluster ? cluster.x : width / 2;
      }).strength(d => d.type === "Not Found" ? 1 : 0.5))
      .force("y", d3.forceY(d => {
        if (d.type === "Not Found") return height * 0.9;
        const cluster = clusters[d.cluster];
        return cluster ? cluster.y : height / 2;
      }).strength(d => d.type === "Not Found" ? 1 : 0.5));

    // Drag functions
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      if (!event.subject.isCluster) {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }


    // Update positions on simulation tick with stronger containment
    simulation.on("tick", () => {
      // Keep nodes within their cluster boundaries
      nodes.forEach(d => {
        if (!d.isCluster && d.type !== "Not Found") {
          const cluster = clusters[d.cluster];
          if (cluster) {
            const dx = d.x - cluster.x;
            const dy = d.y - cluster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxRadius = cluster.radius - 30;

            if (dist > maxRadius) {
              const angle = Math.atan2(dy, dx);
              d.x = cluster.x + maxRadius * Math.cos(angle);
              d.y = cluster.y + maxRadius * Math.sin(angle);
            }
          }
        }
      });

      // Update link positions
      link.attr("d", d => {
        const source = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
        const target = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;

        if (!source || !target) return "";

        // Use straight lines for intra-cluster connections and curved for inter-cluster
        if (source.cluster === target.cluster || (source.isCluster && target.isCluster)) {
          return `M${source.x},${source.y}L${target.x},${target.y}`;
        } else {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dr = Math.sqrt(dx * dx + dy * dy) * 2;
          return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
        }
      });

      // Update hit areas
      linkHitArea.attr("d", d => {
        const source = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
        const target = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;

        if (!source || !target) return "";

        if (source.cluster === target.cluster || (source.isCluster && target.isCluster)) {
          return `M${source.x},${source.y}L${target.x},${target.y}`;
        } else {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dr = Math.sqrt(dx * dx + dy * dy) * 2;
          return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
        }
      });

      // Update node positions
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
      d3.selectAll(".graph-tooltip").remove();
      document.head.removeChild(styleSheet);
    };
  }, [data]);

  return (
    <>
      <div className="graph-overlay" />
      <div className="graph-container">
        <svg ref={svgRef}></svg>
      </div>
    </>
  );
};

export default GraphComponent;

