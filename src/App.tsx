import { useState, useCallback } from 'react';
import './index.css';
import { CodeEditor } from './components/CodeEditor';
import { ErdCanvas } from './components/ErdCanvas';

// Original converters
import { jsonToJava, type JsonToJavaOptions } from './converters/jsonToJava';
import { jsonToKotlin, type JsonToKotlinOptions } from './converters/jsonToKotlin';
import { sqlToJava, type SqlToJavaOptions } from './converters/sqlToJava';
import { sqlToKotlin, type SqlToKotlinOptions } from './converters/sqlToKotlin';
import { javaToJson } from './converters/javaToJson';
import { kotlinToJson } from './converters/kotlinToJson';
import { erdToJava, type ErdToJavaOptions } from './converters/erdToJava';
import { erdToKotlin, type ErdToKotlinOptions } from './converters/erdToKotlin';
import { javaToErd } from './converters/javaToErd';
import { kotlinToErd } from './converters/kotlinToErd';
import { createEmptySchema, erdToJson, type ErdSchema } from './converters/erdSchema';
import { parseErdFile } from './converters/erdFileParser';

// Proto converters
import { parseProto, type ProtoVersion } from './converters/protoParser';
import { protoToJava } from './converters/protoToJava';
import { protoToKotlin } from './converters/protoToKotlin';
import { javaToProto } from './converters/javaToProto';
import { kotlinToProto } from './converters/kotlinToProto';

// GraphQL converters
import { parseGraphQL } from './converters/graphqlParser';
import { graphqlToJava } from './converters/graphqlToJava';
import { graphqlToKotlin } from './converters/graphqlToKotlin';
import { javaToGraphQL } from './converters/javaToGraphQL';
import { kotlinToGraphQL } from './converters/kotlinToGraphQL';

import type { JavaVersion, KotlinVersion } from './converters/typeMapper';

type ConversionMode =
  | 'json-to-java' | 'json-to-kotlin'
  | 'sql-to-java' | 'sql-to-kotlin'
  | 'java-to-json' | 'kotlin-to-json'
  | 'erd-to-java' | 'erd-to-kotlin'
  | 'java-to-erd' | 'kotlin-to-erd'
  | 'proto-to-java' | 'proto-to-kotlin'
  | 'java-to-proto' | 'kotlin-to-proto'
  | 'graphql-to-java' | 'graphql-to-kotlin'
  | 'java-to-graphql' | 'kotlin-to-graphql';

type EditorLang = 'json' | 'java' | 'kotlin' | 'sql';

interface ModeConfig {
  label: string;
  from: string;
  to: string;
  fromLang: EditorLang;
  toLang: EditorLang;
  category: 'json' | 'sql' | 'erd' | 'proto' | 'graphql';
  isErdInput?: boolean;
  isErdOutput?: boolean;
}

