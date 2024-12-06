"use client";

import React, { useState } from 'react';
import GraphComponent from '../components/GraphComponent';
//import { BackgroundLines } from "@/components/ui/background-lines";
import {BackgroundLines} from "../components/ui/background-lines"
import { FileUpload } from "../components/ui/file-upload";
const Page = () => {
  const [networkData, setNetworkData] = useState(null);
    
      console.log('Network Data:', networkData); // Log to ensure the state is updated
    
      return (
        <div style={{ padding: '20px' }}>
          <BackgroundLines className="flex items-center justify-center w-full flex-col px-4" svgOptions={undefined}>
            <h2 className="bg-clip-text text-transparent text-center bg-gradient-to-b from-neutral-900 to-neutral-700 dark:from-neutral-600 dark:to-white text-2xl md:text-4xl lg:text-7xl font-sans py-2 md:py-10 relative z-20 font-bold tracking-tight">
              Network Graph Uploader
            </h2>
            <FileUpload onChange={setNetworkData} /> {/* Set networkData with uploaded file */}
            
            <div className="pt-10">
              {networkData ? (
                <GraphComponent data={networkData} /> 
              ) : (
                <p className="max-w-xl mx-auto text-sm md:text-lg text-neutral-700 dark:text-neutral-400 text-center">
                  Please upload a valid JSON file to display the graph.
                </p>
              )}
            </div>
          </BackgroundLines>
        </div>
      );
    };
    
    export default Page;
    