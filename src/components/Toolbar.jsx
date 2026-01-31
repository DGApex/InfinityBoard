import { Save, Image, MousePointer2, Type, StickyNote, Square, Circle, Pencil, Minus, ArrowRight, GripVertical, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import PanelCreator from './PanelCreator';

const Toolbar = () => {
    const { saveBoard, activeTool, setTool, drawingConfig, setDrawingConfig, setScreenshotMode, panelCreatorOpen, setPanelCreatorOpen } = useStore();
    const [position, setPosition] = useState({ x: 24, y: window.innerHeight / 2 - 200 }); // 24px = left-6
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0 });

    const isDrawingTool = ['pen', 'line', 'arrow'].includes(activeTool);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX - position.x,
            startY: e.clientY - position.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragRef.current.startX,
            y: e.clientY - dragRef.current.startY
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Add global listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
                className="fixed z-50 flex flex-col gap-4 p-3 bg-tech-panel/80 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-lg hover:shadow-neon-orange transition-shadow duration-300 select-none"
            >
                {/* Drag Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className="flex items-center justify-center py-1 cursor-move hover:bg-zinc-700/30 rounded transition-colors -mx-1"
                    title="Drag to move toolbar"
                >
                    <GripVertical size={16} className="text-zinc-600" />
                </div>
                <div className="flex flex-col gap-2 border-b border-zinc-700/50 pb-2 mb-2">
                    <ToolButton
                        onClick={() => setTool('pointer')}
                        title="Select / Move (V)"
                        icon={<MousePointer2 size={20} />}
                        isActive={activeTool === 'pointer'}
                    />
                    <ToolButton
                        onClick={() => setTool('text')}
                        title="Text Tool (T)"
                        icon={<Type size={20} />}
                        isActive={activeTool === 'text'}
                    />
                    <ToolButton
                        onClick={() => setTool('sticky')}
                        title="Sticky Note (S)"
                        icon={<StickyNote size={20} />}
                        isActive={activeTool === 'sticky'}
                    />
                    <ToolButton
                        onClick={() => setTool('rect')}
                        title="Rectangle (R)"
                        icon={<Square size={20} />}
                        isActive={activeTool === 'rect'}
                    />
                    <ToolButton
                        onClick={() => setTool('circle')}
                        title="Circle (C)"
                        icon={<Circle size={20} />}
                        isActive={activeTool === 'circle'}
                    />
                </div>

                {/* Drawing Tools Section */}
                <div className="flex flex-col gap-2 border-b border-zinc-700/50 pb-2 mb-2">
                    <ToolButton
                        onClick={() => setTool('pen')}
                        title="Pen / Brush (P)"
                        icon={<Pencil size={20} />}
                        isActive={activeTool === 'pen'}
                    />
                    <ToolButton
                        onClick={() => setTool('line')}
                        title="Line (L)"
                        icon={<Minus size={20} />}
                        isActive={activeTool === 'line'}
                    />
                    <ToolButton
                        onClick={() => setTool('arrow')}
                        title="Arrow (A)"
                        icon={<ArrowRight size={20} />}
                        isActive={activeTool === 'arrow'}
                    />
                </div>

                {/* Drawing Configuration - show when a drawing tool is active */}
                <AnimatePresence>
                    {isDrawingTool && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-2 border-b border-zinc-700/50 pb-2 mb-2 overflow-hidden"
                        >
                            <div className="flex items-center gap-2">
                                <label
                                    htmlFor="stroke-color"
                                    className="text-xs text-zinc-400 w-full text-center font-medium"
                                    title="Stroke Color"
                                >
                                    Color
                                </label>
                            </div>
                            <motion.input
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                id="stroke-color"
                                type="color"
                                value={drawingConfig.stroke}
                                onChange={(e) => setDrawingConfig({ stroke: e.target.value })}
                                className="w-full h-8 rounded-md cursor-pointer bg-zinc-800/50 border border-zinc-700 hover:border-tech-orange transition-colors"
                                title="Stroke Color"
                            />

                            <div className="flex items-center gap-2 mt-2">
                                <label
                                    htmlFor="stroke-width"
                                    className="text-xs text-zinc-400 w-full text-center font-medium"
                                    title="Stroke Width"
                                >
                                    Width
                                </label>
                            </div>
                            <select
                                id="stroke-width"
                                value={drawingConfig.strokeWidth}
                                onChange={(e) => setDrawingConfig({ strokeWidth: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm cursor-pointer hover:bg-zinc-700/50 hover:border-tech-orange transition-all duration-200"
                                title="Stroke Width"
                            >
                                <option value="1">1px</option>
                                <option value="2">2px</option>
                                <option value="3">3px</option>
                                <option value="5">5px</option>
                                <option value="8">8px</option>
                                <option value="12">12px</option>
                            </select>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-2">
                    <ToolButton onClick={saveBoard} title="Save Board" icon={<Save size={20} />} />

                    {/* New Panel Creator Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPanelCreatorOpen(!panelCreatorOpen)}
                        title="Panel Creator (AI) (G)"
                        className={`
                            p-2.5 rounded-lg transition-all duration-200 
                            ${panelCreatorOpen
                                ? 'bg-[#FF6B00] text-black shadow-[0_0_15px_rgba(255,107,0,0.5)]'
                                : 'bg-[#FF6B00]/80 text-black hover:bg-[#FF6B00] hover:shadow-[0_0_15px_rgba(255,107,0,0.3)]'
                            }
                        `}
                    >
                        <Sparkles size={20} strokeWidth={2.5} />
                    </motion.button>

                    <ToolButton onClick={() => setScreenshotMode(true)} title="Export Area" icon={<Image size={20} />} />
                </div>
            </motion.div>

            {/* Panel Creator Modal */}
            <PanelCreator isOpen={panelCreatorOpen} onClose={() => setPanelCreatorOpen(false)} />
        </>
    );
};

const ToolButton = ({ onClick, title, icon, isActive }) => (
    <motion.button
        whileHover={{
            scale: 1.05,
            backgroundColor: isActive ? "rgba(255, 107, 0, 0.2)" : "rgba(39, 39, 42, 0.8)",
        }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        title={title}
        className={`
            p-2.5 rounded-lg transition-all duration-200 
            ${isActive
                ? 'bg-tech-orange/10 text-tech-orange shadow-[0_0_15px_rgba(255,107,0,0.3)] border border-tech-orange/30'
                : 'text-zinc-400 bg-transparent hover:text-tech-orange'
            }
        `}
    >
        {icon}
    </motion.button>
);

export default Toolbar;
