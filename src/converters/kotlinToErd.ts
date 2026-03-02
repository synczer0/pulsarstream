// Kotlin Entity → ERD converter
import type { ErdSchema, ErdEntity, ErdField, ErdRelationship, RelationshipType } from './erdSchema';
import { generateId, autoLayoutEntities } from './erdSchema';

export function kotlinToErd(kotlinStr: string): ErdSchema {
    const classes = parseKotlinEntities(kotlinStr);
    if (classes.length === 0) return { entities: [], relationships: [] };

    const entities: ErdEntity[] = classes.map(cls => ({
        id: generateId(),
        name: cls.name,
        fields: cls.fields,
        position: { x: 0, y: 0 },
    }));

    const relationships: ErdRelationship[] = [];
    for (const cls of classes) {
        for (const rel of cls.relationships) {
            const fromEntity = entities.find(e => e.name === cls.name);
            const toEntity = entities.find(e => e.name === rel.targetEntity);
            if (fromEntity && toEntity) {
                relationships.push({
                    id: generateId(),
                    type: rel.type,
                    fromEntityId: fromEntity.id,
                    fromField: rel.fieldName,
                    toEntityId: toEntity.id,
                    toField: rel.mappedBy || '',
                });
            }
        }
    }

    return autoLayoutEntities({ entities, relationships });
}

interface ParsedRelationship {
    type: RelationshipType;
    targetEntity: string;
    fieldName: string;
    mappedBy?: string;
}

interface ParsedEntity {
    name: string;
    fields: ErdField[];
    relationships: ParsedRelationship[];
}

function parseKotlinEntities(code: string): ParsedEntity[] {
    const results: ParsedEntity[] = [];
    const classRegex = /(?:@Entity[\s\S]*?)?(?:data\s+)?class\s+(\w+)\s*\(([\s\S]*?)\)/g;
    let m: RegExpExecArray | null;

    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const params = m[2];
        const { fields, relationships } = parseParams(params);
        results.push({ name, fields, relationships });
    }

    return results;
}

function parseParams(block: string): { fields: ErdField[]; relationships: ParsedRelationship[] } {
    const fields: ErdField[] = [];
    const relationships: ParsedRelationship[] = [];
    const lines = block.split('\n');

    let isPK = false;
    let isUnique = false;
    let columnName: string | undefined;
    let nullable = true;
    let relAnnotation: { type: RelationshipType; mappedBy?: string } | null = null;

    for (const line of lines) {
        const t = line.trim().replace(/,$/, '');

        if (t.includes('@Id')) { isPK = true; continue; }
        if (t.includes('@Column')) {
            const nameM = t.match(/name\s*=\s*"([^"]+)"/);
            if (nameM) columnName = nameM[1];
            if (t.includes('nullable = false')) nullable = false;
            if (t.includes('unique = true')) isUnique = true;
            continue;
        }

        const relMatch = t.match(/@(OneToOne|OneToMany|ManyToOne|ManyToMany)/);
        if (relMatch) {
            const typeMap: Record<string, RelationshipType> = {
                'OneToOne': 'ONE_TO_ONE', 'OneToMany': 'ONE_TO_MANY',
                'ManyToOne': 'MANY_TO_ONE', 'ManyToMany': 'MANY_TO_MANY',
            };
            const mappedByM = t.match(/mappedBy\s*=\s*"([^"]+)"/);
            relAnnotation = { type: typeMap[relMatch[1]], mappedBy: mappedByM?.[1] };
            continue;
        }

        // val/var name: Type
        const cleaned = t.replace(/@\w+\s*(?:\([^)]*\)\s*)*/g, '').trim();
        const fieldMatch = cleaned.match(/^(?:val|var)\s+(\w+)\s*:\s*([\w<>?,.\s\[\]]+?)(?:\s*=\s*.*)?$/);
        if (fieldMatch) {
            const fname = fieldMatch[1];
            const type = fieldMatch[2].trim().replace(/\?$/, '');

            if (relAnnotation) {
                const genericMatch = type.match(/(?:List|Set|MutableList|MutableSet|Collection)<\s*(\w+)\s*>/);
                const targetEntity = genericMatch ? genericMatch[1] : type;
                relationships.push({
                    type: relAnnotation.type,
                    targetEntity,
                    fieldName: fname,
                    mappedBy: relAnnotation.mappedBy,
                });
                relAnnotation = null;
            } else {
                fields.push({
                    name: columnName || fname,
                    type: simplifyKotlinType(type),
                    isPrimaryKey: isPK,
                    isForeignKey: false,
                    isNullable: nullable || fieldMatch[2].trim().endsWith('?'),
                    isUnique: isUnique,
                });
            }
            isPK = false; isUnique = false; nullable = true; columnName = undefined;
        } else if (!t.startsWith('@') && !t.startsWith('//') && t.length > 0) {
            isPK = false; isUnique = false; nullable = true; columnName = undefined; relAnnotation = null;
        }
    }

    return { fields, relationships };
}

function simplifyKotlinType(type: string): string {
    const map: Record<string, string> = {
        'String': 'String', 'Int': 'int', 'Long': 'long',
        'Boolean': 'boolean', 'Double': 'double', 'Float': 'float',
        'java.time.LocalDate': 'date', 'java.time.LocalDateTime': 'datetime',
        'java.time.OffsetDateTime': 'datetime', 'java.util.UUID': 'uuid',
        'java.math.BigDecimal': 'decimal',
    };
    return map[type] || type;
}