const MODES: Record<ConversionMode, ModeConfig> = {
  'json-to-java': { label: 'JSON → Java', from: 'JSON', to: 'Java', fromLang: 'json', toLang: 'java', category: 'json' },
  'json-to-kotlin': { label: 'JSON → Kotlin', from: 'JSON', to: 'Kotlin', fromLang: 'json', toLang: 'kotlin', category: 'json' },
  'sql-to-java': { label: 'SQL → Java', from: 'SQL DDL', to: 'Java', fromLang: 'sql', toLang: 'java', category: 'sql' },
  'sql-to-kotlin': { label: 'SQL → Kotlin', from: 'SQL DDL', to: 'Kotlin', fromLang: 'sql', toLang: 'kotlin', category: 'sql' },
  'java-to-json': { label: 'Java → JSON', from: 'Java', to: 'JSON', fromLang: 'java', toLang: 'json', category: 'json' },
  'kotlin-to-json': { label: 'Kotlin → JSON', from: 'Kotlin', to: 'JSON', fromLang: 'kotlin', toLang: 'json', category: 'json' },
  'erd-to-java': { label: 'ERD → Java', from: 'ERD Diagram', to: 'Java', fromLang: 'json', toLang: 'java', category: 'erd', isErdInput: true },
  'erd-to-kotlin': { label: 'ERD → Kotlin', from: 'ERD Diagram', to: 'Kotlin', fromLang: 'json', toLang: 'kotlin', category: 'erd', isErdInput: true },
  'java-to-erd': { label: 'Java → ERD', from: 'Java', to: 'ERD Diagram', fromLang: 'java', toLang: 'json', category: 'erd', isErdOutput: true },
  'kotlin-to-erd': { label: 'Kotlin → ERD', from: 'Kotlin', to: 'ERD Diagram', fromLang: 'kotlin', toLang: 'json', category: 'erd', isErdOutput: true },
  'proto-to-java': { label: 'Proto → Java', from: 'Proto', to: 'Java', fromLang: 'java', toLang: 'java', category: 'proto' },
  'proto-to-kotlin': { label: 'Proto → Kotlin', from: 'Proto', to: 'Kotlin', fromLang: 'java', toLang: 'kotlin', category: 'proto' },
  'java-to-proto': { label: 'Java → Proto', from: 'Java', to: 'Proto', fromLang: 'java', toLang: 'java', category: 'proto' },
  'kotlin-to-proto': { label: 'Kotlin → Proto', from: 'Kotlin', to: 'Proto', fromLang: 'kotlin', toLang: 'java', category: 'proto' },
  'graphql-to-java': { label: 'GraphQL → Java', from: 'GraphQL', to: 'Java', fromLang: 'java', toLang: 'java', category: 'graphql' },
  'graphql-to-kotlin': { label: 'GraphQL → Kotlin', from: 'GraphQL', to: 'Kotlin', fromLang: 'java', toLang: 'kotlin', category: 'graphql' },
  'java-to-graphql': { label: 'Java → GraphQL', from: 'Java', to: 'GraphQL', fromLang: 'java', toLang: 'java', category: 'graphql' },
  'kotlin-to-graphql': { label: 'Kotlin → GraphQL', from: 'Kotlin', to: 'GraphQL', fromLang: 'kotlin', toLang: 'java', category: 'graphql' },
};

const SAMPLE_JSON = `{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "is_active": true,
  "age": 30,
  "created_at": "2025-01-15T10:30:00",
  "tags": ["developer", "admin"],
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "zip_code": "12345"
  }
}`;

const SAMPLE_SQL = `CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    role_id INT,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);`;

const SAMPLE_PROTO = `syntax = "proto3";

package com.example.api;

message User {
  int64 id = 1;
  string first_name = 2;
  string last_name = 3;
  string email = 4;
  bool is_active = 5;
  repeated string tags = 6;
  Address address = 7;
  UserRole role = 8;

  enum UserRole {
    UNKNOWN = 0;
    ADMIN = 1;
    USER = 2;
    MODERATOR = 3;
  }
}

message Address {
  string street = 1;
  string city = 2;
  string zip_code = 3;
  string country = 4;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc CreateUser(User) returns (User);
}

message GetUserRequest {
  int64 id = 1;
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
}`;

