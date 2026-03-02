import React, { useCallback, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
    type NodeChange,
    type EdgeChange,
    Handle,
    Position,
    BackgroundVariant,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ErdSchema, ErdEntity } from '../converters/erdSchema';
import { parseErdFile } from '../converters/erdFileParser';

interface ErdCanvasProps {
    schema: ErdSchema;
    onSchemaChange?: (schema: ErdSchema) => void;
}

// Custom Entity Node component
const EntityNode: React.FC<{ data: ErdEntity }> = ({ data }) => {
    return (
        <div className="entity-node">
            <Handle type="target" position={Position.Left} style={{ background: '#6366f1' }} />
            <div className="entity-node-header">
                <h4>{data.name}</h4>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                    {data.fields.length} fields
                </span>
            </div>
            <div className="entity-node-fields">
                {data.fields.map((field, i) => (
                    <div key={i} className="entity-field">
                        <span className={`entity-field-icon ${field.isPrimaryKey ? 'pk' : field.isForeignKey ? 'fk' : ''}`}>
                            {field.isPrimaryKey ? '🔑' : field.isForeignKey ? '🔗' : '•'}
                        </span>
                        <span className="entity-field-name">{field.name}</span>
                        <span className="entity-field-type">
                            {field.type}{field.isNullable ? '?' : ''}
                        </span>
                    </div>
                ))}
                {data.fields.length === 0 && (
                    <div className="entity-field" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No fields
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} style={{ background: '#6366f1' }} />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    entity: EntityNode as any,
};

const relationshipLabels: Record<string, string> = {
    'ONE_TO_ONE': '1:1',
    'ONE_TO_MANY': '1:N',
    'MANY_TO_ONE': 'N:1',
    'MANY_TO_MANY': 'M:N',
};

export const ErdCanvas: React.FC<ErdCanvasProps> = ({ schema, onSchemaChange }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // Use React Flow's controlled state for nodes + edges
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    // Sync schema → internal React Flow state whenever schema changes
    const [lastSchemaRef, setLastSchemaRef] = useState<ErdSchema | null>(null);
    if (schema !== lastSchemaRef) {
        setLastSchemaRef(schema);
        setNodes(
            schema.entities.map(entity => ({
                id: entity.id,
                type: 'entity',
                position: entity.position,
                data: entity,
                draggable: true,
            }))
        );
        setEdges(
            schema.relationships.map(rel => ({
                id: rel.id,
                source: rel.fromEntityId,
                target: rel.toEntityId,
                label: relationshipLabels[rel.type] || rel.type,
                type: 'smoothstep',
                style: { stroke: '#6366f1', strokeWidth: 2 },
                labelStyle: {
                    fill: '#818cf8',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    fontFamily: "'Inter', sans-serif",
                },
                labelBgStyle: {
                    fill: 'rgba(10, 14, 26, 0.9)',
                    stroke: 'rgba(99, 102, 241, 0.3)',
                    strokeWidth: 1,
                    rx: 4,
                },
                labelBgPadding: [4, 8] as [number, number],
                animated: true,
            }))
        );
    }

    // Allow nodes to be dragged / repositioned
    const onNodesChange = useCallback((changes: NodeChange[]) => {
        setNodes(nds => applyNodeChanges(changes, nds));
    }, []);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        setEdges(eds => applyEdgeChanges(changes, eds));
    }, []);

    // --- Drag & Drop file handlers ---
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDraggingOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['erd', 'json', 'erdschema'].includes(ext || '')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            try {
                const parsed = parseErdFile(text);
                if (parsed.entities.length > 0 && onSchemaChange) {
                    onSchemaChange(parsed);
                }
            } catch { /* invalid format */ }
        };
        reader.readAsText(file);
    }, [onSchemaChange]);

    // Empty state — shows dropzone
    if (schema.entities.length === 0) {
        return (
            <div
                className={`erd-container erd-dropzone ${isDraggingOver ? 'erd-drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '12px',
                    color: 'var(--text-muted)',
                    transition: 'all 0.25s ease',
                }}
            >
                <span style={{ fontSize: '2.5rem' }}>{isDraggingOver ? '📥' : '📊'}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    {isDraggingOver ? 'Drop your .erd file here' : 'Drag & drop an .erd file'}
                </span>
                <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>
                    or use the 📂 Upload button above
                </span>
            </div>
        );
    }

    return (
        <div
            className={`erd-container ${isDraggingOver ? 'erd-drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.1}
                maxZoom={3}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={true}
                nodesConnectable={false}
                snapToGrid={true}
                snapGrid={[16, 16]}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148,163,184,0.1)" />
                <Controls showInteractive={false} />
                <MiniMap
                    nodeColor="#6366f1"
                    nodeStrokeColor="#818cf8"
                    nodeStrokeWidth={2}
                    maskColor="rgba(0,0,0,0.35)"
                    pannable
                    zoomable
                />
            </ReactFlow>
        </div>
    );
};
