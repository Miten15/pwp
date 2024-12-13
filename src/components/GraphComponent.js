"use client"

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Network, Server, Router, Monitor, Cpu, Laptop, Database, X } from 'lucide-react';
import ReactDOMServer from "react-dom/server";
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";

const sanitizeId = (str) => {
  if (typeof str !== 'string') {
    console.warn(`sanitizeId received non-string value: ${str}`);
    return String(str);
  }
  return str.replace(/[^a-zA-Z0-9]/g, '_');
};

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
  .search-container {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 60;
    display: flex;
    flex-direction: column;
  }
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-input {
    padding: 8px 32px 8px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    width: 200px;
    margin-bottom: 5px;
  }
  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .search-clear:hover {
    color: white;
  }
  .search-dropdown {
    background-color: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    max-height: 150px;
    overflow-y: auto;
  }
  .search-dropdown-item {
    padding: 8px;
    color: white;
    cursor: pointer;
  }
  .search-dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  .node.highlighted {
    stroke: #ffff00;
    stroke-width: 3px;
  }
  .node.connected {
    stroke: #ffff00;
    stroke-width: 2px;
  }
  .node.faded {
    opacity: 0.2;
    pointer-events: none;
  }
  .link.faded {
    opacity: 0.1;
    pointer-events: none;
  }
  .link.highlighted {
    stroke: #ffff00 !important;
    stroke-opacity: 0.8 !important;
    stroke-width: 2px !important;
  }
  .link.connected {
    stroke: #ffff00 !important;
    stroke-opacity: 0.4 !important;
    stroke-width: 1.5px !important;
  }
