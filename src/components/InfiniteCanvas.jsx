import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Group, Text, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import useStore from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';

const InfiniteCanvas = () => {
    const stageRef = useRef(null);
    const contentLayerRef = useRef(null);
    const transformerRef = useRef(null);
    const {
        scale, position, setScale, setPosition,
        stageSize, setStageSize, setContentLayerRef,
        items, addItem, updateItem, removeItem, activeTool, setTool,
        selectedIds, selectItem, undo, redo
    } = useStore();

    const [images, setImages] = useState({});
    const [editingItem, setEditingItem] = useState(null);
    const [textAreaPosition, setTextAreaPosition] = useState({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState(null); // { x1, y1, x2, y2 }
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useEffect(() => {
        if (contentLayerRef.current) {
            setContentLayerRef(contentLayerRef.current);
        }
    }, [setContentLayerRef]);

    // Transformer Logic
    useEffect(() => {
        if (selectedIds.length > 0 && transformerRef.current) {
            const stage = transformerRef.current.getStage();
            if (!stage) return; // Safety check

            const selectedNodes = selectedIds
                .map(id => stage.findOne('#' + id))
                .filter(node => node !== null);

            if (selectedNodes.length > 0) {
                transformerRef.current.nodes(selectedNodes);
                const layer = transformerRef.current.getLayer();
                if (layer) layer.batchDraw();
            } else {
                transformerRef.current.nodes([]);
            }
        } else if (transformerRef.current) {
            transformerRef.current.nodes([]);
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
            if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                redo();
                return;
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

            // Spacebar for panning
            if (e.key === ' ' && !isTyping && !isSpacePressed) {
                setIsSpacePressed(true);
                e.preventDefault();
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === ' ') {
                setIsSpacePressed(false);
                setIsPanning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedIds, removeItem, editingItem, undo, redo, items, updateItem, isSpacePressed]);

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
    }, [setStageSize]);

    // Video Handling
    const VideoItem = ({ item, updateItem, activeTool, onClick, onDragStart, onDragEnd }) => {
        const imageRef = useRef(null);
        const [videoElement, setVideoElement] = useState(null);

        useEffect(() => {
            if (!item.content) return;
            const vid = document.createElement('video');
            vid.src = item.content;
            vid.crossOrigin = 'anonymous';
            vid.loop = true;
            vid.muted = true;
            vid.play();
            setVideoElement(vid);

            const anim = new Konva.Animation(() => {
            }, imageRef.current?.getLayer());

            anim.start();

            return () => {
                anim.stop();
                vid.pause();
                vid.src = '';
            };
        }, [item.content]);

        useEffect(() => {
            if (!videoElement) return;
            const update = () => {
                if (imageRef.current) {
                    const layer = imageRef.current.getLayer();
                    if (layer) layer.batchDraw();
                }
                if (!videoElement.paused && !videoElement.ended) {
                    requestAnimationFrame(update);
                }
            };
            videoElement.addEventListener('play', update);
            return () => videoElement.removeEventListener('play', update);
        }, [videoElement]);

        return (
            <KonvaImage
                ref={imageRef}
                name={item.id}
                id={item.id}
                image={videoElement}
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                rotation={item.rotation || 0}
                scaleX={item.scaleX || 1}
                scaleY={item.scaleY || 1}
                draggable={activeTool === 'pointer'}
                onClick={onClick}
                onTap={onClick}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTransformEnd={(e) => {
                    const node = e.target;
                    updateItem(item.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY(),
                    });
                }}
            />
        );
    };

    // Load images for rendering
    useEffect(() => {
        items.forEach(item => {
            if (item.type === 'image' && !images[item.content]) {
                const img = new window.Image();
                img.src = item.content;
                img.onload = () => {
                    setImages(prev => ({ ...prev, [item.content]: img }));
                };
            }
        });
    }, [items]);

    // File Drag & Drop Handlers
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
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
                            // Clear current items and add loaded ones
                            items.forEach(item => removeItem(item.id));
                            data.items.forEach(item => addItem(item));
                        }
                        console.log('Board loaded successfully from JSON file!');
                    } catch (error) {
                        console.error('Failed to parse JSON:', error);
                        alert('Invalid board file format: ' + error.message);
                    }
                };
                reader.readAsText(file);
                return;
            }

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new window.Image();
                    img.src = reader.result;
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
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                const url = URL.createObjectURL(file);
                const tempVid = document.createElement('video');
                tempVid.src = url;
                tempVid.onloadedmetadata = () => {
                    addItem({
                        id: uuidv4(),
                        type: 'video',
                        x: point.x,
                        y: point.y,
                        content: url,
                        width: tempVid.videoWidth > 500 ? 500 : tempVid.videoWidth,
                        height: (tempVid.videoWidth > 500 ? 500 : tempVid.videoWidth) * (tempVid.videoHeight / tempVid.videoWidth),
                    });
                };
            }
        });
    };

    // Tool Interaction
    const handleStageMouseDown = (e) => {
        const stage = stageRef.current;

        // Right-click or Spacebar+click starts panning
        if (e.evt.button === 2 || (isSpacePressed && e.evt.button === 0)) {
            setIsPanning(true);
            return;
        }

        // Only handle left-click for selection (when space isn't pressed)
        if (e.target === stage && activeTool === 'pointer' && e.evt.button === 0 && !isSpacePressed) {
            selectItem(null); // Deselect all
            setEditingItem(null);

            // Start selection box
            const pos = stage.getPointerPosition();
            const point = {
                x: (pos.x - stage.x()) / stage.scaleX(),
                y: (pos.y - stage.y()) / stage.scaleY(),
            };
            setSelectionBox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        }
    };

    const handleStageMouseMove = (e) => {
        if (!selectionBox) return;

        const stage = stageRef.current;
        const pos = stage.getPointerPosition();
        const point = {
            x: (pos.x - stage.x()) / stage.scaleX(),
            y: (pos.y - stage.y()) / stage.scaleY(),
        };

        setSelectionBox({
            ...selectionBox,
            x2: point.x,
            y2: point.y,
        });
    };

    const handleStageMouseUp = (e) => {
        // Stop panning on right-click release
        if (e.evt.button === 2) {
            setIsPanning(false);
            return;
        }

        if (!selectionBox) return;

        // Find all items within selection box
        const box = {
            x: Math.min(selectionBox.x1, selectionBox.x2),
            y: Math.min(selectionBox.y1, selectionBox.y2),
            width: Math.abs(selectionBox.x2 - selectionBox.x1),
            height: Math.abs(selectionBox.y2 - selectionBox.y1),
        };

        const selectedInBox = items.filter(item => {
            const itemX = item.x;
            const itemY = item.y;
            const itemWidth = item.width || 100;
            const itemHeight = item.height || 100;

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

    const handleStageClick = (e) => {
        const stage = stageRef.current;
        if (e.target === stage) {
            if (activeTool === 'pointer') {
                // Already handled in mousedown
                return;
            }

            const pointer = stage.getPointerPosition();
            const point = {
                x: (pointer.x - stage.x()) / stage.scaleX(),
                y: (pointer.y - stage.y()) / stage.scaleY(),
            };

            if (activeTool === 'text') {
                const newId = uuidv4();
                addItem({
                    id: newId,
                    type: 'text',
                    x: point.x,
                    y: point.y,
                    content: 'Double click to edit',
                    fontSize: 20,
                    fill: '#ffffff',
                    width: 200, // Default width for text wrapping
                });
                setTool('pointer');
                selectItem(newId);
            } else if (activeTool === 'sticky') {
                const newId = uuidv4();
                addItem({
                    id: newId,
                    type: 'sticky',
                    x: point.x,
                    y: point.y,
                    content: 'New Note',
                    width: 200,
                    height: 200,
                    color: '#ffd700',
                });
                setTool('pointer');
                selectItem(newId);
                setEditingItem(newId); // Immediately edit
            } else if (activeTool === 'rect') {
                const newId = uuidv4();
                addItem({
                    id: newId,
                    type: 'rect',
                    x: point.x,
                    y: point.y,
                    width: 150,
                    height: 100,
                    fill: '#ff9f43',
                    stroke: '#ffffff',
                    strokeWidth: 2
                });
                setTool('pointer');
                selectItem(newId);
            } else if (activeTool === 'circle') {
                const newId = uuidv4();
                addItem({
                    id: newId,
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    width: 100, // Diameter for Konva logic wrapper if needed, but Circle uses radius usually.
                    // Actually Konva Circle uses radius. But transformer works on width/height scale.
                    // Let's use width/height and scale for consistency with Transformer
                    radius: 50,
                    fill: '#54a0ff',
                    stroke: '#ffffff',
                    strokeWidth: 2
                });
                setTool('pointer');
                selectItem(newId);
            }
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

    // Rendering Helpers
    const renderItem = (item) => {
        if (editingItem === item.id) {
            if (item.type === 'text') return null; // Hide text only
            // For sticky, we want to show the colored rect but hide the text
        }

        const draggable = activeTool === 'pointer';

        const commonProps = {
            key: item.id,
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
                if (!selectedIds.includes(item.id)) selectItem(item.id);
                e.cancelBubble = true;
            },
            onDragEnd: (e) => { updateItem(item.id, { x: e.target.x(), y: e.target.y() }); },
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

        if (item.type === 'video') { /* ... */
            return (
                <VideoItem
                    key={item.id}
                    item={item}
                    updateItem={updateItem}
                    activeTool={activeTool}
                    onClick={commonProps.onClick}
                    onDragStart={commonProps.onDragStart}
                    onDragEnd={commonProps.onDragEnd}
                />
            );
        }

        if (item.type === 'image') {
            return (
                <KonvaImage
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
                    {...commonProps}
                    text={item.content}
                    fontSize={item.fontSize}
                    fill={item.fill}
                    width={item.width || 200}
                    wrap="word"
                    onDblClick={() => {
                        setEditingItem(item.id);
                    }}
                />
            );
        }

        if (item.type === 'sticky') {
            return (
                <Group {...commonProps}>
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
                            fontSize={16}
                            fill="#333"
                            fontFamily="sans-serif"
                            onDblClick={() => setEditingItem(item.id)}
                        />
                    )}
                </Group>
            );
        }

        if (item.type === 'rect') {
            return (
                <Rect
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

    const Grid = () => (
        <Group>
            {Array.from({ length: 100 }).map((_, i) => (
                <React.Fragment key={i}>
                    <Rect x={(i - 50) * 100} y={-5000} width={1} height={10000} fill="#3d3d3d" listening={false} />
                    <Rect x={-5000} y={(i - 50) * 100} width={10000} height={1} fill="#3d3d3d" listening={false} />
                </React.Fragment>
            ))}
        </Group>
    );

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
                <Layer>
                    <Grid />
                </Layer>

                <Layer ref={contentLayerRef}>
                    {items.map(renderItem)}
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
                                text="Drag & Drop images or videos to start"
                                fontSize={24}
                                fill="#666"
                                listening={false}
                            />
                        </Group>
                    </Layer>
                )}
            </Stage>
        </div >
    );
};

export default InfiniteCanvas;
