import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Network, Server, Router, Monitor, Cpu, Laptop, Database } from 'lucide-react';
import ReactDOMServer from "react-dom/server";
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";

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

    // SVG setup
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#111");

    svg.selectAll("*").remove();

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);
    const container = svg.append("g");

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

    // Create tooltips
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Draw links
    const link = container.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link")
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
        // Highlight the corresponding visible link
        link.filter(l => l === d)
          .attr("stroke-opacity", 0.8)
          .attr("stroke-width", d.type === 'inter-cluster' ? 4 : 2);

        // Show tooltip
        const sourceNode = nodeMap.get(d.source.id || d.source);
        const targetNode = nodeMap.get(d.target.id || d.target);
        
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        
        tooltip.html(`
          <div style="padding: 8px;">
            <strong>Connection:</strong><br/>
            From: ${sourceNode?.Vendor || sourceNode?.label || sourceNode?.id || 'Unknown'}<br/>
            To: ${targetNode?.Vendor || targetNode?.label || targetNode?.id || 'Unknown'}<br/>
            ${sourceNode?.Protocol ? `Protocol: ${sourceNode.Protocol}` : ''}
          </div>
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", (event, d) => {
        // Reset link appearance
        link.filter(l => l === d)
          .attr("stroke-opacity", d.type === 'inter-cluster' ? 0.4 : 0.2)
          .attr("stroke-width", d.type === 'inter-cluster' ? 3 : 1.5);

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

    // Node tooltip
    node.on("mouseover", (event, d) => {
      if (!d.isCluster) {
        tooltip.transition()
          .duration(200)
          .style("opacity", .9);
        tooltip.html(`
          <strong>${d.Vendor || "Unknown Device"}</strong><br/>
          MAC: ${d.MAC}<br/>
          IP: ${d.IP || "N/A"}<br/>
          Type: ${d.type}<br/>
          Status: ${d.status === "true" ? "Active" : "Inactive"}<br/>
          ${d.Protocol ? `Protocol: ${d.Protocol}<br/>` : ''}
          ${d.Port ? `Port: ${d.Port}` : ''}
        `)
          .style("left", (event.pageX) + "px")
          .style("top", (event.pageY - 28) + "px");
      }
    })
      .on("mouseout", () => {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });

    // Force simulation with stronger containment and increased node distance
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(d => d.id)
        .distance(d => {
          if (d.source.isCluster && d.target.isCluster) return 400; // Increased distance for inter-cluster links
          if (d.source.isCluster || d.target.isCluster) return 150;
          if (d.source.type === "Not Found" || d.target.type === "Not Found") return 200;
          return 80; // Increased distance between regular nodes
        })
      )
      .force("charge", d3.forceManyBody().strength(d => d.isCluster ? -1000 : -200))
      .force("collision", d3.forceCollide().radius(d => d.isCluster ? 80 : 30))
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
    <div style={{ width: "100%", height: "100%" }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphComponent;

