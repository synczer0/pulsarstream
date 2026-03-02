// Central type mapping registry: SQL ↔ Java ↔ Kotlin ↔ JSON

export type JavaVersion = '8' | '11' | '17' | '21' | '25';
export type KotlinVersion = '1.6' | '1.7' | '1.8' | '1.9' | '2.0' | '2.1';
export type SqlDialect = 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver' | 'oracle' | 'mariadb';

export interface TypeMapping {
  sqlType: string;
  javaType: string;
  javaImport?: string;
  kotlinType: string;
  kotlinImport?: string;
  jsonType: string;
  jsonDefault: unknown;
}

const baseMappings: TypeMapping[] = [
  // String types
  { sqlType: 'VARCHAR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'CHAR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'TEXT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'LONGTEXT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'MEDIUMTEXT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'TINYTEXT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'CLOB', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'NVARCHAR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'NCHAR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'NTEXT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'VARCHAR2', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'NVARCHAR2', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'CHARACTER VARYING', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },

  // Integer types
  { sqlType: 'INT', javaType: 'Integer', kotlinType: 'Int', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'INTEGER', javaType: 'Integer', kotlinType: 'Int', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'SMALLINT', javaType: 'Short', kotlinType: 'Short', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'TINYINT', javaType: 'Byte', kotlinType: 'Byte', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'MEDIUMINT', javaType: 'Integer', kotlinType: 'Int', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'BIGINT', javaType: 'Long', kotlinType: 'Long', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'SERIAL', javaType: 'Integer', kotlinType: 'Int', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'BIGSERIAL', javaType: 'Long', kotlinType: 'Long', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'SMALLSERIAL', javaType: 'Short', kotlinType: 'Short', jsonType: 'number', jsonDefault: 0 },
  { sqlType: 'NUMBER', javaType: 'Long', kotlinType: 'Long', jsonType: 'number', jsonDefault: 0 },

  // Floating point
  { sqlType: 'FLOAT', javaType: 'Float', kotlinType: 'Float', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'DOUBLE', javaType: 'Double', kotlinType: 'Double', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'DOUBLE PRECISION', javaType: 'Double', kotlinType: 'Double', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'REAL', javaType: 'Float', kotlinType: 'Float', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'DECIMAL', javaType: 'java.math.BigDecimal', javaImport: 'java.math.BigDecimal', kotlinType: 'java.math.BigDecimal', kotlinImport: 'java.math.BigDecimal', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'NUMERIC', javaType: 'java.math.BigDecimal', javaImport: 'java.math.BigDecimal', kotlinType: 'java.math.BigDecimal', kotlinImport: 'java.math.BigDecimal', jsonType: 'number', jsonDefault: 0.0 },
  { sqlType: 'MONEY', javaType: 'java.math.BigDecimal', javaImport: 'java.math.BigDecimal', kotlinType: 'java.math.BigDecimal', kotlinImport: 'java.math.BigDecimal', jsonType: 'number', jsonDefault: 0.0 },

  // Boolean
  { sqlType: 'BOOLEAN', javaType: 'Boolean', kotlinType: 'Boolean', jsonType: 'boolean', jsonDefault: false },
  { sqlType: 'BOOL', javaType: 'Boolean', kotlinType: 'Boolean', jsonType: 'boolean', jsonDefault: false },
  { sqlType: 'BIT', javaType: 'Boolean', kotlinType: 'Boolean', jsonType: 'boolean', jsonDefault: false },

  // Date/Time
  { sqlType: 'DATE', javaType: 'LocalDate', javaImport: 'java.time.LocalDate', kotlinType: 'java.time.LocalDate', kotlinImport: 'java.time.LocalDate', jsonType: 'string', jsonDefault: '2025-01-01' },
  { sqlType: 'TIME', javaType: 'LocalTime', javaImport: 'java.time.LocalTime', kotlinType: 'java.time.LocalTime', kotlinImport: 'java.time.LocalTime', jsonType: 'string', jsonDefault: '12:00:00' },
  { sqlType: 'DATETIME', javaType: 'LocalDateTime', javaImport: 'java.time.LocalDateTime', kotlinType: 'java.time.LocalDateTime', kotlinImport: 'java.time.LocalDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00' },
  { sqlType: 'TIMESTAMP', javaType: 'LocalDateTime', javaImport: 'java.time.LocalDateTime', kotlinType: 'java.time.LocalDateTime', kotlinImport: 'java.time.LocalDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00' },
  { sqlType: 'TIMESTAMPTZ', javaType: 'OffsetDateTime', javaImport: 'java.time.OffsetDateTime', kotlinType: 'java.time.OffsetDateTime', kotlinImport: 'java.time.OffsetDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00Z' },
  { sqlType: 'TIMESTAMP WITH TIME ZONE', javaType: 'OffsetDateTime', javaImport: 'java.time.OffsetDateTime', kotlinType: 'java.time.OffsetDateTime', kotlinImport: 'java.time.OffsetDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00Z' },
  { sqlType: 'DATETIME2', javaType: 'LocalDateTime', javaImport: 'java.time.LocalDateTime', kotlinType: 'java.time.LocalDateTime', kotlinImport: 'java.time.LocalDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00' },
  { sqlType: 'DATETIMEOFFSET', javaType: 'OffsetDateTime', javaImport: 'java.time.OffsetDateTime', kotlinType: 'java.time.OffsetDateTime', kotlinImport: 'java.time.OffsetDateTime', jsonType: 'string', jsonDefault: '2025-01-01T12:00:00Z' },
  { sqlType: 'YEAR', javaType: 'Integer', kotlinType: 'Int', jsonType: 'number', jsonDefault: 2025 },
  { sqlType: 'INTERVAL', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: 'P1D' },

  // Binary
  { sqlType: 'BLOB', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'BYTEA', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'BINARY', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'VARBINARY', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'IMAGE', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'LONGBLOB', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'RAW', javaType: 'byte[]', kotlinType: 'ByteArray', jsonType: 'string', jsonDefault: '' },

  // Special
  { sqlType: 'UUID', javaType: 'UUID', javaImport: 'java.util.UUID', kotlinType: 'java.util.UUID', kotlinImport: 'java.util.UUID', jsonType: 'string', jsonDefault: '00000000-0000-0000-0000-000000000000' },
  { sqlType: 'JSON', javaType: 'String', kotlinType: 'String', jsonType: 'object', jsonDefault: {} },
  { sqlType: 'JSONB', javaType: 'String', kotlinType: 'String', jsonType: 'object', jsonDefault: {} },
  { sqlType: 'XML', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'ENUM', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'SET', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'ARRAY', javaType: 'String[]', kotlinType: 'Array<String>', jsonType: 'array', jsonDefault: [] },
  { sqlType: 'INET', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '0.0.0.0' },
  { sqlType: 'CIDR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '0.0.0.0/0' },
  { sqlType: 'MACADDR', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '00:00:00:00:00:00' },
  { sqlType: 'POINT', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '(0,0)' },
  { sqlType: 'GEOMETRY', javaType: 'String', kotlinType: 'String', jsonType: 'string', jsonDefault: '' },
  { sqlType: 'UNIQUEIDENTIFIER', javaType: 'UUID', javaImport: 'java.util.UUID', kotlinType: 'java.util.UUID', kotlinImport: 'java.util.UUID', jsonType: 'string', jsonDefault: '00000000-0000-0000-0000-000000000000' },
];

// Normalize SQL type for lookup
function normalizeSqlType(raw: string): string {
  let t = raw.toUpperCase().trim();
  // Strip size/precision: VARCHAR(255) → VARCHAR
  t = t.replace(/\s*\([^)]*\)/, '');
  // Strip UNSIGNED
  t = t.replace(/\s+UNSIGNED/, '');
  // Handle aliases
  const aliases: Record<string, string> = {
    'INT4': 'INT', 'INT8': 'BIGINT', 'INT2': 'SMALLINT',
    'FLOAT4': 'REAL', 'FLOAT8': 'DOUBLE PRECISION',
    'BOOL': 'BOOLEAN', 'TIMESTAMPTZ': 'TIMESTAMP WITH TIME ZONE',
    'SERIAL4': 'SERIAL', 'SERIAL8': 'BIGSERIAL',
    'CHARACTER VARYING': 'VARCHAR', 'CHARACTER': 'CHAR',
  };
  return aliases[t] || t;
}

export function sqlToJavaType(sqlType: string, _javaVersion: JavaVersion = '21'): TypeMapping {
  const normalized = normalizeSqlType(sqlType);
  const found = baseMappings.find(m => m.sqlType === normalized);
  return found || { sqlType: normalized, javaType: 'Object', kotlinType: 'Any', jsonType: 'string', jsonDefault: null };
}

export function sqlToKotlinType(sqlType: string, _kotlinVersion: KotlinVersion = '2.1'): TypeMapping {
  return sqlToJavaType(sqlType);
}

export function javaTypeToJson(javaType: string): { jsonType: string; jsonDefault: unknown } {
  const map: Record<string, { jsonType: string; jsonDefault: unknown }> = {
    'String': { jsonType: 'string', jsonDefault: '' },
    'int': { jsonType: 'number', jsonDefault: 0 },
    'Integer': { jsonType: 'number', jsonDefault: 0 },
    'long': { jsonType: 'number', jsonDefault: 0 },
    'Long': { jsonType: 'number', jsonDefault: 0 },
    'short': { jsonType: 'number', jsonDefault: 0 },
    'Short': { jsonType: 'number', jsonDefault: 0 },
    'byte': { jsonType: 'number', jsonDefault: 0 },
    'Byte': { jsonType: 'number', jsonDefault: 0 },
    'float': { jsonType: 'number', jsonDefault: 0.0 },
    'Float': { jsonType: 'number', jsonDefault: 0.0 },
    'double': { jsonType: 'number', jsonDefault: 0.0 },
    'Double': { jsonType: 'number', jsonDefault: 0.0 },
    'boolean': { jsonType: 'boolean', jsonDefault: false },
    'Boolean': { jsonType: 'boolean', jsonDefault: false },
    'BigDecimal': { jsonType: 'number', jsonDefault: 0.0 },
    'LocalDate': { jsonType: 'string', jsonDefault: '2025-01-01' },
    'LocalTime': { jsonType: 'string', jsonDefault: '12:00:00' },
    'LocalDateTime': { jsonType: 'string', jsonDefault: '2025-01-01T12:00:00' },
    'OffsetDateTime': { jsonType: 'string', jsonDefault: '2025-01-01T12:00:00Z' },
    'UUID': { jsonType: 'string', jsonDefault: '00000000-0000-0000-0000-000000000000' },
    'byte[]': { jsonType: 'string', jsonDefault: '' },
  };
  // Handle List<X>, Set<X>
  if (/^(List|Set|Collection|ArrayList|HashSet)</.test(javaType)) {
    return { jsonType: 'array', jsonDefault: [] };
  }
  if (/^Map</.test(javaType)) {
    return { jsonType: 'object', jsonDefault: {} };
  }
  const simple = javaType.replace(/^java\.\w+\./, '');
  return map[simple] || { jsonType: 'object', jsonDefault: {} };
}

export function kotlinTypeToJson(kotlinType: string): { jsonType: string; jsonDefault: unknown } {
  const map: Record<string, { jsonType: string; jsonDefault: unknown }> = {
    'String': { jsonType: 'string', jsonDefault: '' },
    'Int': { jsonType: 'number', jsonDefault: 0 },
    'Long': { jsonType: 'number', jsonDefault: 0 },
    'Short': { jsonType: 'number', jsonDefault: 0 },
    'Byte': { jsonType: 'number', jsonDefault: 0 },
    'Float': { jsonType: 'number', jsonDefault: 0.0 },
    'Double': { jsonType: 'number', jsonDefault: 0.0 },
    'Boolean': { jsonType: 'boolean', jsonDefault: false },
    'ByteArray': { jsonType: 'string', jsonDefault: '' },
  };
  if (/^(List|Set|MutableList|MutableSet|Collection)</.test(kotlinType)) {
    return { jsonType: 'array', jsonDefault: [] };
  }
  if (/^(Map|MutableMap)</.test(kotlinType)) {
    return { jsonType: 'object', jsonDefault: {} };
  }
  const simple = kotlinType.replace(/\?$/, '').replace(/^java\.\w+\./, '');
  return map[simple] || { jsonType: 'object', jsonDefault: {} };
}

export function jsonTypeToJava(value: unknown): string {
  if (value === null || value === undefined) return 'Object';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return Math.abs(value) > 2147483647 ? 'long' : 'int';
    }
    return 'double';
  }
  if (Array.isArray(value)) return 'List<Object>';
  return 'Object';
}

export function jsonTypeToKotlin(value: unknown): string {
  if (value === null || value === undefined) return 'Any?';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return Math.abs(value) > 2147483647 ? 'Long' : 'Int';
    }
    return 'Double';
  }
  if (Array.isArray(value)) return 'List<Any>';
  return 'Any';
}

export function getJpaImportPrefix(javaVersion: JavaVersion): string {
  const ver = parseInt(javaVersion);
  return ver >= 17 ? 'jakarta.persistence' : 'javax.persistence';
}
