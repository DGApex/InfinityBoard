import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { Stage, Layer, Rect, Circle, Group, Text, Image as KonvaImage, Transformer, RegularPolygon, Line, Arrow } from 'react-konva';
import Konva from 'konva';
import useStore from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { readTextFile } from '@tauri-apps/api/fs';
import { open } from '@tauri-apps/api/shell';


// ... (calculateSnapPoint remains the same)




// Helper function to calculate snap point for line/arrow endpoints
const calculateSnapPoint = (point, items, threshold = 20) => {
    let snappedPoint = { ...point };
    let minDistance = threshold;

    items.forEach(item => {
        if (item.type === 'drawing') return; // Skip other drawings

        const snapPoints = [];

        if (item.type === 'rect' || item.type === 'sticky' || item.type === 'text') {
            const w = item.width || 100;
            const h = item.height || 100;
            snapPoints.push(
                { x: item.x + w / 2, y: item.y + h / 2 }, // center
                { x: item.x, y: item.y }, // top-left
                { x: item.x + w, y: item.y }, // top-right
                { x: item.x, y: item.y + h }, // bottom-left
                { x: item.x + w, y: item.y + h }, // bottom-right
                { x: item.x + w / 2, y: item.y }, // top-center
                { x: item.x + w / 2, y: item.y + h }, // bottom-center
                { x: item.x, y: item.y + h / 2 }, // left-center
                { x: item.x + w, y: item.y + h / 2 }, // right-center
            );
        } else if (item.type === 'circle') {
            const r = item.radius || 50;
            snapPoints.push(
                { x: item.x, y: item.y }, // center
                { x: item.x + r, y: item.y }, // right
                { x: item.x - r, y: item.y }, // left
                { x: item.x, y: item.y + r }, // bottom
                { x: item.x, y: item.y - r }, // top
            );
        } else if (item.type === 'image') {
            const w = item.width || 100;
            const h = item.height || 100;
            snapPoints.push(
                { x: item.x + w / 2, y: item.y + h / 2 }, // center
                { x: item.x, y: item.y }, // top-left
                { x: item.x + w, y: item.y }, // top-right
                { x: item.x, y: item.y + h }, // bottom-left
                { x: item.x + w, y: item.y + h }, // bottom-right
                { x: item.x + w / 2, y: item.y }, // top-center
                { x: item.x + w / 2, y: item.y + h }, // bottom-center
                { x: item.x, y: item.y + h / 2 }, // left-center
                { x: item.x + w, y: item.y + h / 2 }, // right-center
            );
        }

        snapPoints.forEach(sp => {
            const distance = Math.sqrt(
                Math.pow(sp.x - point.x, 2) + Math.pow(sp.y - point.y, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                snappedPoint = sp;
            }
        });
    });

    return { point: snappedPoint, isSnapped: minDistance < threshold };
};

// Helper to detect URL
const isValidUrl = (string) => {
    try {
        // Simple check for http/https prefix or just www
        const pattern = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
        return pattern.test(string);
    } catch (_) {
        return false;
    }
};

const InfiniteCanvas = () => {
    const stageRef = useRef(null);
    const contentLayerRef = useRef(null);
    const transformerRef = useRef(null);
    const {
        scale, position, setScale, setPosition,
        stageSize, setStageSize, setContentLayerRef,
        items, addItem, updateItem, removeItem, activeTool, setTool,
        selectedIds, selectItem, undo, redo,
        createGroup, ungroupItems, reorderItem,
        drawingConfig, gridConfig, backgroundConfig,
        setPanelCreatorOpen, setPanelCreatorReferenceImage
    } = useStore();

    const [images, setImages] = useState({});
    const [editingItem, setEditingItem] = useState(null);
    const [textAreaPosition, setTextAreaPosition] = useState({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState(null); // { x1, y1, x2, y2 }
    const [isPanning, setIsPanning] = useState(false);
    const [creatingShape, setCreatingShape] = useState(null); // { type, x1, y1, x2, y2 }
    const [contextMenu, setContextMenu] = useState(null); // { x, y }
    const [activeDrawing, setActiveDrawing] = useState(null); // { type: 'pen' | 'line' | 'arrow', points: [] }

    // Use ref for spacebar to avoid re-renders
    const isSpacePressedRef = useRef(false);
    const containerRef = useRef(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 }); // Track for Tauri drops
    const recentlyProcessedRef = useRef(new Set()); // Track files to prevent duplicates

    // Listen for Tauri file drops
    useEffect(() => {
        let unlistenFunction = null;

        const setupTauriListener = async () => {
            try {
                unlistenFunction = await listen('tauri://file-drop', async (event) => {
                    const files = event.payload;
                    if (!files || files.length === 0) return;

                    const stage = stageRef.current;
                    if (!stage) return;

                    // Get viewport center instead of mouse position
                    const container = containerRef.current;
                    if (!container) return;

                    const rect = container.getBoundingClientRect();
                    const viewportCenterX = rect.width / 2;
                    const viewportCenterY = rect.height / 2;

                    const stagePos = stage.position();
                    const stageScale = stage.scaleX();

                    // Convert viewport center to canvas coordinates
                    const point = {
                        x: (viewportCenterX - stagePos.x) / stageScale,
                        y: (viewportCenterY - stagePos.y) / stageScale,
                    };



                    for (const filePath of files) {
                        // Skip if we just processed this file (Tauri fires event twice)
                        if (recentlyProcessedRef.current.has(filePath)) {
                            continue;
                        }

                        // Mark as processed and clear after 1 second
                        recentlyProcessedRef.current.add(filePath);
                        setTimeout(() => {
                            recentlyProcessedRef.current.delete(filePath);
                        }, 1000);

                        const lowerPath = filePath.toLowerCase();

                        // Handle JSON Boards
                        if (lowerPath.endsWith('.json')) {
                            try {
                                const content = await readTextFile(filePath);
                                const data = JSON.parse(content);

                                // Load scale and position
                                if (data.scale) setScale(data.scale);
                                if (data.position) setPosition(data.position);

                                // Load items
                                if (data.items) {
                                    items.forEach(item => removeItem(item.id));
                                    data.items.forEach(item => addItem(item));
                                }

                                // Load grid and background config with fallbacks
                                const { setGridConfig, setBackgroundConfig } = useStore.getState();
                                if (data.gridConfig) {
                                    setGridConfig(data.gridConfig);
                                }
                                if (data.backgroundConfig) {
                                    setBackgroundConfig(data.backgroundConfig);
                                }

                            } catch (err) {
                                console.error('Failed to load board:', err);
                                alert('Failed to load board: ' + err.message);
                            }
                            continue;
                        }

                        // Handle Images (except GIFs which are handled separately)
                        if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].some(ext => lowerPath.endsWith(ext))) {
                            const assetUrl = convertFileSrc(filePath);
                            const img = new window.Image();
                            img.src = assetUrl;
                            img.onload = () => {
                                addItem({
                                    id: uuidv4(),
                                    type: 'image',
                                    x: point.x,
                                    y: point.y,
                                    content: assetUrl,
                                    width: img.width > 500 ? 500 : img.width,
                                    height: (img.width > 500 ? 500 : img.width) * (img.height / img.width),
                                });
                            };
                            continue;
                        }
                    }
                });
            } catch (err) {
                console.warn('Tauri event listener failed:', err);
            }
        };

        setupTauriListener();

        return () => {
            if (unlistenFunction) {
                unlistenFunction();
            }
        };
    }, []); // Empty deps to run only once

    useEffect(() => {
        if (contentLayerRef.current) {
            setContentLayerRef(contentLayerRef.current);
        }
    }, [setContentLayerRef]);

    // Transformer Logic
    useEffect(() => {
        if (!transformerRef.current) return;

        try {
            if (selectedIds.length > 0) {
                const stage = transformerRef.current.getStage();
                if (!stage) return; // Safety check

                // Only apply transformer to non-drawing items
                const selectedNodes = selectedIds
                    .map(id => {
                        const item = items.find(i => i.id === id);
                        // Skip drawing items (they'll have custom handles)
                        if (item && item.type === 'drawing') return null;
                        return stage.findOne('#' + id);
                    })
                    .filter(node => node !== null && node !== undefined);

                if (selectedNodes.length > 0) {
                    transformerRef.current.nodes(selectedNodes);
                    const layer = transformerRef.current.getLayer();
                    if (layer) layer.batchDraw();
                } else {
                    transformerRef.current.nodes([]);
                }
            } else {
                transformerRef.current.nodes([]);
            }
        } catch (error) {
            console.warn('Transformer update skipped:', error);
        }
    }, [selectedIds, items]);

    // Keyboard shortcuts (Delete, Undo, Redo)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip if user is typing in input/textarea
            const isTyping = document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA';

            // Undo: Ctrl+Z (not Shift)
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Ctrl+Shift+Z
            if (e.ctrlKey && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                redo();
                return;
            }

            // Group: Ctrl+G
            if (e.ctrlKey && e.key === 'g' && !e.shiftKey && !isTyping) {
                e.preventDefault();
                // Assuming createGroup is directly available from useStore
                createGroup();
                return;
            }

            // Ungroup: Ctrl+Shift+G
            if (e.ctrlKey && e.key === 'g' && e.shiftKey && !isTyping) {
                e.preventDefault();
                // Assuming ungroupItems is directly available from useStore
                ungroupItems();
                return;
            }

            // Zoom In: Ctrl + Plus
            if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setScale(Math.min(5, scale * 1.1));
                return;
            }

            // Zoom Out: Ctrl + Minus
            if (e.ctrlKey && e.key === '-') {
                e.preventDefault();
                setScale(Math.max(0.1, scale / 1.1));
                return;
            }

            // Reset Zoom: Ctrl + 0
            if (e.ctrlKey && e.key === '0') {
                e.preventDefault();
                setScale(1);
                setPosition({ x: 0, y: 0 }); // Optional: center view
                return;
            }

            // =========================================================================
            // Tool Shortcuts (only if not typing and not holding Ctrl/Alt)
            // =========================================================================
            if (!isTyping && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const key = e.key.toLowerCase();

                switch (key) {
                    case 'v': setTool('pointer'); break;
                    case 't': setTool('text'); break;
                    case 's': setTool('sticky'); break;
                    case 'r': setTool('rect'); break;
                    case 'c': setTool('circle'); break;
                    case 'p': setTool('pen'); break;
                    case 'l': setTool('line'); break;
                    case 'a': setTool('arrow'); break;
                    case 'g':
                        // Toggle Panel Creator
                        setPanelCreatorOpen(!useStore.getState().panelCreatorOpen);
                        break;
                }
            }

            // Delete selected items
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !editingItem && !isTyping) {
                selectedIds.forEach(id => removeItem(id));
            }

            // Arrow keys to move selected items
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0 && !isTyping) {
                e.preventDefault();
                const offset = e.shiftKey ? 10 : 1; // Shift for larger steps
                const dx = e.key === 'ArrowLeft' ? -offset : e.key === 'ArrowRight' ? offset : 0;
                const dy = e.key === 'ArrowUp' ? -offset : e.key === 'ArrowDown' ? offset : 0;

                selectedIds.forEach(id => {
                    const item = items.find(i => i.id === id);
                    if (item) {
                        updateItem(id, { x: item.x + dx, y: item.y + dy });
                    }
                });
            }

            // Spacebar for panning - using ref for instant response
            if (e.code === 'Space' && !isTyping && !isSpacePressedRef.current) {
                isSpacePressedRef.current = true;
                setIsPanning(true); // Make Stage draggable immediately
                if (containerRef.current) {
                    containerRef.current.style.cursor = 'grab';
                }
                e.preventDefault();
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                isSpacePressedRef.current = false;
                setIsPanning(false);
                if (containerRef.current) {
                    containerRef.current.style.cursor = 'default';
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedIds, removeItem, editingItem, undo, redo, items, updateItem]);

    // Handle styling for inline text area
    useEffect(() => {
        if (editingItem) {
            const item = items.find(i => i.id === editingItem);
            if (!item) {
                setEditingItem(null);
                return;
            }

            const itemAbsX = item.x * scale + position.x;
            const itemAbsY = item.y * scale + position.y;

            setTextAreaPosition({
                x: itemAbsX,
                y: itemAbsY,
                width: item.width,
                height: item.height,
                fontSize: item.fontSize * scale,
                color: item.fill
            });
        }
    }, [editingItem, items, scale, position]);

    useEffect(() => {
        const handleResize = () => {
            setStageSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [stageSize, setStageSize]);

    // Load images for rendering
    // Load images for rendering
    useEffect(() => {
        items.forEach(item => {
            if (item.type === 'image' && !images[item.content]) {
                const img = new window.Image();
                img.crossOrigin = 'anonymous'; // Prevent tainted canvas for export

                // Handle local file paths with convertFileSrc
                let src = item.content;
                if (src.startsWith('file:///')) {
                    // Extract path: file:///C:/path/to/image.png -> C:/path/to/image.png
                    // On Windows we might need to be careful with the drive letter
                    const path = src.replace('file:///', '');
                    // decodeURIComponent is important if path has spaces (e.g. "GeneratedBoards")
                    const decodedPath = decodeURIComponent(path);
                    src = convertFileSrc(decodedPath);
                }

                img.src = src;
                img.onload = () => {
                    setImages(prev => ({ ...prev, [item.content]: img }));
                };
                img.onerror = (err) => {
                    console.error("Failed to load image:", item.content, src, err);
                }
            }
        });
    }, [items]);

    // Handle Paste Event
    useEffect(() => {
        const handlePaste = (e) => {
            // Prevent default behavior if needed, generally good for canvas apps
            // but might block input fields. Check active element.
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }

            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();
                    const img = new window.Image();
                    const url = URL.createObjectURL(blob);

                    img.src = url;
                    img.onload = () => {
                        const stage = stageRef.current;
                        let x = 0;
                        let y = 0;

                        if (stage) {
                            // Paste at center of viewport
                            const stageScale = stage.scaleX();
                            const stagePos = stage.position();
                            const container = containerRef.current;

                            if (container) {
                                const rect = container.getBoundingClientRect();
                                const viewportCenterX = rect.width / 2;
                                const viewportCenterY = rect.height / 2;

                                x = (viewportCenterX - stagePos.x) / stageScale;
                                y = (viewportCenterY - stagePos.y) / stageScale;
                            } else {
                                x = (-stagePos.x + 100) / stageScale;
                                y = (-stagePos.y + 100) / stageScale;
                            }
                        }

                        addItem({
                            id: uuidv4(),
                            type: 'image',
                            x: x - (img.width > 500 ? 250 : img.width / 2), // Center the image point
                            y: y - (img.height * (img.width > 500 ? 500 / img.width : 1)) / 2,
                            content: url, // Use blob URL
                            width: img.width > 500 ? 500 : img.width,
                            height: (img.width > 500 ? 500 : img.width) * (img.height / img.width),
                        });
                    };
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [addItem]);

    // File Drag & Drop Handlers (HTML5 - only for browser, not Tauri)
    const handleDragOver = (e) => {
        // Only handle in browser mode, Tauri has its own handler
        const isTauri = typeof window !== 'undefined' && window.__TAURI__;
        if (isTauri) return;
        e.preventDefault();
    };

    const handleDrop = (e) => {
        // Only handle in browser mode, Tauri has its own handler
        const isTauri = typeof window !== 'undefined' && window.__TAURI__;
        if (isTauri) {
            return;
        }


        e.preventDefault();
        const stage = stageRef.current;
        stage.setPointersPositions(e);
        const pointerPosition = stage.getPointerPosition();

        const point = {
            x: (pointerPosition.x - stage.x()) / stage.scaleX(),
            y: (pointerPosition.y - stage.y()) / stage.scaleY(),
        };

        const files = Array.from(e.dataTransfer.files);

        files.forEach((file) => {
            // Handle JSON files (board files)
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        // Load the board data using store actions
                        if (data.scale) setScale(data.scale);
                        if (data.position) setPosition(data.position);

                        if (data.items) {
                            items.forEach(item => removeItem(item.id));
                            data.items.forEach(item => addItem(item));
                        }

                        // Load grid and background config (HTML5 drop)
                        const { setGridConfig, setBackgroundConfig } = useStore.getState();
                        if (data.gridConfig) setGridConfig(data.gridConfig);
                        if (data.backgroundConfig) setBackgroundConfig(data.backgroundConfig);

                    } catch (err) {
                        console.error('Failed to parse JSON:', err);
                        alert('Invalid board file');
                    }
                };
                reader.readAsText(file);
                return;
            }

            // Handle images
            if (file.type.startsWith('image/')) {
                const img = new window.Image();
                img.src = URL.createObjectURL(file);
                img.onload = () => {
                    addItem({
                        id: uuidv4(),
                        type: 'image',
                        x: point.x,
                        y: point.y,
                        content: img.src,
                        width: img.width > 500 ? 500 : img.width,
                        height: (img.width > 500 ? 500 : img.width) * (img.height / img.width),
                    });
                };
            }
        });
    };

    const handleStageMouseDown = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectItem(null);
            setEditingItem(null);
            setContextMenu(null);

            // Start Selection Box logic (Left Click + Drag on empty space)
            // But NOT if we are panning (spacebar) or using a tool
            if (activeTool === 'pointer' && !isPanning && e.evt.button === 0) {
                const stage = e.target.getStage();
                const pos = stage.getPointerPosition();
                const x = (pos.x - stage.x()) / stage.scaleX();
                const y = (pos.y - stage.y()) / stage.scaleY();
                setSelectionBox({ x1: x, y1: y, x2: x, y2: y }); // Start point
            }
        } else {
            // Clicked on item or transformer
            // If right click, show context menu
            if (e.evt.button === 2) {
                const stage = stageRef.current;
                const pointer = stage.getPointerPosition();

                const itemId = e.target.id();
                const item = items.find(i => i.id === itemId);

                let linkUrl = null;
                if (item && (item.type === 'text' || item.type === 'sticky')) {
                    if (isValidUrl(item.content)) {
                        linkUrl = item.content;
                        if (!linkUrl.startsWith('http') && !linkUrl.startsWith('file')) {
                            linkUrl = 'https://' + linkUrl;
                        }
                    }
                }

                setContextMenu({
                    x: pointer.x + 20,
                    y: pointer.y + 20,
                    itemId: e.target.id(),
                    linkUrl: linkUrl
                });

                // Select item if not already selected
                if (!selectedIds.includes(e.target.id())) {
                    selectItem(e.target.id());
                }
                return;
            }
        }

        // Drawing Logic
        if (activeTool === 'pen' || activeTool === 'line' || activeTool === 'arrow') {
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const x = (pos.x - stage.x()) / stage.scaleX();
            const y = (pos.y - stage.y()) / stage.scaleY();

            // Snap start point if close to another item's snap point
            const { point: startPoint } = calculateSnapPoint({ x, y }, items);

            setActiveDrawing({
                type: activeTool,
                points: [startPoint.x, startPoint.y, startPoint.x, startPoint.y], // Start with 2 points same pos
                isSnapped: false
            });
        }
        // Creating Shapes Logic
        else if (activeTool !== 'pointer') {
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const x = (pos.x - stage.x()) / stage.scaleX();
            const y = (pos.y - stage.y()) / stage.scaleY();
            setCreatingShape({ type: activeTool, x1: x, y1: y, x2: x, y2: y });
        }
    };

    const handleStageMouseMove = (e) => {
        // Handle Box Selection Drag
        if (selectionBox) {
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const x = (pos.x - stage.x()) / stage.scaleX();
            const y = (pos.y - stage.y()) / stage.scaleY();
            setSelectionBox(prev => ({ ...prev, x2: x, y2: y }));
            return; // Don't do other drag logic
        }

        // Handle Active Drawing Drag
        if (activeDrawing) {
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const rawX = (pos.x - stage.x()) / stage.scaleX();
            const rawY = (pos.y - stage.y()) / stage.scaleY();

            // Check snapping for the current end point
            const { point: endPoint, isSnapped } = calculateSnapPoint({ x: rawX, y: rawY }, items);

            const newPoints = activeDrawing.type === 'pen'
                ? [...activeDrawing.points, rawX, rawY] // Pen: Append points (no snapping for freehand yet)
                : [...activeDrawing.points.slice(0, 2), endPoint.x, endPoint.y]; // Line/Arrow: Update end point

            setActiveDrawing({ ...activeDrawing, points: newPoints, isSnapped });
            return;
        }

        // Handle Shape Creation Drag
        if (creatingShape) {
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const x = (pos.x - stage.x()) / stage.scaleX();
            const y = (pos.y - stage.y()) / stage.scaleY();
            setCreatingShape(prev => ({ ...prev, x2: x, y2: y }));
        }
    };

    const handleStageMouseUp = (e) => {
        // Finish Drawing
        if (activeDrawing) {
            const { type, points } = activeDrawing;
            // Only add if it has some length/points
            if (points.length >= 4) { // Min 2 points (x1,y1, x2,y2)
                addItem({
                    id: uuidv4(),
                    type: 'drawing',
                    subtype: type,
                    points: points,
                    stroke: drawingConfig.stroke,
                    strokeWidth: drawingConfig.strokeWidth,
                    x: 0, // Points are absolute
                    y: 0,
                });
            }
            setActiveDrawing(null);
            setTool('pointer'); // Reset to pointer
            return;
        }

        // Finish Shape Creation
        if (creatingShape) {
            const { type, x1, y1, x2, y2 } = creatingShape;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            if (width > 5 && height > 5) { // Min size
                if (type === 'text' || type === 'sticky') {
                    // For text/sticky, create item and immediately enter edit mode
                    const id = uuidv4();
                    const fontSize = type === 'text' ? 24 : 16;
                    addItem({
                        id,
                        type,
                        x,
                        y,
                        width,
                        height,
                        content: type === 'text' ? 'Double click to edit' : 'Note',
                        fill: type === 'sticky' ? '#ffff88' : '#333', // Default values
                        fontSize: fontSize,
                        ...(type === 'sticky' ? { color: '#ffff88' } : {})
                    });
                    // Select and edit
                    selectItem(id);
                    // Short delay to ensure rendering
                    setTimeout(() => setEditingItem(id), 50);

                } else {
                    // Rect, Circle
                    const id = uuidv4();
                    addItem({
                        id,
                        type,
                        x,
                        y,
                        width,
                        height,
                        fill: 'transparent',
                        stroke: '#333',
                        strokeWidth: 2,
                        ...(type === 'circle' ? { radius: Math.min(width, height) / 2 } : {})
                    });
                    // Select the new item
                    selectItem(id);
                }
            }
            setCreatingShape(null);
            setTool('pointer'); // Reset to pointer after creation
            return;
        }

        if (selectionBox) {
            // Find all items within selection box
            const box = {
                x: Math.min(selectionBox.x1, selectionBox.x2),
                y: Math.min(selectionBox.y1, selectionBox.y2),
                width: Math.abs(selectionBox.x2 - selectionBox.x1),
                height: Math.abs(selectionBox.y2 - selectionBox.y1),
            };

            const selectedInBox = items.filter(item => {
                let itemX, itemY, itemWidth, itemHeight;

                // Handle drawing items (pen, line, arrow) which use points array
                if (item.type === 'drawing' && item.points && item.points.length >= 2) {
                    // Calculate bounding box from points
                    const xs = [];
                    const ys = [];
                    for (let i = 0; i < item.points.length; i += 2) {
                        xs.push(item.points[i]);
                        ys.push(item.points[i + 1]);
                    }
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);

                    // Apply item transformations
                    itemX = minX + (item.x || 0);
                    itemY = minY + (item.y || 0);
                    itemWidth = maxX - minX;
                    itemHeight = maxY - minY;
                } else {
                    // Regular items with x, y, width, height
                    itemX = item.x;
                    itemY = item.y;
                    itemWidth = item.width || 100;
                    itemHeight = item.height || 100;
                }

                // Check if item overlaps with selection box
                return !(itemX > box.x + box.width ||
                    itemX + itemWidth < box.x ||
                    itemY > box.y + box.height ||
                    itemY + itemHeight < box.y);
            });

            if (selectedInBox.length > 0) {
                selectItem(selectedInBox[0].id, false);
                // Add rest with shift
                selectedInBox.slice(1).forEach(item => selectItem(item.id, true));
            }

            setSelectionBox(null);
        };

        setCreatingShape(null); // Ensure cleaned up
    };

    const handleStageClick = (e) => {
        const stage = stageRef.current;
        if (e.target === stage) {
            // Only handle pointer tool interactions
            if (activeTool === 'pointer') {
                // Selection already handled in mousedown/mouseup
                return;
            }
            // Other tools don't use click anymore (only drag)
        }
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };

        setScale(newScale);
        setPosition(newPos);
    };

    const handleDragEnd = (e) => {
        if (e.target === stageRef.current) {
            setPosition({
                x: e.target.x(),
                y: e.target.y(),
            });
        }
    };

    const [snapLines, setSnapLines] = useState([]); // Array of lines to draw

    // Helper functions for snapping
    const getLineGuideStops = (skipShape) => {
        const vertical = [];
        const horizontal = [];

        // Add stage edges (optional, maybe distracting)
        // vertical.push(0, stageSize.width);
        // horizontal.push(0, stageSize.height);

        items.forEach(guideItem => {
            if (guideItem.id === skipShape.id || guideItem.type === 'drawing') return;

            const box = {
                x: guideItem.x,
                y: guideItem.y,
                width: guideItem.width || 0,
                height: guideItem.height || 0,
            };

            vertical.push([box.x, box.x, box.y, box.y + box.height]); // Left
            vertical.push([box.x + box.width, box.x + box.width, box.y, box.y + box.height]); // Right
            vertical.push([box.x + box.width / 2, box.x + box.width / 2, box.y, box.y + box.height]); // Center

            horizontal.push([box.y, box.x, box.x + box.width, box.y]); // Top
            horizontal.push([box.y + box.height, box.x, box.x + box.width, box.y + box.height]); // Bottom
            horizontal.push([box.y + box.height / 2, box.x, box.x + box.width, box.y + box.height / 2]); // Center
        });

        return { vertical, horizontal };
    };

    const getObjectSnappingEdges = (node) => {
        const box = {
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
        };

        return {
            vertical: [
                { guide: box.x, offset: 0, snap: 'start' },
                { guide: box.x + box.width / 2, offset: box.width / 2, snap: 'center' },
                { guide: box.x + box.width, offset: box.width, snap: 'end' },
            ],
            horizontal: [
                { guide: box.y, offset: 0, snap: 'start' },
                { guide: box.y + box.height / 2, offset: box.height / 2, snap: 'center' },
                { guide: box.y + box.height, offset: box.height, snap: 'end' },
            ],
        };
    };

    const getGuides = (lineGuideStops, itemBounds) => {
        const resultV = [];
        const resultH = [];
        const threshold = 10; // Splitting threshold

        lineGuideStops.vertical.forEach((lineGuide) => {
            itemBounds.vertical.forEach((itemBound) => {
                const diff = Math.abs(lineGuide[0] - itemBound.guide);
                if (diff < threshold) {
                    resultV.push({
                        lineGuide: lineGuide[0],
                        diff: diff,
                        snap: itemBound.snap,
                        offset: itemBound.offset,
                    });
                }
            });
        });

        lineGuideStops.horizontal.forEach((lineGuide) => {
            itemBounds.horizontal.forEach((itemBound) => {
                const diff = Math.abs(lineGuide[0] - itemBound.guide);
                if (diff < threshold) {
                    resultH.push({
                        lineGuide: lineGuide[0],
                        diff: diff,
                        snap: itemBound.snap,
                        offset: itemBound.offset,
                    });
                }
            });
        });

        const guides = [];

        // Find closest vertical snap
        const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
        if (minV) {
            guides.push({
                lineGuide: minV.lineGuide,
                offset: minV.offset,
                orientation: 'V',
                snap: minV.snap,
            });
        }

        // Find closest horizontal snap
        const minH = resultH.sort((a, b) => a.diff - b.diff)[0];
        if (minH) {
            guides.push({
                lineGuide: minH.lineGuide,
                offset: minH.offset,
                orientation: 'H',
                snap: minH.snap,
            });
        }

        return guides;
    };

    // Rendering Helpers
    const renderItem = (item) => {
        if (editingItem === item.id) {
            if (item.type === 'text') return null; // Hide text only
            // For sticky, we want to show the colored rect but hide the text
        }

        const draggable = activeTool === 'pointer';

        const commonProps = {
            id: item.id,
            name: item.id,
            x: item.x,
            y: item.y,
            draggable: draggable,
            rotation: item.rotation || 0,
            scaleX: item.scaleX || 1,
            scaleY: item.scaleY || 1,
            onClick: (e) => {
                if (activeTool === 'pointer') {
                    selectItem(item.id, e.evt?.shiftKey || false);
                    e.cancelBubble = true;
                }
            },
            onTap: (e) => { if (activeTool === 'pointer') { selectItem(item.id, e.evt?.shiftKey || false); e.cancelBubble = true; } },
            onDragStart: (e) => {
                // Clear any existing snap lines
                setSnapLines([]);

                // Ctrl+Drag duplication - only if explicitly holding Ctrl during drag START
                const isCtrlPressed = e.evt && (e.evt.ctrlKey === true || e.evt.metaKey === true);

                if (isCtrlPressed) {
                    // Create duplicate at current position
                    const duplicate = {
                        ...item,
                        id: uuidv4(),
                        x: item.x,
                        y: item.y,
                    };
                    addItem(duplicate);
                    // Select and drag the duplicate
                    selectItem(duplicate.id);
                    // The original stays in place
                } else {
                    // Normal drag - select if not already selected
                    if (!selectedIds.includes(item.id)) selectItem(item.id);
                }
                e.cancelBubble = true;
            },
            onDragMove: (e) => {
                // Snapping Logic - Only active if Shift is pressed
                if (e.evt.shiftKey) {
                    const node = e.target;

                    // 1. Grid Snapping (Secondary priority or if no objects around)
                    // We only apply if NO object snapping occurred, OR we combine them? 
                    // Let's prioritize Object Snapping, then Grid.

                    const lineGuideStops = getLineGuideStops(item);
                    const itemBounds = getObjectSnappingEdges(node);
                    const guides = getGuides(lineGuideStops, itemBounds);

                    const newSnapLines = [];

                    if (guides.length === 0) {
                        // Grid Snapping
                        const snapSize = gridConfig.spacing || 50;
                        const x = node.x();
                        const y = node.y();

                        const snappedX = Math.round(x / snapSize) * snapSize;
                        const snappedY = Math.round(y / snapSize) * snapSize;

                        // Apply simple threshold for grid too? let's stick to rigid grid snap for now
                        node.x(snappedX);
                        node.y(snappedY);
                    } else {
                        // Object Snapping
                        guides.forEach(lg => {
                            if (lg.orientation === 'V') {
                                node.x(lg.lineGuide - lg.offset);
                                newSnapLines.push({
                                    points: [lg.lineGuide, -6000, lg.lineGuide, 6000], // infinite vertical line logic
                                    orientation: 'V'
                                });
                            } else if (lg.orientation === 'H') {
                                node.y(lg.lineGuide - lg.offset);
                                newSnapLines.push({
                                    points: [-6000, lg.lineGuide, 6000, lg.lineGuide], // infinite horizontal line logic
                                    orientation: 'H'
                                });
                            }
                        });
                    }

                    setSnapLines(newSnapLines);
                } else {
                    // Clear lines if Shift is released mid-drag
                    setSnapLines([]);
                }
            },
            onDragEnd: (e) => {
                setSnapLines([]); // Clear lines
                updateItem(item.id, { x: e.target.x(), y: e.target.y() });
            },
            onTransformEnd: (e) => {
                const node = e.target;
                const updates = {
                    x: node.x(),
                    y: node.y(),
                    rotation: node.rotation(),
                };

                // For text objects, update width based on scale instead of applying scale
                if (item.type === 'text') {
                    const newWidth = Math.max(50, node.width() * node.scaleX());
                    updates.width = newWidth;
                    // Reset scale to 1 after applying it to width
                    node.scaleX(1);
                    node.scaleY(1);
                } else {
                    // For other objects, keep scale
                    updates.scaleX = node.scaleX();
                    updates.scaleY = node.scaleY();
                }

                updateItem(item.id, updates);
            }
        };

        // Handle drawing items (pen, line, arrow)
        if (item.type === 'drawing') {
            if (item.subtype === 'pen' || item.subtype === 'line') {
                return (
                    <Line
                        key={item.id}
                        {...commonProps}
                        points={item.points}
                        stroke={item.stroke}
                        strokeWidth={item.strokeWidth}
                        tension={item.subtype === 'pen' ? 0.5 : 0} // Smooth pen strokes
                        lineCap="round"
                        lineJoin="round"
                    />
                );
            } else if (item.subtype === 'arrow') {
                return (
                    <Arrow
                        key={item.id}
                        {...commonProps}
                        points={item.points}
                        stroke={item.stroke}
                        strokeWidth={item.strokeWidth}
                        fill={item.stroke}
                        pointerLength={10}
                        pointerWidth={10}
                    />
                );
            }
        }

        if (item.type === 'image') {
            return (
                <KonvaImage
                    key={item.id}
                    {...commonProps}
                    image={images[item.content]}
                    width={item.width}
                    height={item.height}
                />
            );
        }

        if (item.type === 'text') {
            return (
                <Text
                    key={item.id}
                    {...commonProps}
                    text={item.content}
                    fontSize={item.fontSize}
                    fill={isValidUrl(item.content) ? '#FF6B00' : item.fill}
                    fontFamily={item.fontFamily || "sans-serif"}
                    width={item.width || 200}
                    wrap="word"
                    align={item.align || "left"}
                    onDblClick={() => {
                        setEditingItem(item.id);
                    }}
                />
            );
        }

        if (item.type === 'sticky') {
            return (
                <Group key={item.id} {...commonProps}>
                    <Rect
                        width={item.width}
                        height={item.height}
                        fill={item.color}
                        shadowBlur={10}
                        shadowColor="rgba(0,0,0,0.2)"
                    />
                    {editingItem !== item.id && (
                        <Text
                            x={10}
                            y={10}
                            width={item.width - 20}
                            height={item.height - 20}
                            text={item.content}
                            fontSize={item.fontSize || 16}
                            fill={isValidUrl(item.content) ? '#FF6B00' : (item.fill || "#333")}
                            fontFamily={item.fontFamily || "sans-serif"}
                            wrap="word"
                            align={item.align || "center"} // Respect alignment
                            verticalAlign="middle"
                            onDblClick={() => setEditingItem(item.id)}
                        />
                    )}
                </Group>
            );
        }

        if (item.type === 'rect') {
            return (
                <Rect
                    key={item.id}
                    {...commonProps}
                    width={item.width}
                    height={item.height}
                    fill={item.fill}
                    stroke={item.stroke}
                    strokeWidth={item.strokeWidth}
                />
            );
        }

        if (item.type === 'circle') {
            return (
                <Circle
                    key={item.id}
                    {...commonProps}
                    // Circle radius logic with transformer
                    radius={item.radius || 50}
                    // When transforming a circle, scaleX/scaleY changes.
                    // We can just rely on scale for ellipse effect or keep it perfect circle.
                    fill={item.fill}
                    stroke={item.stroke}
                    strokeWidth={item.strokeWidth}
                />
            );
        }

        return null;
    };

    // Infinite Grid Component - calculates visible lines based on viewport
    const Grid = ({ config }) => {
        if (!config.visible) return null;

        const { type, spacing, color, opacity } = config;
        const stage = stageRef.current;

        if (!stage) return null;

        // Get viewport bounds in world coordinates
        const stageScale = stage.scaleX();
        const stageX = stage.x();
        const stageY = stage.y();
        const stageWidth = stage.width();
        const stageHeight = stage.height();

        // Calculate visible area in world coordinates
        const viewportLeft = (-stageX) / stageScale;
        const viewportTop = (-stageY) / stageScale;
        const viewportRight = viewportLeft + (stageWidth / stageScale);
        const viewportBottom = viewportTop + (stageHeight / stageScale);

        // Add padding to extend grid beyond viewport edges
        const padding = spacing * 10;
        const minX = viewportLeft - padding;
        const maxX = viewportRight + padding;
        const minY = viewportTop - padding;
        const maxY = viewportBottom + padding;

        // Calculate grid line indices
        const startCol = Math.floor(minX / spacing);
        const endCol = Math.ceil(maxX / spacing);
        const startRow = Math.floor(minY / spacing);
        const endRow = Math.ceil(maxY / spacing);

        if (type === 'dots') {
            // Render dots (keeping for backwards compatibility, though not recommended)
            const dots = [];
            for (let i = startCol; i <= endCol; i++) {
                for (let j = startRow; j <= endRow; j++) {
                    dots.push(
                        <Circle
                            key={`dot-${i}-${j}`}
                            x={i * spacing}
                            y={j * spacing}
                            radius={2}
                            fill={color}
                            opacity={opacity}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                }
            }
            return <Group>{dots}</Group>;
        } else {
            // Render lines grid (infinite)
            const lines = [];

            // Vertical lines
            for (let i = startCol; i <= endCol; i++) {
                lines.push(
                    <Line
                        key={`v-${i}`}
                        points={[i * spacing, minY, i * spacing, maxY]}
                        stroke={color}
                        strokeWidth={1}
                        opacity={opacity}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }

            // Horizontal lines
            for (let j = startRow; j <= endRow; j++) {
                lines.push(
                    <Line
                        key={`h-${j}`}
                        points={[minX, j * spacing, maxX, j * spacing]}
                        stroke={color}
                        strokeWidth={1}
                        opacity={opacity}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }

            return <Group>{lines}</Group>;
        }
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="w-full h-full relative"
        >
            {editingItem && (() => {
                const item = items.find(i => i.id === editingItem);
                if (!item || (item.type !== 'text' && item.type !== 'sticky')) return null;

                const isSticky = item.type === 'sticky';

                return (
                    <textarea
                        value={item.content}
                        onChange={(e) => updateItem(item.id, { content: e.target.value })}
                        onBlur={() => setEditingItem(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter for newline
                                setEditingItem(null);
                            }
                        }}
                        autoFocus
                        style={{
                            position: 'absolute',
                            top: textAreaPosition.y + (isSticky ? 10 * scale : 0),
                            left: textAreaPosition.x + (isSticky ? 10 * scale : 0),
                            width: isSticky ? (item.width - 20) * scale : undefined,
                            height: isSticky ? (item.height - 20) * scale : undefined,
                            fontSize: `${(item.fontSize || 16) * scale}px`,
                            color: isSticky ? '#333' : textAreaPosition.color,
                            border: '1px dashed #FF6B00',
                            padding: '0px',
                            margin: '-1px',
                            background: 'transparent',
                            outline: 'none',
                            resize: 'none',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap', // Wrap for stickies
                            zIndex: 100,
                        }}
                    />
                );
            })()}

            <div
                ref={containerRef}
                className="w-full h-screen"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <Stage
                    width={stageSize.width}
                    height={stageSize.height}
                    onWheel={handleWheel}
                    draggable={isPanning}
                    onDragEnd={handleDragEnd}
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={handleStageMouseMove}
                    onMouseUp={handleStageMouseUp}
                    onClick={handleStageClick}
                    onTap={handleStageClick}
                    onContextMenu={(e) => e.evt.preventDefault()} // Prevent context menu
                    scaleX={scale}
                    scaleY={scale}
                    x={position.x}
                    y={position.y}
                    ref={stageRef}
                >
                    {/* Background Layer */}
                    <Layer>
                        <Rect
                            x={-10000}
                            y={-10000}
                            width={20000}
                            height={20000}
                            fill={backgroundConfig.type === 'none' ? 'transparent' : backgroundConfig.color}
                            listening={false}
                        />
                    </Layer>

                    {/* Grid Layer */}
                    <Layer>
                        <Grid config={gridConfig} />
                    </Layer>

                    {/* Snap Lines Layer */}
                    <Layer>
                        {snapLines.map((line, i) => (
                            <Line
                                key={i}
                                points={line.points}
                                stroke="#FF6B00"
                                strokeWidth={1}
                                dash={[5, 5]}
                                listening={false}
                            />
                        ))}
                    </Layer>

                    <Layer ref={contentLayerRef}>
                        {items.map(renderItem)}

                        {/* Anchor Points Visualization - show when line/arrow tool is active */}
                        {['line', 'arrow'].includes(activeTool) && items.map(item => {
                            if (item.type === 'drawing') return null; // Skip drawings

                            const anchorPoints = [];

                            if (item.type === 'rect' || item.type === 'sticky' || item.type === 'text') {
                                const w = item.width || 100;
                                const h = item.height || 100;
                                anchorPoints.push(
                                    { x: item.x + w / 2, y: item.y + h / 2 }, // center
                                    { x: item.x, y: item.y }, // top-left
                                    { x: item.x + w, y: item.y }, // top-right
                                    { x: item.x, y: item.y + h }, // bottom-left
                                    { x: item.x + w, y: item.y + h }, // bottom-right
                                    { x: item.x + w / 2, y: item.y }, // top-center
                                    { x: item.x + w / 2, y: item.y + h }, // bottom-center
                                    { x: item.x, y: item.y + h / 2 }, // left-center
                                    { x: item.x + w, y: item.y + h / 2 }, // right-center
                                );
                            } else if (item.type === 'circle') {
                                const r = item.radius || 50;
                                anchorPoints.push(
                                    { x: item.x, y: item.y }, // center
                                    { x: item.x + r, y: item.y }, // right
                                    { x: item.x - r, y: item.y }, // left
                                    { x: item.x, y: item.y + r }, // bottom
                                    { x: item.x, y: item.y - r }, // top
                                );
                            } else if (item.type === 'image') {
                                const w = item.width || 100;
                                const h = item.height || 100;
                                anchorPoints.push(
                                    { x: item.x + w / 2, y: item.y + h / 2 }, // center
                                    { x: item.x, y: item.y }, // top-left
                                    { x: item.x + w, y: item.y }, // top-right
                                    { x: item.x, y: item.y + h }, // bottom-left
                                    { x: item.x + w, y: item.y + h }, // bottom-right
                                    { x: item.x + w / 2, y: item.y }, // top-center
                                    { x: item.x + w / 2, y: item.y + h }, // bottom-center
                                    { x: item.x, y: item.y + h / 2 }, // left-center
                                    { x: item.x + w, y: item.y + h / 2 }, // right-center
                                );
                            }

                            return anchorPoints.map((point, idx) => (
                                <Circle
                                    key={`anchor-${item.id}-${idx}`}
                                    x={point.x}
                                    y={point.y}
                                    radius={4}
                                    fill="#FF6B00"
                                    opacity={0.6}
                                    listening={false}
                                />
                            ));
                        })}

                        {/* Custom Handles for Selected Drawing Items (Line/Arrow) */}
                        {selectedIds.map(id => {
                            const item = items.find(i => i.id === id);
                            if (!item || item.type !== 'drawing' || !item.points || item.points.length < 4) return null;

                            // Show handles for start and end points
                            const startX = item.points[0] + (item.x || 0);
                            const startY = item.points[1] + (item.y || 0);
                            const endX = item.points[item.points.length - 2] + (item.x || 0);
                            const endY = item.points[item.points.length - 1] + (item.y || 0);

                            return (
                                <React.Fragment key={`handles-${id}`}>
                                    {/* Start Point Handle */}
                                    <Circle
                                        x={startX}
                                        y={startY}
                                        radius={8}
                                        fill="#FF6B00"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                        draggable
                                        onDragMove={(e) => {
                                            const rawPoint = { x: e.target.x(), y: e.target.y() };
                                            const { point: snappedPoint } = calculateSnapPoint(rawPoint, items);

                                            const newPoints = [...item.points];
                                            newPoints[0] = snappedPoint.x - (item.x || 0);
                                            newPoints[1] = snappedPoint.y - (item.y || 0);
                                            updateItem(id, { points: newPoints });

                                            // Update handle position to snapped location
                                            e.target.x(snappedPoint.x);
                                            e.target.y(snappedPoint.y);
                                        }}
                                    />
                                    {/* End Point Handle */}
                                    <Circle
                                        x={endX}
                                        y={endY}
                                        radius={8}
                                        fill="#FF6B00"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                        draggable
                                        onDragMove={(e) => {
                                            const rawPoint = { x: e.target.x(), y: e.target.y() };
                                            const { point: snappedPoint } = calculateSnapPoint(rawPoint, items);

                                            const newPoints = [...item.points];
                                            newPoints[item.points.length - 2] = snappedPoint.x - (item.x || 0);
                                            newPoints[item.points.length - 1] = snappedPoint.y - (item.y || 0);
                                            updateItem(id, { points: newPoints });

                                            // Update handle position to snapped location
                                            e.target.x(snappedPoint.x);
                                            e.target.y(snappedPoint.y);
                                        }}
                                    />
                                </React.Fragment>
                            );
                        })}

                        <Transformer
                            ref={transformerRef}
                            borderStroke="#FF6B00"
                            anchorStroke="#FF6B00"
                            anchorFill="#18181b"
                            anchorSize={10}
                            borderDash={[4, 4]}
                        />

                        {/* Selection Box Visual */}
                        {selectionBox && (
                            <Rect
                                x={Math.min(selectionBox.x1, selectionBox.x2)}
                                y={Math.min(selectionBox.y1, selectionBox.y2)}
                                width={Math.abs(selectionBox.x2 - selectionBox.x1)}
                                height={Math.abs(selectionBox.y2 - selectionBox.y1)}
                                fill="rgba(255, 107, 0, 0.1)"
                                stroke="#FF6B00"
                                strokeWidth={2}
                                dash={[4, 4]}
                                listening={false}
                            />
                        )}

                        {/* Creating Shape Preview */}
                        {creatingShape && (() => {
                            const { type, x1, y1, x2, y2 } = creatingShape;
                            const x = Math.min(x1, x2);
                            const y = Math.min(y1, y2);
                            const width = Math.abs(x2 - x1);
                            const height = Math.abs(y2 - y1);

                            if (type === 'rect' || type === 'text' || type === 'sticky') {
                                return (
                                    <Rect
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={height}
                                        fill="rgba(255, 107, 0, 0.05)"
                                        stroke="#FF6B00"
                                        strokeWidth={2}
                                        dash={[8, 8]}
                                        listening={false}
                                    />
                                );
                            } else if (type === 'circle') {
                                const radius = Math.min(width, height) / 2;
                                return (
                                    <Circle
                                        x={x + radius}
                                        y={y + radius}
                                        radius={radius}
                                        fill="rgba(255, 107, 0, 0.05)"
                                        stroke="#FF6B00"
                                        strokeWidth={2}
                                        dash={[8, 8]}
                                        listening={false}
                                    />
                                );
                            }
                            return null;
                        })()}

                        {/* Active Drawing Preview */}
                        {activeDrawing && (() => {
                            const { type, points, isSnapped } = activeDrawing;
                            return (
                                <>
                                    {(type === 'pen' || type === 'line') && (
                                        <Line
                                            points={points}
                                            stroke={drawingConfig.stroke}
                                            strokeWidth={drawingConfig.strokeWidth}
                                            tension={type === 'pen' ? 0.5 : 0}
                                            lineCap="round"
                                            lineJoin="round"
                                            listening={false}
                                            opacity={0.8}
                                        />
                                    )}
                                    {type === 'arrow' && (
                                        <Arrow
                                            points={points}
                                            stroke={drawingConfig.stroke}
                                            strokeWidth={drawingConfig.strokeWidth}
                                            fill={drawingConfig.stroke}
                                            pointerLength={10}
                                            pointerWidth={10}
                                            listening={false}
                                            opacity={0.8}
                                        />
                                    )}
                                    {/* Snap indicator */}
                                    {isSnapped && points.length >= 4 && (
                                        <Circle
                                            x={points[points.length - 2]}
                                            y={points[points.length - 1]}
                                            radius={6}
                                            fill="#FF6B00"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            listening={false}
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </Layer>

                    {items.length === 0 && (
                        <Layer>
                            <Group>
                                <Rect
                                    x={stageSize.width / 2 - 200}
                                    y={stageSize.height / 2 - 50}
                                    width={400}
                                    height={100}
                                    fill="transparent"
                                    listening={false}
                                />
                                <Text
                                    x={stageSize.width / 2 - 300}
                                    y={stageSize.height / 2 + 30}
                                    width={600}
                                    align="center"
                                    text="Drag & Drop images to start"
                                    fontSize={24}
                                    fill="#666"
                                    listening={false}
                                />
                            </Group>
                        </Layer>
                    )}
                </Stage>
            </div>

            {/* Zoom Indicator */}
            <div className="absolute bottom-4 left-4 bg-[#1e1e1e] border border-[#333] rounded px-3 py-1 text-xs text-gray-400 select-none shadow-lg z-40">
                {Math.round(scale * 100)}%
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.linkUrl && (
                        <>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-[#333] text-[#00aaff] text-sm flex items-center gap-2"
                                onClick={async () => {
                                    try {
                                        await open(contextMenu.linkUrl);
                                    } catch (err) {
                                        console.error("Failed to open link with shell:", err);
                                        // Fallback for web mode
                                        window.open(contextMenu.linkUrl, '_blank');
                                    }
                                    setContextMenu(null);
                                }}
                            >
                                <span>Open Link ↗</span>
                            </button>
                            <div className="h-[1px] bg-[#333] my-1" />
                        </>
                    )}

                    {/* Use as Reference (Only for Images) */}
                    {contextMenu.itemId && (() => {
                        const item = items.find(i => i.id === contextMenu.itemId);
                        if (item && item.type === 'image') {
                            return (
                                <>
                                    <button
                                        className="w-full text-left px-4 py-2 hover:bg-[#333] text-[#FF6B00] text-sm flex items-center gap-2"
                                        onClick={async () => {
                                            try {
                                                const imgElement = images[item.content];
                                                if (!imgElement) {
                                                    alert("Image not fully loaded yet.");
                                                    return;
                                                }

                                                // Convert to Base64 via Canvas
                                                const canvas = document.createElement('canvas');
                                                canvas.width = imgElement.naturalWidth;
                                                canvas.height = imgElement.naturalHeight;
                                                const ctx = canvas.getContext('2d');
                                                ctx.drawImage(imgElement, 0, 0);
                                                const base64 = canvas.toDataURL('image/png');

                                                // Update Store
                                                setPanelCreatorReferenceImage(base64);
                                                setPanelCreatorOpen(true);
                                                setContextMenu(null);
                                            } catch (e) {
                                                console.error("Failed to set reference:", e);
                                                alert("Failed to process image.");
                                            }
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        <span>Use as Reference</span>
                                    </button>
                                    <div className="h-[1px] bg-[#333] my-1" />
                                </>
                            );
                        }
                        return null;
                    })()}

                    {/* Layer Actions - Only if an item is clicked/selected */}
                    {contextMenu.itemId && (
                        <>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-[#333] text-white text-sm flex items-center gap-2"
                                onClick={() => {
                                    reorderItem(contextMenu.itemId, 'front');
                                    setContextMenu(null);
                                }}
                            >
                                <span>Bring to Front</span>
                                <span className="text-gray-500 text-xs ml-auto">]</span>
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-[#333] text-white text-sm flex items-center gap-2"
                                onClick={() => {
                                    reorderItem(contextMenu.itemId, 'back');
                                    setContextMenu(null);
                                }}
                            >
                                <span>Send to Back</span>
                                <span className="text-gray-500 text-xs ml-auto">[</span>
                            </button>
                            <div className="h-[1px] bg-[#333] my-1" />
                        </>
                    )}

                    <button
                        className="w-full text-left px-4 py-2 hover:bg-[#333] text-white text-sm flex items-center gap-2"
                        onClick={() => {
                            createGroup();
                            setContextMenu(null);
                        }}
                    >
                        <span>Group</span>
                        <span className="text-gray-500 text-xs ml-auto">Ctrl+G</span>
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-[#333] text-white text-sm flex items-center gap-2"
                        onClick={() => {
                            const { ungroupItems } = useStore.getState();
                            ungroupItems();
                            setContextMenu(null);
                        }}
                    >
                        <span>Ungroup</span>
                        <span className="text-gray-500 text-xs ml-auto">Ctrl+Shift+G</span>
                    </button>
                    <div className="h-[1px] bg-[#333] my-1" />
                    <button
                        className="w-full text-left px-4 py-2 hover:bg-[#333] text-red-400 text-sm flex items-center gap-2"
                        onClick={() => {
                            if (selectedIds.length > 0) {
                                selectedIds.forEach(id => removeItem(id));
                                setContextMenu(null);
                            }
                        }}
                    >
                        <span>Delete</span>
                        <span className="text-gray-500 text-xs ml-auto">Del</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default InfiniteCanvas;
