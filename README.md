# AXI Semantic Compiler (ASC)

[![CI](https://github.com/toon-format/toon/actions/workflows/ci.yml/badge.svg)](https://github.com/toon-format/toon/actions/workflows/ci.yml)

The **AXI Semantic Compiler** is a powerful compilation pipeline designed to transform raw API specifications (such as Postman Collections) into a semantic intermediate representation (SIR), and ultimately into fully-functioning, principle-adhering Command Line Interfaces (CLIs) based on the [AXI Guidelines](https://axi.md).

## 🌟 Philosophy

Most API-to-CLI generators map 1:1, resulting in clunky, developer-hostile interfaces. The ASC changes this by applying **Semantic Passes**—analyzing your API's intent to automatically detect pagination, boolean flags, search filters, and resource hierarchies. 

It generates CLIs that adhere strictly to [AXI principles (https://axi.md)](https://axi.md):
- Structured TOON (Terminal Object Output Notation) default output.
- Auto-routing of operation complexity (Simple ops get flags, complex ops get auto-generated YAML workflows).
- Intelligent deduplication and alias management.

## 🏗️ Architecture

The project is structured as an npm workspaces monorepo with distinct decoupled phases:

- `packages/core-ast`: The universal Abstract Syntax Tree for API descriptions.
- `packages/core-sir`: The Semantic Intermediate Representation (SIR) modeling resource entities, operations, and traits.
- `packages/frontend-postman`: Parser that ingests Postman v2.1 Collections, extracting auth, paths, and metadata into AST.
- `packages/frontend-openapi`: *(Planned)* Parser for OpenAPI v3.x Specifications.
- `packages/passes` & `packages/pipeline`: 7 distinct semantic analyzer passes (Resource Merging, Pagination, Collections, Boolean detection, etc.).
- `packages/backend-axi`: The generator that converts SIR into a standalone, executable AXI CLI codebase.
- `packages/backend-eval`: An automated test harness with a mock HTTP server to evaluate generated CLIs.
- `packages/cli`: The primary ASC orchestrator binary.

## 🚀 Getting Started

### 1. Install & Build
Ensure you have Node.js installed, then install the monorepo dependencies and build all packages:
```bash
git clone <repository-url>
cd asc
npm install
npm run build
```

### 2. Compile an API Specification to SIR
Convert your Postman collection into the compiler's Semantic Intermediate Representation (SIR).
```bash
node packages/cli/dist/index.js compile path/to/your-postman-collection.json --out sir.json
```
*Tip: You can optionally pass `--env path/to/env.json` to resolve `{{variables}}` inside your Postman collection!*

### 3. Generate the AXI CLI
Pass the intermediate `sir.json` through the backend generator to create your standalone CLI suite.
```bash
node packages/cli/dist/index.js generate axi sir.json --out ./my-generated-cli
```

### 4. Run your new CLI!
The compiler has successfully generated a fully standalone Node.js CLI project in `./my-generated-cli`. Let's run it:

```bash
cd my-generated-cli
npm install
npm run build

# See your beautifully structured API operations!
node dist/index.js --help
```

Your new CLI automatically utilizes `process.env.AXI_BASE_URL` to point requests to your API, handling authentication headers extracted straight from the original specification.

## 💻 Using the CLI (For Humans & Agents)

The generated CLIs are heavily optimized for both humans and autonomous agents.

### Exploring the CLI
You can explore available resources and operations using `--help`:
```bash
# List all resource groups
node dist/index.js --help

# List all operations under the "Alarms & Events" resource
node dist/index.js alarms---events --help

# See the specific flags required for an operation
node dist/index.js alarms---events active-alarms --help
```

### Running Commands
Once you know the operation, simply pass the required arguments as flags:
```bash
node dist/index.js alarms---events active-alarms --filterModel "critical" --orgId 42
```
If you omit a required flag for a medium/complex operation, the CLI will automatically drop you into an **interactive prompt wizard**.

### For Agents (JSON Mode)
By default, the CLI outputs **TOON (Terminal Object Output Notation)** which is optimized for quick human readability. However, agents and downstream scripts can easily request standard JSON by appending the `--json` flag:
```bash
node dist/index.js alarms---events active-alarms --orgId 42 --json > output.json
```

### Overriding the Base URL
The base URL is extracted directly from the Postman collection. You can override this dynamically at runtime using the `AXI_BASE_URL` environment variable:
```bash
# On Linux/macOS
AXI_BASE_URL="https://prod.api.example.com" node dist/index.js alarms---events active-alarms --orgId 42

# On Windows (PowerShell)
$env:AXI_BASE_URL="https://prod.api.example.com"; node dist/index.js alarms---events active-alarms --orgId 42
```

## 🤝 Adherence to AXI

Generated CLIs strictly follow the [AXI standard](https://axi.md), including:
- Returning strictly machine/human-readable data without logging noise.
- Providing robust `--json`, `--yaml`, and `--fields` extraction for piping.
- Consistent exit codes for success (0), predictable errors (1), and panic errors (2).
- Plural outputs gracefully returning counts (`totalCount`).
- `--force` guards for destructive operations (marked as `dangerous` by the compiler).

## 📄 License
MIT License
