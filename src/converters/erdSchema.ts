// ERD Schema — shared data model for Entity-Relationship Diagrams

export type RelationshipType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

export interface ErdField {
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
    isUnique: boolean;
    defaultValue?: string;
    referencesTable?: string;
    referencesColumn?: string;
}

export interface ErdEntity {
    [key: string]: unknown; // index signature for React Flow Node compatibility
    id: string;
    name: string;
    fields: ErdField[];
    position: { x: number; y: number };
}

export interface ErdRelationship {
    id: string;
    type: RelationshipType;
    fromEntityId: string;
    fromField: string;
    toEntityId: string;
    toField: string;
    label?: string;
}

export interface ErdSchema {
    entities: ErdEntity[];
    relationships: ErdRelationship[];
}

// Generate unique IDs
let nextId = 1;
export function generateId(): string {
    return `erd_${Date.now()}_${nextId++}`;
}

export function createEmptySchema(): ErdSchema {
    return { entities: [], relationships: [] };
}

export function erdToJson(schema: ErdSchema): string {
    return JSON.stringify(schema, null, 2);
}

export function jsonToErd(jsonStr: string): ErdSchema {
    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.entities && parsed.relationships) {
            return parsed as ErdSchema;
        }
    } catch { /* ignore */ }
    return createEmptySchema();
}

// Auto-layout entities in a grid pattern
export function autoLayoutEntities(schema: ErdSchema): ErdSchema {
    const cols = Math.ceil(Math.sqrt(schema.entities.length));
    const spacingX = 350;
    const spacingY = 300;

    const updated = schema.entities.map((entity, i) => ({
        ...entity,
        position: {
            x: (i % cols) * spacingX + 50,
            y: Math.floor(i / cols) * spacingY + 50,
        },
    }));

    return { ...schema, entities: updated };
}
