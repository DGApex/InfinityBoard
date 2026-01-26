import React from 'react';
import useStore from '../store/useStore';
import { ZoomIn, Undo2, Redo2 } from 'lucide-react';

const StatusBar = () => {
    const { scale, items, historyIndex, history, undo, redo } = useStore();

    const zoomPercentage = Math.round(scale * 100);
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-6 py-2 bg-tech-panel/80 backdrop-blur-md border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            {/* Left: Object count */}
            <div className="flex items-center gap-4">
                <span className="font-mono">{items.length} objects</span>
            </div>

            {/* Center: Zoom control */}
            <div className="flex items-center gap-2">
                <ZoomIn size={14} className="text-zinc-500" />
                <span className="font-mono text-tech-orange">{zoomPercentage}%</span>
            </div>

            {/* Right: Undo/Redo state */}
            <div className="flex items-center gap-3">
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${canUndo
                            ? 'hover:bg-zinc-800 hover:text-tech-orange cursor-pointer'
                            : 'opacity-30 cursor-not-allowed'
                        }`}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={12} />
                    <span className="font-mono text-[10px]">Ctrl+Z</span>
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${canRedo
                            ? 'hover:bg-zinc-800 hover:text-tech-orange cursor-pointer'
                            : 'opacity-30 cursor-not-allowed'
                        }`}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo2 size={12} />
                    <span className="font-mono text-[10px]">Ctrl+Shift+Z</span>
                </button>
            </div>
        </div>
    );
};

export default StatusBar;
