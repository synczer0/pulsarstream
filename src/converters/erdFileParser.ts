// Parser for XML-based ERD files (DBeaver, DataGrip, etc.)
import type { ErdSchema, ErdEntity, ErdField, ErdRelationship } from './erdSchema';
import { generateId } from './erdSchema';

/**
 * Parse an ERD file — auto-detects XML (DBeaver/DataGrip) or JSON format.
 */
export function parseErdFile(content: string): ErdSchema {
    const trimmed = content.trim();

    // Try XML format first (starts with < or <?xml)
    if (trimmed.startsWith('<')) {
        return parseXmlErd(trimmed);
    }

    // Try JSON format
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.entities && Array.isArray(parsed.entities)) {
                return parsed as ErdSchema;
            }
        } catch { /* not valid JSON */ }
    }

    return { entities: [], relationships: [] };
}

/**
 * Parse DBeaver/DataGrip XML ERD format.
 * Structure:
 *   <diagram>
 *     <entities>
 *       <data-source>
 *         <entity id="1" name="users" x="100" y="200">
 *       </data-source>
 *     </entities>
 *     <relations>
 *       <relation name="fk_name" pk-ref="1" fk-ref="2" type="fk"/>
 *     </relations>
 *   </diagram>
 */
function parseXmlErd(xml: string): ErdSchema {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        return { entities: [], relationships: [] };
    }

    // Parse entities
    const entityElements = doc.querySelectorAll('entity');
    const xmlIdToErdId = new Map<string, string>();
    const xmlIdToName = new Map<string, string>();

    const entities: ErdEntity[] = [];
    entityElements.forEach((el) => {
        const xmlId = el.getAttribute('id') || '';
        const name = el.getAttribute('name') || `Entity_${xmlId}`;
        const x = parseInt(el.getAttribute('x') || '0', 10);
        const y = parseInt(el.getAttribute('y') || '0', 10);

        const erdId = generateId();
        xmlIdToErdId.set(xmlId, erdId);
        xmlIdToName.set(xmlId, name);

        // Generate a default PK field (since XML ERD files from DBeaver
        // don't include column details — they reference the DB schema)
        const fields: ErdField[] = [
            {
                name: 'id',
                type: 'Long',
                isPrimaryKey: true,
                isForeignKey: false,
                isNullable: false,
                isUnique: true,
            },
        ];

        entities.push({
            id: erdId,
            name,
            fields,
            position: { x: Math.round(x * 0.8), y: Math.round(y * 0.8) },
        });
    });

    // Parse relations
    const relationElements = doc.querySelectorAll('relation');
    const relationships: ErdRelationship[] = [];

    relationElements.forEach((el) => {
        const pkRef = el.getAttribute('pk-ref') || '';
        const fkRef = el.getAttribute('fk-ref') || '';
        const relName = el.getAttribute('name') || '';

        const fromErdId = xmlIdToErdId.get(pkRef);
        const toErdId = xmlIdToErdId.get(fkRef);

        if (!fromErdId || !toErdId) return;

        // Skip self-referencing for display clarity (can still be shown if desired)
        // Determine relationship type from FK naming convention
        const relType = 'ONE_TO_MANY' as const; // FK relations are typically 1:N

        // Add FK field to the referencing entity
        const toEntity = entities.find(e => e.id === toErdId);
        const fromName = xmlIdToName.get(pkRef) || 'unknown';
        if (toEntity) {
            const fkFieldName = `${fromName.toLowerCase()}_id`;
            const hasField = toEntity.fields.some(f => f.name === fkFieldName);
            if (!hasField) {
                toEntity.fields.push({
                    name: fkFieldName,
                    type: 'Long',
                    isPrimaryKey: false,
                    isForeignKey: true,
                    isNullable: true,
                    isUnique: false,
                    referencesTable: fromName,
                    referencesColumn: 'id',
                });
            }
        }

        relationships.push({
            id: generateId(),
            type: relType,
            fromEntityId: fromErdId,
            fromField: 'id',
            toEntityId: toErdId,
            toField: relName,
            label: relName,
        });
    });

    return { entities, relationships };
}
