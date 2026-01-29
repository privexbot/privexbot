# How to Create Chatflows

Chatflows are visual workflow automations that let you build sophisticated AI assistants with branching logic, external integrations, and complex decision trees. This guide walks you through creating your first chatflow from scratch.

---

## Table of Contents

1. [What are Chatflows?](#what-are-chatflows)
2. [When to Use Chatflows](#when-to-use-chatflows)
3. [The Visual Editor Overview](#the-visual-editor-overview)
4. [Creating Your First Chatflow](#creating-your-first-chatflow)
5. [All Node Types Explained](#all-node-types-explained)
6. [Using Variables](#using-variables)
7. [Configuring Knowledge Base Retrieval](#configuring-knowledge-base-retrieval)
8. [Adding Branching Logic](#adding-branching-logic)
9. [Testing Your Chatflow](#testing-your-chatflow)
10. [Deploying to Channels](#deploying-to-channels)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## What are Chatflows?

A **Chatflow** is a visual workflow that defines how your AI assistant processes and responds to user messages. Unlike simple chatbots that follow a linear prompt-response pattern, chatflows let you:

- Create **branching conversations** based on user input
- **Connect to external APIs** and databases
- **Execute custom code** for specialized logic
- **Loop through data** and process collections
- Combine **multiple knowledge bases** with conditions

### Chatflows vs. Simple Chatbots

| Aspect | Simple Chatbot | Chatflow |
|--------|---------------|----------|
| **Creation Method** | Form-based configuration | Visual drag-and-drop editor |
| **Complexity** | Linear prompt → response | Multi-step with branching |
| **External Integrations** | Knowledge bases only | APIs, databases, webhooks |
| **Custom Logic** | Limited to prompt engineering | Python code execution |
| **Best For** | FAQ bots, simple assistants | Complex workflows, integrations |

**Key Point**: Both chatbots and chatflows share the same deployment channels and public API. Users won't know the difference—they just get better responses from well-designed chatflows.

---

## When to Use Chatflows

Choose a **chatflow** when you need:

1. **Conditional Responses**: Different answers based on user attributes or input
2. **Multi-Step Processes**: Workflows that require several stages (e.g., booking systems)
3. **External Data**: Real-time information from APIs or databases
4. **Custom Processing**: Data transformation, calculations, or formatting
5. **Multiple Knowledge Sources**: Routing queries to different knowledge bases

Choose a **simple chatbot** when you need:

1. Single knowledge base Q&A
2. Straightforward prompt-based responses
3. Quick setup without complex logic

---

## The Visual Editor Overview

The chatflow editor has three main areas:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Save Draft]  [Test]  [Deploy]                    Chatflow Name│
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  NODE    │                                  │   CONFIGURATION   │
│  PALETTE │         CANVAS                   │      PANEL        │
│          │                                  │                   │
│ ┌──────┐ │    ┌─────┐    ┌─────┐           │   Node Settings   │
│ │Trigger│ │    │Start│───▶│ LLM │           │   Properties      │
│ └──────┘ │    └─────┘    └─────┘           │   Variables       │
│ ┌──────┐ │         │                        │                   │
│ │ LLM  │ │         ▼                        │                   │
│ └──────┘ │    ┌─────────┐                   │                   │
│ ┌──────┐ │    │Response │                   │                   │
│ │ KB   │ │    └─────────┘                   │                   │
│ └──────┘ │                                  │                   │
│   ...    │                                  │                   │
└──────────┴──────────────────────────────────┴───────────────────┘
```

### Node Palette (Left)

Contains all available node types organized by category:
- **Core Nodes**: Trigger, Response
- **AI Nodes**: LLM, Knowledge Base
- **Logic Nodes**: Condition, Variable, Loop
- **Integration Nodes**: HTTP Request, Database
- **Utility Nodes**: Memory, Code

### Canvas (Center)

Your workspace where you:
- Drag nodes from the palette
- Connect nodes by drawing lines between ports
- Arrange your workflow visually
- Pan and zoom to navigate complex flows

### Configuration Panel (Right)

When you select a node, this panel shows:
- Node-specific settings
- Input/output variable configuration
- Connection options
- Validation status

---

## Creating Your First Chatflow

Let's build a simple chatflow that answers questions using a knowledge base.

### Step 1: Create a Draft

1. Navigate to **Chatflows** in your workspace sidebar
2. Click **Create New Chatflow**
3. Enter a name (e.g., "Customer Support Flow")
4. Click **Create Draft**

Your chatflow is now saved in draft mode. This means:
- It's stored temporarily (24-hour expiration)
- You can preview and test without affecting production
- No database records created until deployment

### Step 2: Add a Trigger Node

The **Trigger Node** is the entry point for every chatflow. It's automatically added when you create a new chatflow.

1. Click on the Trigger node in the canvas
2. In the Configuration Panel, you'll see:
   - **Output Variable**: `input` (the user's message)
   - **Session Variable**: `session_id` (conversation identifier)

The trigger node captures the incoming user message and makes it available to subsequent nodes.

### Step 3: Add an LLM Node

The **LLM Node** generates AI responses using Secret AI models.

1. Drag an **LLM Node** from the palette to the canvas
2. Connect the Trigger node's output port to the LLM node's input port
3. Configure the LLM node:

   | Setting | Value |
   |---------|-------|
   | **Model** | Select your preferred model |
   | **System Prompt** | "You are a helpful customer support assistant." |
   | **Input Variable** | `{{input}}` |
   | **Temperature** | 0.7 (balanced creativity) |
   | **Max Tokens** | 1024 |

### Step 4: Add a Response Node

The **Response Node** sends the final output back to the user.

1. Drag a **Response Node** to the canvas
2. Connect the LLM node's output to the Response node
3. Configure the response:
   - **Output Variable**: `{{llm_output}}` (or whatever your LLM node outputs)

### Step 5: Connect the Nodes

If not already connected, link the nodes:

1. Click and drag from the **output port** (right side) of one node
2. Drop on the **input port** (left side) of the next node
3. A line appears showing the connection

Your basic flow should look like:

```
[Trigger] ──▶ [LLM] ──▶ [Response]
```

### Step 6: Save and Test

1. Click **Save Draft** to preserve your work
2. Click **Test** to open the preview panel
3. Type a test message and verify the response

---

## All Node Types Explained

PrivexBot provides 11 node types across 5 categories.

### Core Nodes

#### Trigger Node
**Purpose**: Entry point that captures user input

| Property | Description |
|----------|-------------|
| `input` | The user's message text |
| `session_id` | Unique conversation identifier |
| `metadata` | Additional context (channel, timestamp) |

**Usage**: Every chatflow must have exactly one Trigger node.

#### Response Node
**Purpose**: Sends output back to the user

| Property | Description |
|----------|-------------|
| **Message** | The text to send (supports variables) |
| **Sources** | Optional knowledge base citations |

**Usage**: A chatflow can have multiple Response nodes for different branches.

---

### AI Nodes

#### LLM Node
**Purpose**: Generate AI responses using language models

| Setting | Description |
|---------|-------------|
| **Model** | The AI model to use |
| **System Prompt** | Instructions for the AI's behavior |
| **User Prompt** | The input to process (use `{{input}}` for user message) |
| **Temperature** | 0.0 (deterministic) to 1.0 (creative) |
| **Max Tokens** | Maximum response length |

**Example Configuration**:
```
System: You are a technical support specialist.
User: {{input}}
Temperature: 0.3
Max Tokens: 500
```

#### Knowledge Base Node
**Purpose**: Retrieve relevant information from your knowledge bases

| Setting | Description |
|---------|-------------|
| **Knowledge Base** | Select which KB to search |
| **Query** | Search query (typically `{{input}}`) |
| **Strategy** | `hybrid_search`, `semantic`, or `keyword` |
| **Top K** | Number of results to retrieve |
| **Score Threshold** | Minimum relevance score (0.0-1.0) |

**Output Variables**:
- `context`: Combined text from retrieved chunks
- `sources`: Array of source documents with metadata

---

### Logic Nodes

#### Condition Node
**Purpose**: Branch the flow based on conditions

| Setting | Description |
|---------|-------------|
| **Condition** | Expression to evaluate |
| **True Branch** | Output port when condition is true |
| **False Branch** | Output port when condition is false |

**Condition Syntax Examples**:
```
{{input}}.includes("refund")           # Text contains word
{{user_type}} == "premium"             # Variable comparison
{{score}} > 0.8                        # Numeric comparison
{{items}}.length > 0                   # Array check
```

#### Variable Node
**Purpose**: Set or manipulate variables for later use

| Setting | Description |
|---------|-------------|
| **Variable Name** | Name to store the value |
| **Value** | Static value or expression |
| **Operation** | set, append, increment, etc. |

**Example Uses**:
- Store user preferences: `{{user_name}} = "John"`
- Accumulate data: `{{total}} += {{item_price}}`
- Transform text: `{{clean_input}} = {{input}}.toLowerCase()`

#### Loop Node
**Purpose**: Iterate over arrays or collections

| Setting | Description |
|---------|-------------|
| **Array** | The collection to iterate |
| **Item Variable** | Variable name for current item |
| **Index Variable** | Variable name for current index |
| **Max Iterations** | Safety limit (default: 100) |

**Example**: Loop through search results to format each one.

---

### Integration Nodes

#### HTTP Request Node
**Purpose**: Call external APIs

| Setting | Description |
|---------|-------------|
| **URL** | The API endpoint |
| **Method** | GET, POST, PUT, DELETE |
| **Headers** | Request headers (use credentials for auth) |
| **Body** | Request payload (for POST/PUT) |
| **Credential** | Linked credential for authentication |

**Output Variables**:
- `response`: Parsed response body
- `status`: HTTP status code
- `headers`: Response headers

#### Database Node
**Purpose**: Execute SQL queries

| Setting | Description |
|---------|-------------|
| **Credential** | Database connection credential |
| **Query** | SQL statement (parameterized) |
| **Parameters** | Query parameters (prevents SQL injection) |

**Supported Databases**: PostgreSQL, MySQL, SQLite

---

### Utility Nodes

#### Memory Node
**Purpose**: Access conversation history

| Setting | Description |
|---------|-------------|
| **Messages Count** | Number of recent messages to retrieve |
| **Include System** | Whether to include system messages |

**Output**: Array of previous messages with roles (user/assistant).

#### Code Node
**Purpose**: Execute custom Python code

| Setting | Description |
|---------|-------------|
| **Code** | Python code to execute |
| **Input Variables** | Variables available in code |
| **Output Variable** | Variable to store result |
| **Timeout** | Maximum execution time (seconds) |

**Example Code**:
```python
# Available: input_data (dict of input variables)
# Return value becomes the output variable

items = input_data.get('items', [])
total = sum(item['price'] for item in items)
return {'total': total, 'count': len(items)}
```

**Security Note**: Code runs in a sandboxed environment with no network or file system access.

---

## Using Variables

Variables let you pass data between nodes and create dynamic responses.

### Variable Syntax

Use double curly braces: `{{variable_name}}`

### Built-in Variables

| Variable | Description |
|----------|-------------|
| `{{input}}` | User's current message |
| `{{session_id}}` | Conversation identifier |
| `{{timestamp}}` | Current time |
| `{{channel}}` | Source channel (web, telegram, etc.) |

### Node Output Variables

Each node produces output variables you can reference in subsequent nodes:

| Node Type | Output Variable | Contains |
|-----------|-----------------|----------|
| LLM | `{{llm_output}}` | Generated text |
| Knowledge Base | `{{context}}` | Retrieved content |
| Knowledge Base | `{{sources}}` | Source documents |
| HTTP Request | `{{response}}` | API response |
| Code | `{{result}}` | Code return value |

### Variable Operations

In Variable nodes, you can perform operations:

```
# String operations
{{greeting}} = "Hello, " + {{user_name}}

# Array operations
{{first_item}} = {{items}}[0]
{{count}} = {{items}}.length

# Conditional assignment
{{status}} = {{score}} > 0.8 ? "relevant" : "not relevant"
```

---

## Configuring Knowledge Base Retrieval

For AI assistants that answer questions from your documents:

### Step 1: Add Knowledge Base Node

1. Drag a **Knowledge Base** node after your Trigger
2. Select your knowledge base from the dropdown
3. Set the query to `{{input}}`

### Step 2: Configure Retrieval Settings

| Setting | Recommended Value | Purpose |
|---------|-------------------|---------|
| **Strategy** | `hybrid_search` | Combines semantic + keyword |
| **Top K** | 3-5 | Number of chunks to retrieve |
| **Score Threshold** | 0.7 | Minimum relevance |
| **Rerank** | Enabled | Improves result quality |

### Step 3: Connect to LLM

1. Add an LLM node after the Knowledge Base node
2. Configure the system prompt to use context:

```
You are a helpful assistant. Answer questions based on the following context.
If the context doesn't contain the answer, say you don't have that information.

Context:
{{context}}
```

3. Set user prompt to `{{input}}`

### Complete RAG Flow

```
[Trigger] ──▶ [Knowledge Base] ──▶ [LLM] ──▶ [Response]
                    │
                    ▼
              retrieves context
```

---

## Adding Branching Logic

Create conditional flows that respond differently based on user input or data.

### Example: Route by Topic

```
                           ┌──▶ [Sales KB] ──▶ [LLM] ──▶ [Response]
                           │
[Trigger] ──▶ [Condition] ─┼──▶ [Support KB] ──▶ [LLM] ──▶ [Response]
                           │
                           └──▶ [General LLM] ──▶ [Response]
```

**Condition Configuration**:
- Condition 1: `{{input}}.toLowerCase().includes("price") || {{input}}.includes("buy")`
  - True → Sales KB
- Condition 2: `{{input}}.toLowerCase().includes("help") || {{input}}.includes("issue")`
  - True → Support KB
- Default → General response

### Example: Quality Gate

Only respond if knowledge base finds relevant results:

```
[Trigger] ──▶ [KB] ──▶ [Condition: {{score}} > 0.7]
                              │
                     True ────┼───▶ [LLM with context] ──▶ [Response]
                              │
                     False ───┴───▶ [Fallback Response]
```

---

## Testing Your Chatflow

### Using the Preview Panel

1. Click **Test** in the toolbar
2. The preview panel opens on the right
3. Type test messages and observe:
   - Which nodes execute
   - Variable values at each step
   - Final response

### Debugging Tips

1. **Watch the Flow**: Nodes highlight as they execute
2. **Check Variables**: Click a node to see its input/output values
3. **Test Edge Cases**: Try unexpected inputs to verify error handling
4. **Verify Branches**: Test all condition paths

### Common Test Scenarios

| Test | What to Check |
|------|---------------|
| Normal question | KB retrieval works, response is relevant |
| Off-topic question | Fallback handling is graceful |
| Empty input | Error handling or prompt for clarification |
| Very long input | No truncation issues |
| Special characters | Proper escaping |

---

## Deploying to Channels

Once tested, deploy your chatflow to make it publicly accessible.

### Step 1: Complete Configuration

Before deploying, ensure you've configured:
- [ ] Chatflow name and description
- [ ] System prompt and persona
- [ ] All knowledge bases are deployed (not draft)
- [ ] Required credentials are linked
- [ ] Error handling paths exist

### Step 2: Deploy the Chatflow

1. Click **Deploy** in the toolbar
2. Configure deployment options:
   - **Visibility**: Public or Private
   - **API Key**: Generate if private
   - **Channels**: Select deployment targets

### Step 3: Enable Channels

| Channel | Additional Steps |
|---------|------------------|
| **Widget** | Configure appearance, get embed code |
| **Telegram** | Link Telegram bot credential |
| **Discord** | Select guild/server |
| **WhatsApp** | Link WhatsApp Business credential |
| **API** | Get endpoint URL and API key |

### What Happens at Deployment

1. Draft is saved to PostgreSQL database
2. Chatflow gets a unique ID and slug
3. Webhook registrations occur for messaging platforms
4. Public API endpoint becomes active
5. Draft is cleared from Redis

---

## Best Practices

### Design Principles

1. **Start Simple**: Begin with a basic flow, add complexity gradually
2. **Test Often**: Save and test after each significant change
3. **Handle Errors**: Always have fallback paths for failures
4. **Use Clear Names**: Name nodes and variables descriptively

### Performance Tips

1. **Minimize API Calls**: Cache results when possible
2. **Set Timeouts**: Configure appropriate timeouts for HTTP nodes
3. **Limit Loops**: Set reasonable max iterations
4. **Optimize Prompts**: Shorter, focused prompts = faster responses

### Security Considerations

1. **Use Credentials**: Never hardcode API keys in nodes
2. **Validate Input**: Sanitize user input before using in queries
3. **Limit Code Execution**: Use Code nodes sparingly
4. **Review Permissions**: Ensure connected services have minimal required access

### Maintenance

1. **Document Your Flow**: Add descriptions to complex nodes
2. **Version Control**: Note major changes with deployment dates
3. **Monitor Performance**: Check analytics for slow responses
4. **Update Knowledge Bases**: Keep RAG content fresh

---

## Troubleshooting

### Chatflow Won't Save

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Draft expired" error | 24-hour TTL exceeded | Create new draft, reconfigure |
| Validation errors | Invalid node configuration | Check error messages, fix highlighted nodes |
| Connection errors | Missing node connections | Ensure all nodes have required connections |

### Nodes Not Executing

| Symptom | Cause | Solution |
|---------|-------|----------|
| Flow stops at condition | Condition evaluates to false | Check condition logic, test with debug values |
| Loop never ends | Missing exit condition | Add max iterations, verify loop condition |
| Node shows error | Runtime exception | Check node configuration, input variables |

### Poor Response Quality

| Symptom | Cause | Solution |
|---------|-------|----------|
| Irrelevant answers | KB threshold too low | Increase score threshold (e.g., 0.8) |
| Missing context | KB returning empty | Check KB is deployed, has content |
| Hallucinations | Temperature too high | Reduce temperature (0.1-0.3 for factual) |
| Truncated responses | Max tokens too low | Increase max tokens limit |

### API Integration Failures

| Symptom | Cause | Solution |
|---------|-------|----------|
| HTTP 401 errors | Invalid credentials | Verify credential configuration |
| Timeout errors | Slow external API | Increase timeout, add retry logic |
| Parse errors | Unexpected response format | Check API documentation, adjust parsing |

### Deployment Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "KB not deployed" error | Draft knowledge base | Deploy KB before chatflow |
| Webhook registration failed | Invalid credentials | Verify channel credentials |
| Channel not responding | Webhook URL unreachable | Check server is publicly accessible |

---

## Next Steps

Now that you've created a chatflow:

1. **[Integrate the Widget](35-how-to-integrate-widget.md)**: Embed your chatflow on your website
2. **[Deploy to Telegram](39-how-to-deploy-telegram-bot.md)**: Reach users on messaging platforms
3. **[Manage After Deployment](36-how-to-manage-deployed-chatbots.md)**: Monitor and update your chatflow
4. **[View Analytics](44-how-to-use-analytics.md)**: Track performance and usage

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