const SAMPLE_GRAPHQL = `type User {
  id: ID!
  firstName: String!
  lastName: String!
  email: String!
  isActive: Boolean!
  age: Int
  tags: [String!]!
  address: Address
  posts: [Post!]!
}

type Address {
  street: String!
  city: String!
  zipCode: String!
  country: String
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: String!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  body: String!
  author: User!
}

enum UserRole {
  ADMIN
  USER
  MODERATOR
}

type Query {
  getUser(id: ID!): User
  allUsers(page: Int, pageSize: Int): [User!]!
  getPost(id: ID!): Post
}

type Mutation {
  createUser(input: UserInput!): User!
  updateUser(id: ID!, input: UserInput!): User
  deleteUser(id: ID!): Boolean!
}

type Subscription {
  onUserCreated: User!
}

input UserInput {
  firstName: String!
  lastName: String!
  email: String!
}`;

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mode, setMode] = useState<ConversionMode>('json-to-java');
  const [input, setInput] = useState(SAMPLE_JSON);
  const [output, setOutput] = useState('');
  const [erdSchema, setErdSchema] = useState<ErdSchema>(createEmptySchema());
  const [toast, setToast] = useState<string | null>(null);

  // Common options
  const [javaVersion, setJavaVersion] = useState<JavaVersion>('21');
  const [kotlinVersion, setKotlinVersion] = useState<KotlinVersion>('2.1');
  const [className, setClassName] = useState('MyEntity');
  const [packageName, setPackageName] = useState('');
  const [useLombok, setUseLombok] = useState(true);
  const [useJackson, setUseJackson] = useState(true);
  const [useRecords, setUseRecords] = useState(false);
  const [useKotlinxSerialization, setUseKotlinxSerialization] = useState(true);

  // Proto options
  const [protoVersion, setProtoVersion] = useState<ProtoVersion>('proto3');
  const [useGrpcStubs, setUseGrpcStubs] = useState(true);

  // GraphQL options
  const [useSpringGraphQL, setUseSpringGraphQL] = useState(true);
  const [generateQueries, setGenerateQueries] = useState(true);
  const [generateMutations, setGenerateMutations] = useState(true);

  const modeConfig = MODES[mode];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleModeChange = useCallback((newMode: ConversionMode) => {
    setMode(newMode);
    setOutput('');
    setErdSchema(createEmptySchema());

    if (newMode.startsWith('json-')) setInput(SAMPLE_JSON);
    else if (newMode.startsWith('sql-')) setInput(SAMPLE_SQL);
    else if (newMode.startsWith('proto-to-')) setInput(SAMPLE_PROTO);
    else if (newMode.startsWith('graphql-to-')) setInput(SAMPLE_GRAPHQL);
    else if (newMode.startsWith('erd-')) setInput('');
    else setInput('');
  }, []);

  const handleConvert = useCallback(() => {
    try {
      let result = '';
      const javaOpts: Partial<JsonToJavaOptions & SqlToJavaOptions & ErdToJavaOptions> = {
        className, packageName, javaVersion, useLombok, useJackson, useRecords,
        generateGettersSetters: !useLombok,
      };
      const kotlinOpts: Partial<JsonToKotlinOptions & SqlToKotlinOptions & ErdToKotlinOptions> = {
        className, packageName, kotlinVersion, useKotlinxSerialization, javaVersion,
      };

      switch (mode) {
        case 'json-to-java':
          result = jsonToJava(input, javaOpts);
          break;
        case 'json-to-kotlin':
          result = jsonToKotlin(input, kotlinOpts);
          break;
        case 'sql-to-java':
          result = sqlToJava(input, javaOpts);
          break;
        case 'sql-to-kotlin':
          result = sqlToKotlin(input, kotlinOpts);
          break;
        case 'java-to-json':
          result = javaToJson(input);
          break;
        case 'kotlin-to-json':
          result = kotlinToJson(input);
          break;
        case 'erd-to-java':
          result = erdToJava(erdSchema, javaOpts);
          break;
        case 'erd-to-kotlin':
          result = erdToKotlin(erdSchema, kotlinOpts);
          break;
        case 'java-to-erd': {
          const schema = javaToErd(input);
          setErdSchema(schema);
          result = `// Generated ERD with ${schema.entities.length} entities and ${schema.relationships.length} relationships`;
          break;
        }
        case 'kotlin-to-erd': {
          const schema = kotlinToErd(input);
          setErdSchema(schema);
          result = `// Generated ERD with ${schema.entities.length} entities and ${schema.relationships.length} relationships`;
          break;
        }
        // --- Proto ---
        case 'proto-to-java': {
          const proto = parseProto(input);
          result = protoToJava(proto, {
            javaVersion, packageName: packageName || proto.package || 'com.example',
            useGrpcStubs, useLombok, useJakarta: parseInt(javaVersion) >= 17,
          });
          break;
        }
        case 'proto-to-kotlin': {
          const proto = parseProto(input);
          result = protoToKotlin(proto, {
            kotlinVersion, packageName: packageName || proto.package || 'com.example',
            useGrpcStubs, useKotlinxSerialization,
          });
          break;
        }
        case 'java-to-proto':
          result = javaToProto(input, { protoVersion, packageName: packageName || 'com.example' });
          break;
        case 'kotlin-to-proto':
          result = kotlinToProto(input, { protoVersion, packageName: packageName || 'com.example' });
          break;
        // --- GraphQL ---
        case 'graphql-to-java': {
          const gql = parseGraphQL(input);
          result = graphqlToJava(gql, {
            javaVersion, packageName: packageName || 'com.example',
            useSpringGraphQL, useLombok,
          });
          break;
        }
        case 'graphql-to-kotlin': {
          const gql = parseGraphQL(input);
          result = graphqlToKotlin(gql, {
            kotlinVersion, packageName: packageName || 'com.example',
            useSpringGraphQL, useKotlinxSerialization,
          });
          break;
        }
        case 'java-to-graphql':
          result = javaToGraphQL(input, { generateQueries, generateMutations });
          break;
        case 'kotlin-to-graphql':
          result = kotlinToGraphQL(input, { generateQueries, generateMutations });
          break;
      }
      setOutput(result);
      showToast('✓ Converted successfully!');
    } catch (err: unknown) {
      setOutput(`// Error: ${err instanceof Error ? err.message : 'Conversion failed'}`);
    }
  }, [mode, input, erdSchema, className, packageName, javaVersion, kotlinVersion,
    useLombok, useJackson, useRecords, useKotlinxSerialization,
    protoVersion, useGrpcStubs, useSpringGraphQL, generateQueries, generateMutations, showToast]);

  const copyOutput = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => showToast('✓ Copied to clipboard!'));
  }, [output, showToast]);

  const downloadOutput = useCallback(() => {
    const ext = modeConfig.toLang === 'java' ? 'java' : modeConfig.toLang === 'kotlin' ? 'kt' : modeConfig.toLang === 'sql' ? 'sql' : 'json';
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${className || 'output'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded!');
  }, [output, modeConfig, className, showToast]);

  const clearInput = useCallback(() => {
    setInput('');
    setOutput('');
    setErdSchema(createEmptySchema());
  }, []);

  // ERD file upload handler
  const handleErdFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const schema = parseErdFile(text);
        if (schema.entities.length > 0) {
          setErdSchema(schema);
          showToast(`✓ Loaded ${schema.entities.length} entities from ${file.name}`);
        } else {
          showToast('⚠ No entities found in file');
        }
      } catch {
        showToast('⚠ Invalid ERD file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showToast]);

  const handleErdExport = useCallback(() => {
    const json = erdToJson(erdSchema);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${className || 'diagram'}.erd`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ ERD exported!');
  }, [erdSchema, className, showToast]);

  const isTargetJava = mode.endsWith('-java') || mode.endsWith('-proto') || mode.endsWith('-graphql');
  const isTargetKotlin = mode.endsWith('-kotlin');
  const isProtoMode = modeConfig.category === 'proto';
  const isGraphQLMode = modeConfig.category === 'graphql';

  return (
    <div className="app-container" data-theme={theme}>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <span className="logo-icon">⚡</span>
          <h1>PulsarStream</h1>
        </div>
        <div className="header-badges">
          <span className="badge badge-json">JSON</span>
          <span className="badge badge-sql">SQL</span>
          <span className="badge badge-erd">ERD</span>
          <span className="badge badge-proto">gRPC</span>
          <span className="badge badge-graphql">GraphQL</span>
          <span className="badge badge-java">Java 8–25</span>
          <span className="badge badge-kotlin">Kotlin 1.6–2.1</span>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Mode Selector */}
        <div className="mode-selector-container">
          <label htmlFor="conversion-mode" className="mode-label">Conversion Mode</label>
          <div className="select-wrapper">
            <select
              id="conversion-mode"
              className="mode-select"
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as ConversionMode)}
              aria-label="Select Conversion Mode"
            >
              {[
                { id: 'json', title: 'JSON' },
                { id: 'sql', title: 'SQL DDL' },
                { id: 'erd', title: 'ERD' },
                { id: 'proto', title: 'Protobuf' },
                { id: 'graphql', title: 'GraphQL' }
              ].map(category => (
                <optgroup
                  key={category.id}
                  label={`${category.title} Conversions`}
                >
                  {(Object.entries(MODES) as [ConversionMode, ModeConfig][])
                    .filter(([_, config]) => config.category === category.id)
                    .map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Options Panel */}
        <div className="glass-card options-panel">
          <div className="option-group">
            <label>Class Name</label>
            <input type="text" value={className} onChange={e => setClassName(e.target.value)} />
          </div>
          <div className="option-group">
            <label>Package Name</label>
            <input type="text" value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="com.example.model" />
          </div>

          {(isTargetJava || (!isTargetKotlin && !isProtoMode && !isGraphQLMode)) && (
            <div className="option-group">
              <label>Java Version</label>
              <select value={javaVersion} onChange={e => setJavaVersion(e.target.value as JavaVersion)}>
                <option value="8">Java 8</option>
                <option value="11">Java 11</option>
                <option value="17">Java 17</option>
                <option value="21">Java 21 (LTS)</option>
                <option value="25">Java 25</option>
              </select>
            </div>
          )}

          {isTargetKotlin && (
            <div className="option-group">
              <label>Kotlin Version</label>
              <select value={kotlinVersion} onChange={e => setKotlinVersion(e.target.value as KotlinVersion)}>
                <option value="1.6">Kotlin 1.6</option>
                <option value="1.7">Kotlin 1.7</option>
                <option value="1.8">Kotlin 1.8</option>
                <option value="1.9">Kotlin 1.9</option>
                <option value="2.0">Kotlin 2.0</option>
                <option value="2.1">Kotlin 2.1</option>
              </select>
            </div>
          )}

          {/* Proto options */}
          {isProtoMode && (
            <>
              <div className="option-group">
                <label>Proto Syntax</label>
                <select value={protoVersion} onChange={e => setProtoVersion(e.target.value as ProtoVersion)}>
                  <option value="proto3">proto3 (modern)</option>
                  <option value="proto2">proto2</option>
                </select>
              </div>
              <div className="option-group">
                <label className="option-toggle">
                  <input type="checkbox" checked={useGrpcStubs} onChange={e => setUseGrpcStubs(e.target.checked)} />
                  <span>gRPC Service Stubs</span>
                </label>
              </div>
            </>
          )}

          {/* GraphQL options */}
          {isGraphQLMode && (
            <>
              {(mode === 'graphql-to-java' || mode === 'graphql-to-kotlin') && (
                <div className="option-group">
                  <label className="option-toggle">
                    <input type="checkbox" checked={useSpringGraphQL} onChange={e => setUseSpringGraphQL(e.target.checked)} />
                    <span>Spring GraphQL Controllers</span>
                  </label>
                </div>
              )}
              {(mode === 'java-to-graphql' || mode === 'kotlin-to-graphql') && (
                <>
                  <div className="option-group">
                    <label className="option-toggle">
                      <input type="checkbox" checked={generateQueries} onChange={e => setGenerateQueries(e.target.checked)} />
                      <span>Generate Queries</span>
                    </label>
                  </div>
                  <div className="option-group">
                    <label className="option-toggle">
                      <input type="checkbox" checked={generateMutations} onChange={e => setGenerateMutations(e.target.checked)} />
                      <span>Generate Mutations</span>
                    </label>
                  </div>
                </>
              )}
            </>
          )}

          {/* Java-target options */}
          {isTargetJava && !isGraphQLMode && (
            <>
              <div className="option-group">
                <label className="option-toggle">
                  <input type="checkbox" checked={useLombok} onChange={e => setUseLombok(e.target.checked)} />
                  <span>Lombok @Data</span>
                </label>
              </div>
              {!isProtoMode && (
                <div className="option-group">
                  <label className="option-toggle">
                    <input type="checkbox" checked={useJackson} onChange={e => setUseJackson(e.target.checked)} />
                    <span>Jackson Annotations</span>
                  </label>
                </div>
              )}
              {parseInt(javaVersion) >= 16 && (
                <div className="option-group">
                  <label className="option-toggle">
                    <input type="checkbox" checked={useRecords} onChange={e => setUseRecords(e.target.checked)} />
                    <span>Use Records</span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* GraphQL Java options */}
          {isTargetJava && isGraphQLMode && (
            <div className="option-group">
              <label className="option-toggle">
                <input type="checkbox" checked={useLombok} onChange={e => setUseLombok(e.target.checked)} />
                <span>Lombok @Data</span>
              </label>
            </div>
          )}

          {/* Kotlin-target options */}
          {isTargetKotlin && (
            <div className="option-group">
              <label className="option-toggle">
                <input type="checkbox" checked={useKotlinxSerialization} onChange={e => setUseKotlinxSerialization(e.target.checked)} />
                <span>kotlinx.serialization</span>
              </label>
            </div>
          )}
        </div>

        {/* Conversion Panel */}
        <div className="conversion-panel">
          {/* Input Pane */}
          <div className="editor-pane">
            <div className="editor-header">
              <h3>📥 {modeConfig.from} Input</h3>
              <div className="editor-actions">
                {modeConfig.isErdInput && (
                  <>
                    <label className="btn btn-sm" style={{ cursor: 'pointer' }} title="Upload .erd or .json file">
                      📂 Upload
                      <input
                        type="file"
                        accept=".erd,.json,.erdschema"
                        onChange={handleErdFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button className="btn btn-sm" onClick={handleErdExport} disabled={erdSchema.entities.length === 0} title="Export ERD">💾 Save</button>
                  </>
                )}
                <button className="btn btn-sm" onClick={clearInput} title="Clear">🗑️ Clear</button>
              </div>
            </div>
            <div className="editor-body">
              {modeConfig.isErdInput ? (
                <ErdCanvas schema={erdSchema} onSchemaChange={setErdSchema} />
              ) : (
                <CodeEditor
                  value={input}
                  onChange={setInput}
                  language={modeConfig.fromLang}
                  placeholder={`Paste your ${modeConfig.from} here...`}
                  appTheme={theme}
                />
              )}
            </div>
          </div>

          {/* Output Pane */}
          <div className="editor-pane">
            <div className="editor-header">
              <h3>📤 {modeConfig.to} Output</h3>
              <div className="editor-actions">
                {modeConfig.isErdOutput && erdSchema.entities.length > 0 && (
                  <button className="btn btn-sm" onClick={handleErdExport} title="Export ERD">💾 Save ERD</button>
                )}
                <button className="btn btn-sm" onClick={copyOutput} disabled={!output} title="Copy">📋 Copy</button>
                <button className="btn btn-sm" onClick={downloadOutput} disabled={!output} title="Download">⬇️ Download</button>
              </div>
            </div>
            <div className="editor-body">
              {modeConfig.isErdOutput ? (
                <ErdCanvas schema={erdSchema} />
              ) : (
                <CodeEditor
                  value={output}
                  language={modeConfig.toLang}
                  readOnly
                  placeholder="Converted output will appear here..."
                  appTheme={theme}
                />
              )}
            </div>
          </div>
        </div>

        {/* Convert Button */}
        <div className="convert-action">
          <button className="btn-convert" onClick={handleConvert}>
            ⚡ Convert {modeConfig.from} → {modeConfig.to}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>PulsarStream Converter v1.0 • All conversions run locally in your browser</span>
        <span>Java 8–25 • Kotlin 1.6–2.1 • MySQL • PostgreSQL • SQLite • gRPC proto2/3 • GraphQL</span>
      </footer>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