`;

const GraphComponent = ({ data }) => {
  const svgRef = useRef();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const nodes = useMemo(() => {
    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format');
      return [];
    }

    const nodesArray = [];
    const clusters = {
      IT: {
        id: "IT_Cluster",
        label: "IT",
        color: "#ffffff",
        x: 400,
        y: 300,
        radius: 250,
        icon: Laptop,
        nodeIcon: Laptop
      },
      Network: {
        id: "Network_Cluster",
        label: "Network",
        color: "#3b82f6",
        x: 1200,
        y: 300,
        radius: 250,
        icon: Router,
        nodeIcon: Router
      },
      OT: {
        id: "OT_Cluster",
        label: "OT",
        color: "#f97316",
        x: 800,
        y: 900,
        radius: 250,
        icon: Cpu,
        nodeIcon: Cpu
      },
    };

    // Add cluster center nodes
    Object.values(clusters).forEach((cluster) => {
      nodesArray.push({
        ...cluster,
        fx: cluster.x,
        fy: cluster.y,
        isCluster: true,
      });
    });

    // Process device nodes
    data[0].mac_data.forEach((category) => {
      const deviceType = Object.keys(category)[0].split(" ")[0];
      const devices = category[Object.keys(category)[0]];

      devices.forEach((device) => {
        nodesArray.push({
          id: device.MAC,
          IP: Array.isArray(device.IP) ? device.IP.join(", ") : device.IP,
          MAC: device.MAC,
          Vendor: device.Vendor,
          Protocol: Array.isArray(device.Protocol) ? device.Protocol.join(", ") : device.Protocol,
          Port: Array.isArray(device.Port) ? device.Port.join(", ") : device.Port,
          status: device.status,
          type: deviceType,
          cluster: deviceType,
        });
      });
    });

    return nodesArray;
  }, [data]);

  const links = useMemo(() => {
    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      return [];
    }

    const linksArray = [];
    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    // Add links to cluster centers and between devices
    data[0].mac_data.forEach((category) => {
      const deviceType = Object.keys(category)[0].split(" ")[0];
      const devices = category[Object.keys(category)[0]];

      devices.forEach((device) => {
        linksArray.push({
          source: device.MAC,
          target: `${deviceType}_Cluster`,
          type: deviceType.toLowerCase(),
        });

        if (Array.isArray(device[device.MAC])) {
          device[device.MAC].forEach((connectedMAC) => {
            if (connectedMAC !== "00:00:00:00:00:00") {
              linksArray.push({
                source: device.MAC,
                target: connectedMAC,
                type: deviceType.toLowerCase(),
              });
            }
          });
        }
      });
    });

    // Add inter-cluster links
    const clusters = ["IT_Cluster", "Network_Cluster", "OT_Cluster"];
    clusters.forEach((source, index) => {
      const target = clusters[(index + 1) % clusters.length];
      linksArray.push({
        source,
        target,
        type: 'inter-cluster',
      });
    });

    return linksArray;
  }, [data, nodes]);

  const validateLinks = (links, nodes) => {
    const nodeIds = new Set(nodes.map(n => n.id));
    return links.filter(link => 
      nodeIds.has(typeof link.source === 'object' ? link.source.id : link.source) &&
      nodeIds.has(typeof link.target === 'object' ? link.target.id : link.target)
    );
  };

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background", "#111")
      .classed("graph-svg", true);

    svg.selectAll("*").remove();

    const width = 1600;
    const height = 1200;

    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom)
      .on("dblclick.zoom", null);

    const container = svg.append("g");

    // Add cluster boundaries
    const clusterBoundaries = container.selectAll(".cluster-boundary")
      .data(nodes.filter(d => d.isCluster))
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

    const validLinks = validateLinks(links, nodes);
    const invalidLinks = links.filter(link => !validLinks.includes(link));
    if (invalidLinks.length > 0) {
      console.warn('Invalid links found:', invalidLinks);
    }

    // Draw links
    const link = container.append("g")
      .selectAll("path")
      .data(validLinks)
      .join("path")
      .attr("class", "link")
      .attr("id", d => `link-${sanitizeId(d.source)}-${sanitizeId(d.target)}`)
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
      const IconComponent = d.isCluster ? d.icon : (d.nodeIcon || Database);
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

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(validLinks).id(d => d.id).distance(d => {
        if (d.source.isCluster && d.target.isCluster) return 400;
        if (d.source.isCluster || d.target.isCluster) return 200;
        return 120;
      }))
      .force("charge", d3.forceManyBody().strength(d => d.isCluster ? -1000 : -300))
      .force("collision", d3.forceCollide().radius(d => d.isCluster ? 80 : 40))
      .force("x", d3.forceX(d => {
        if (d.type === "Not Found") return width * 0.95; // Position Not Found nodes far right
        return d.fx || width / 2;
      }).strength(d => d.type === "Not Found" ? 1 : 0.5))
      .force("y", d3.forceY(d => {
        if (d.type === "Not Found") return height * 0.95; // Position Not Found nodes at bottom
        return d.fy || height / 2;
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

    // Update positions on simulation tick
    simulation.on("tick", () => {
      // Keep nodes within their cluster boundaries
      nodes.forEach(d => {
        if (!d.isCluster && d.type !== "Not Found") {
          const cluster = nodes.find(n => n.id === `${d.cluster}_Cluster`);
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

    // Search functionality
    const updateSearch = () => {
      if (!selectedNode) {
        node.classed("highlighted", false).classed("connected", false).classed("faded", false);
        link.classed("highlighted", false).classed("connected", false).classed("faded", false);
        return;
      }

      const connectedNodeIds = new Set();
      links.forEach(l => {
        if (l.source.id === selectedNode.id || l.target.id === selectedNode.id) {
          connectedNodeIds.add(l.source.id);
          connectedNodeIds.add(l.target.id);
        }
      });

      node.classed("highlighted", d => d.id === selectedNode.id)
          .classed("connected", d => d.id !== selectedNode.id && connectedNodeIds.has(d.id))
          .classed("faded", d => d.id !== selectedNode.id && !connectedNodeIds.has(d.id));

      link.classed("highlighted", d => 
        d.source.id === selectedNode.id || d.target.id === selectedNode.id
      )
      .classed("connected", d => 
        (connectedNodeIds.has(d.source.id) && connectedNodeIds.has(d.target.id)) &&
        (d.source.id !== selectedNode.id && d.target.id !== selectedNode.id)
      )
      .classed("faded", d => 
        !(d.source.id === selectedNode.id || d.target.id === selectedNode.id) &&
        !(connectedNodeIds.has(d.source.id) && connectedNodeIds.has(d.target.id))
      );

      // Zoom to fit highlighted and connected nodes
      const relevantNodes = nodes.filter(d => d.id === selectedNode.id || connectedNodeIds.has(d.id));
      const bounds = getBoundingBox(relevantNodes);
      zoomToFit(bounds, width, height);
    };

    const getBoundingBox = (nodes) => {
      const box = {
        x1: Infinity,
        y1: Infinity,
        x2: -Infinity,
        y2: -Infinity
      };

      nodes.forEach(d => {
        box.x1 = Math.min(box.x1, d.x);
        box.y1 = Math.min(box.y1, d.y);
        box.x2 = Math.max(box.x2, d.x);
        box.y2 = Math.max(box.y2, d.y);
      });

      return box;
    };

    const zoomToFit = (box, width, height) => {
      const dx = box.x2 - box.x1;
      const dy = box.y2 - box.y1;
      const x = (box.x1 + box.x2) / 2;
      const y = (box.y1 + box.y2) / 2;
      const scale = 0.8 / Math.max(dx / width, dy / height);
      const translate = [width / 2 - scale * x, height / 2 - scale * y];

      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    };

    updateSearch();

    // Cleanup
    return () => {
      simulation.stop();
      d3.selectAll(".graph-tooltip").remove();
      document.head.removeChild(styleSheet);
    };
  }, [nodes, links, selectedNode]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSuggestions([]);
      setSelectedNode(null);
      return;
    }

    const searchRegex = new RegExp(searchTerm, 'i');
    const matchingNodes = nodes.filter(d => 
      !d.isCluster && (searchRegex.test(d.Vendor) || searchRegex.test(d.MAC) || searchRegex.test(d.IP))
    );

    const newSuggestions = matchingNodes.map(node => ({
      id: node.id,
      label: `${node.Vendor} - ${node.type} (${node.MAC})`
    }));

    setSuggestions(newSuggestions);
  }, [searchTerm, nodes]);

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.label);
    setSelectedNode(nodes.find(node => node.id === suggestion.id));
    setSuggestions([]);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSelectedNode(null);
    setSuggestions([]);
  };

  return (
    <>
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search nodes..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              className="search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="search-dropdown">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="search-dropdown-item"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion.label}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="graph-overlay" />
      <div className="graph-container">
        <svg ref={svgRef}></svg>
      </div>
    </>
  );
};

export default GraphComponent;

