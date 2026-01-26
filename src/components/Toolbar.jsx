import { Save, FolderOpen, Image, MousePointer2, Type, StickyNote, Square, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore';

const Toolbar = () => {
    const { saveBoard, loadBoard, exportBoard, activeTool, setTool } = useStore();

    return (
        <div
            className="fixed top-6 left-6 z-50 flex flex-col gap-4 p-3 bg-tech-panel/90 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-neon-orange"
        >
            <div className="flex flex-col gap-2 border-b border-zinc-700 pb-2 mb-2">
                <ToolButton
                    onClick={() => setTool('pointer')}
                    title="Select / Move"
                    icon={<MousePointer2 size={20} />}
                    isActive={activeTool === 'pointer'}
                />
                <ToolButton
                    onClick={() => setTool('text')}
                    title="Text Tool"
                    icon={<Type size={20} />}
                    isActive={activeTool === 'text'}
                />
                <ToolButton
                    onClick={() => setTool('sticky')}
                    title="Sticky Note"
                    icon={<StickyNote size={20} />}
                    isActive={activeTool === 'sticky'}
                />
                <ToolButton
                    onClick={() => setTool('rect')}
                    title="Rectangle"
                    icon={<Square size={20} />}
                    isActive={activeTool === 'rect'}
                />
                <ToolButton
                    onClick={() => setTool('circle')}
                    title="Circle"
                    icon={<Circle size={20} />}
                    isActive={activeTool === 'circle'}
                />
            </div>

            <div className="flex flex-col gap-2">
                <ToolButton onClick={saveBoard} title="Save Board" icon={<Save size={20} />} />
                <ToolButton onClick={loadBoard} title="Load Board" icon={<FolderOpen size={20} />} />
                <ToolButton onClick={exportBoard} title="Export as Image" icon={<Image size={20} />} />
            </div>
        </div>
    );
};

const ToolButton = ({ onClick, title, icon, isActive }) => (
    <motion.button
        whileHover={{ scale: 1.05, backgroundColor: "rgba(39, 39, 42, 1)", color: "#FF6B00" }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        title={title}
        className={`p-2 rounded-md transition-colors duration-200 group relative ${isActive ? 'bg-zinc-800 text-[#FF6B00]' : 'text-zinc-400 bg-transparent'}`}
    >
        {icon}
    </motion.button>
);

export default Toolbar;
