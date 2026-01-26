import React from 'react';
import InfiniteCanvas from './components/InfiniteCanvas';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import StatusBar from './components/StatusBar';

function App() {
    return (
        <div className="relative w-full h-screen bg-tech-bg overflow-hidden text-tech-text-primary font-sans selection:bg-tech-orange selection:text-black">
            <Toolbar />
            <PropertiesPanel />
            <InfiniteCanvas />
            <StatusBar />
        </div>
    );
}

export default App;
