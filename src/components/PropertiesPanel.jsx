import React from 'react';
import useStore from '../store/useStore';
import { Square, Palette } from 'lucide-react';

const COLORS = [
    { name: 'Yellow', value: '#ffd700' },
    { name: 'Orange', value: '#ff9f43' },
    { name: 'Blue', value: '#54a0ff' },
    { name: 'Green', value: '#1dd1a1' },
    { name: 'Pink', value: '#ff9ff3' },
    { name: 'White', value: '#ffffff' },
];

const PropertiesPanel = () => {
    const { items, updateItem, selectedIds } = useStore();

    // For multi-select, show properties of first selected item
    const selectedId = selectedIds[0] || null;
    const selectedItem = items.find(item => item.id === selectedId);

    if (!selectedItem) return null;

    const handleColorChange = (color) => {
        updateItem(selectedId, { color });
    };

    const handleFontSizeChange = (e) => {
        updateItem(selectedId, { fontSize: parseInt(e.target.value) });
    };

    const handleTextColorChange = (e) => {
        updateItem(selectedId, { fill: e.target.value });
    };

    return (
        <div className="fixed top-24 right-6 z-50 w-64 p-4 bg-tech-panel/90 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-neon-orange flex flex-col gap-4 animate-in slide-in-from-right-10 fade-in duration-300">
            <h3 className="text-sm font-semibold text-tech-orange uppercase tracking-wider border-b border-zinc-700 pb-2 mb-1 flex items-center gap-2">
                <Palette size={16} /> Properties
            </h3>

            {selectedItem.type === 'sticky' && (
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-zinc-400">Note Color</label>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map((c) => (
                            <button
                                key={c.name}
                                onClick={() => handleColorChange(c.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedItem.color === c.value ? 'border-tech-orange' : 'border-transparent'}`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>
            )}

            {selectedItem.type === 'text' && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-zinc-400">
                            Font Size: {selectedItem.fontSize}px
                        </label>
                        <input
                            type="range"
                            min="12"
                            max="72"
                            value={selectedItem.fontSize || 20}
                            onChange={handleFontSizeChange}
                            className="w-full accent-tech-orange h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-zinc-400">Text Color</label>
                        <input
                            type="color"
                            value={selectedItem.fill || '#ffffff'}
                            onChange={handleTextColorChange}
                            className="w-full h-8 cursor-pointer rounded bg-transparent border border-zinc-700"
                        />
                    </div>
                </div>
            )}

            {(selectedItem.type === 'rect' || selectedItem.type === 'circle') && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-zinc-400">Fill Color</label>
                        <input
                            type="color"
                            value={selectedItem.fill || '#ffffff'}
                            onChange={(e) => updateItem(selectedId, { fill: e.target.value })}
                            className="w-full h-8 cursor-pointer rounded bg-transparent border border-zinc-700"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-zinc-400">Stroke Color</label>
                        <input
                            type="color"
                            value={selectedItem.stroke || '#000000'}
                            onChange={(e) => updateItem(selectedId, { stroke: e.target.value })}
                            className="w-full h-8 cursor-pointer rounded bg-transparent border border-zinc-700"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-zinc-400">Stroke Width</label>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            value={selectedItem.strokeWidth || 0}
                            onChange={(e) => updateItem(selectedId, { strokeWidth: parseInt(e.target.value) })}
                            className="w-full accent-tech-orange h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}
            {/* Fallback for other items or generic properties */}
            <div className="text-xs text-zinc-500 font-mono mt-2">
                ID: {selectedItem.id.slice(0, 8)}...<br />
                Type: {selectedItem.type}
            </div>
        </div>
    );
};

export default PropertiesPanel;
