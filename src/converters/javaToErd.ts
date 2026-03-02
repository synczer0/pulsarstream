// Java Entity → ERD converter
import type { ErdSchema, ErdEntity, ErdField, ErdRelationship, RelationshipType } from './erdSchema';
import { generateId, autoLayoutEntities } from './erdSchema';

export function javaToErd(javaStr: string): ErdSchema {
    const classes = parseJavaEntities(javaStr);
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

function parseJavaEntities(code: string): ParsedEntity[] {
    const results: ParsedEntity[] = [];
    const classRegex = /(?:@Entity[\s\S]*?)?(?:public\s+)?class\s+(\w+)\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w\s,]+\s*)?\{/g;
    let m: RegExpExecArray | null;

    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const startIdx = m.index + m[0].length;
        const body = extractBody(code, startIdx);
        const { fields, relationships } = parseEntityBody(body);
        results.push({ name, fields, relationships });
    }

    return results;
}

function extractBody(code: string, startIdx: number): string {
    let depth = 1;
    let i = startIdx;
    while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        i++;
    }
    return code.substring(startIdx, i - 1);
}

function parseEntityBody(body: string): { fields: ErdField[]; relationships: ParsedRelationship[] } {
    const fields: ErdField[] = [];
    const relationships: ParsedRelationship[] = [];
    const lines = body.split('\n');

    let isPK = false;
    let isUnique = false;
    let columnName: string | undefined;
    let nullable = true;
    let relAnnotation: { type: RelationshipType; mappedBy?: string } | null = null;

    for (const line of lines) {
        const t = line.trim();

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

        // Field declaration
        const fieldMatch = t.match(/^(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?([\w<>\[\]?,\s]+?)\s+(\w+)\s*[;=]/);
        if (fieldMatch) {
            const type = fieldMatch[1].trim();
            const fname = fieldMatch[2];
            if (['void', 'class'].includes(type)) continue;

            if (relAnnotation) {
                // Extract target entity from type
                const genericMatch = type.match(/(?:List|Set|Collection)<\s*(\w+)\s*>/);
                const targetEntity = genericMatch ? genericMatch[1] : type;
                relationships.push({
                    type: relAnnotation.type,
                    targetEntity,
                    fieldName: fname,
                    mappedBy: relAnnotation.mappedBy,
                });
                relAnnotation = null;
                isPK = false; isUnique = false; nullable = true; columnName = undefined;
            } else {
                fields.push({
                    name: columnName || fname,
                    type: simplifyJavaType(type),
                    isPrimaryKey: isPK,
                    isForeignKey: false,
                    isNullable: nullable,
                    isUnique: isUnique,
                });
                isPK = false; isUnique = false; nullable = true; columnName = undefined;
            }
        } else if (!t.startsWith('@') && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*') && t.length > 0) {
            isPK = false; isUnique = false; nullable = true; columnName = undefined; relAnnotation = null;
        }
    }

    return { fields, relationships };
}

function simplifyJavaType(type: string): string {
    const map: Record<string, string> = {
        'String': 'String', 'Integer': 'int', 'int': 'int',
        'Long': 'long', 'long': 'long',
        'Boolean': 'boolean', 'boolean': 'boolean',
        'Double': 'double', 'double': 'double',
        'Float': 'float', 'float': 'float',
        'LocalDate': 'date', 'LocalDateTime': 'datetime',
        'OffsetDateTime': 'datetime', 'UUID': 'uuid',
        'BigDecimal': 'decimal',
    };
    return map[type] || type;
}
