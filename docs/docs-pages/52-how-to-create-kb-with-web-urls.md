# How to Create a Knowledge Base with Web URLs

Learn how to create Knowledge Bases by extracting content from websites. This guide covers both single URL and bulk URL modes, crawl configuration, content preview, and the approval workflow.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start Guide](#quick-start-guide)
3. [URL Input Modes](#url-input-modes)
4. [URL Validation](#url-validation)
5. [Crawl Method Selection](#crawl-method-selection)
6. [Advanced Crawl Configuration](#advanced-crawl-configuration)
7. [Previewing Content](#previewing-content)
8. [Content Approval Workflow](#content-approval-workflow)
9. [Bulk URL Operations](#bulk-url-operations)
10. [Best Practices](#best-practices)
11. [Common Use Cases](#common-use-cases)
12. [Troubleshooting](#troubleshooting)
13. [Quick Reference](#quick-reference)

---

## Introduction

### What is a Knowledge Base?

A Knowledge Base (KB) is a collection of content that powers your chatbot's responses. When users ask questions, the AI searches your Knowledge Base to find relevant information and provide accurate answers based on your content.

### Why Use Web URLs as a Source?

Web URLs are ideal for:

- **Documentation sites** - Technical docs, API references, help centers
- **Blog content** - Articles, tutorials, guides
- **Product pages** - Product descriptions, specifications, FAQs
- **Corporate websites** - Company info, policies, service descriptions

| Advantage | Description |
|-----------|-------------|
| No file management | Content stays updated at the source |
| Automatic extraction | Smart parsing handles HTML formatting |
| Multi-page support | Crawl entire sections of a website |
| Live preview | Review content before adding to KB |

### Overview of the Creation Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Enter URLs  │ --> │  2. Configure   │ --> │   3. Preview    │
│  Single/Bulk    │     │  Crawl Settings │     │   Content       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  6. KB Ready    │ <-- │  5. Finalize    │ <-- │  4. Approve     │
│  For Chatbots   │     │  & Process      │     │  Pages          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Prerequisites

Before creating a Knowledge Base with web URLs:

- You have an active PrivexBot account
- You're a member of a workspace with KB creation permissions
- The target website allows automated access (not blocking bots)
- URLs are publicly accessible (no login required)

---

## Quick Start Guide

Follow these steps to create a Knowledge Base with a single URL in under 5 minutes:

### Step 1: Navigate to Knowledge Bases

1. Log in to your PrivexBot dashboard
2. Select your workspace from the sidebar
3. Click **Knowledge Bases** in the navigation
4. Click **Create Knowledge Base**

### Step 2: Enter Basic Information

1. Enter a **Name** for your Knowledge Base (e.g., "Product Documentation")
2. Optionally add a **Description**
3. Click **Continue** to proceed to source selection

### Step 3: Add a Web URL Source

1. Click **Website URL** in the source type selector
2. Enter your URL (e.g., `https://docs.example.com/getting-started`)
3. Click **Validate** to check the URL is accessible

### Step 4: Preview the Content

1. Leave the default crawl settings (Crawl Website, 50 pages, 3 levels)
2. Click **Preview Content**
3. Wait for the content extraction to complete

### Step 5: Approve and Add

1. Review the extracted pages in the preview modal
2. All pages are selected by default
3. Click **Approve & Add Source**

### Step 6: Complete Creation

1. Configure chunking settings (defaults work well for most cases)
2. Click **Create Knowledge Base**
3. Wait for processing to complete

Your Knowledge Base is now ready to attach to chatbots!

---

## URL Input Modes

PrivexBot offers two modes for adding web URLs to your Knowledge Base.

### Single URL Mode (Default)

Single URL mode is the default when you open the web source form.

**When to use:**
- Adding one website or page
- Testing crawl settings before bulk operations
- Simple documentation pages

**Interface elements:**

```
┌─────────────────────────────────────────────────────┐
│  Website URL                                        │
│  ┌─────────────────────────────────┐  ┌──────────┐ │
│  │ https://example.com/docs        │  │ Validate │ │
│  └─────────────────────────────────┘  └──────────┘ │
│                                                     │
│  ☐ Bulk URL Mode                                    │
│    Add multiple URLs at once                        │
└─────────────────────────────────────────────────────┘
```

**How to use:**
1. Enter a single URL in the input field
2. Click **Validate** to verify the URL is accessible
3. Configure crawl settings as needed
4. Click **Preview Content** to see extracted content

### Bulk URL Mode

Enable Bulk URL Mode by checking the checkbox to add multiple URLs at once.

**When to use:**
- Adding content from multiple websites
- Adding several specific pages from the same site
- Migrating content from different domains

**Interface elements:**

```
┌─────────────────────────────────────────────────────┐
│  ☑ Bulk URL Mode                                    │
│    Add multiple URLs at once                        │
│                                                     │
│  Website URLs (one per line)                        │
│  ┌─────────────────────────────────────────────────┐│
│  │ https://example.com/docs/getting-started        ││
│  │ https://example.com/docs/api-reference          ││
│  │ https://blog.example.com/tutorials              ││
│  │                                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  [Validate 3 URLs]                                  │
└─────────────────────────────────────────────────────┘
```

**How to use:**
1. Check **Bulk URL Mode**
2. Enter URLs in the textarea (one per line)
3. Click **Validate X URLs** to check all URLs
4. Configure per-URL settings if needed
5. Click **Preview Content** to see all extracted content

---

## URL Validation

URL validation ensures your URLs are correctly formatted and accessible before crawling.

### Validation Process

When you click **Validate**:
1. The URL format is checked (must start with `http://` or `https://`)
2. The domain is verified as accessible
3. Basic connectivity is tested

### Validation States

| State | Visual Indicator | Meaning |
|-------|------------------|---------|
| Not validated | Default border | URL hasn't been checked yet |
| Valid | Green border | URL is valid and accessible |
| Invalid | Red border | URL has issues that need fixing |

### Common Validation Errors

**"Please enter a valid URL"**
- Missing protocol (add `https://`)
- Typos in the domain name
- Invalid characters in the URL

**Fix examples:**
```
WRONG:  example.com/docs
RIGHT:  https://example.com/docs

WRONG:  https://example .com/docs
RIGHT:  https://example.com/docs
```

### URL Format Requirements

Valid URLs must:
- Start with `http://` or `https://` (HTTPS recommended)
- Have a valid domain name
- Not contain spaces or invalid characters
- Be publicly accessible

---

## Crawl Method Selection

Choose how the system extracts content from your URL.

### Single Page (Scrape)

**What it does:** Extracts content from exactly one page—the URL you provided.

**When to use:**
- Individual blog posts or articles
- Specific product pages
- Single documentation pages
- Landing pages with all content on one page

**Example use cases:**
```
https://blog.example.com/how-to-guide     --> Extracts just this article
https://example.com/product/widget        --> Extracts just this product page
https://docs.example.com/api/users        --> Extracts just this API doc
```

### Crawl Website

**What it does:** Starts at your URL and follows links to discover and extract content from multiple related pages.

**When to use:**
- Documentation sites with multiple pages
- Blog sections with many articles
- Product catalogs
- Help centers with hierarchical content

**Example use cases:**
```
https://docs.example.com/           --> Crawls entire documentation
https://example.com/blog/           --> Crawls all blog posts
https://help.example.com/           --> Crawls entire help center
```

### Method Comparison Table

| Aspect | Single Page | Crawl Website |
|--------|-------------|---------------|
| Pages extracted | Exactly 1 | Up to max_pages setting |
| Processing time | Fast (seconds) | Slower (may take minutes) |
| Control | High (specific page) | Medium (pattern-based filtering) |
| Best for | Targeted content | Comprehensive coverage |
| Link following | No | Yes |

### Choosing the Right Method

```
Do you need content from just one specific page?
                    |
        YES ────────┴──────── NO
         |                     |
    Single Page           Does the site have
                          multiple linked pages?
                                   |
                       YES ────────┴──────── NO
                        |                     |
                   Crawl Website         Single Page
```

---

## Advanced Crawl Configuration

Click **Advanced Options** to access additional crawl settings.

### Max Pages

**What it means:** The maximum number of pages the crawler will extract.

| Setting | Range | Default |
|---------|-------|---------|
| Max Pages | 1-1000 | 50 |

**Recommendations:**
- Small documentation: 10-50 pages
- Medium documentation: 50-200 pages
- Large documentation: 200-500 pages
- Entire websites: 500-1000 pages

**Note:** Setting a higher limit doesn't mean all pages will be extracted—only pages discovered through links within your depth limit are crawled.

### Max Depth

**What it means:** How many "levels" deep the crawler follows links from your starting URL.

| Setting | Range | Default |
|---------|-------|---------|
| Max Depth | 1-10 | 3 |

**Visual explanation:**

```
Depth 0: https://docs.example.com/
         │
Depth 1: ├── /getting-started
         ├── /tutorials
         │   │
Depth 2: │   ├── /tutorials/basics
         │   └── /tutorials/advanced
         │       │
Depth 3: │       └── /tutorials/advanced/tips
         │
Depth 1: └── /api
             │
Depth 2:     └── /api/reference
```

**Recommendations:**
- Shallow sites: 1-2 levels
- Standard documentation: 2-3 levels
- Deep hierarchies: 4-5 levels
- Avoid: 6+ levels (may crawl unrelated pages)

### Include Patterns

**What it means:** Only crawl URLs that match these patterns. Uses glob syntax.

**How to add:**
1. Type a pattern in the input field
2. Press Enter or click **Add Pattern**
3. Patterns appear as green badges
4. Click a badge to remove it

**Pattern syntax examples:**

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `/docs/**` | `/docs/intro`, `/docs/api/users` | `/blog/intro` |
| `/api/**` | `/api/v1/users`, `/api/reference` | `/docs/api` |
| `**/getting-started` | `/docs/getting-started`, `/en/getting-started` | `/getting-started-old` |
| `/v2/**` | `/v2/docs`, `/v2/api/users` | `/v1/docs` |

### Exclude Patterns

**What it means:** Skip URLs that match these patterns, even if discovered.

**How to add:**
1. Type a pattern in the input field
2. Press Enter or click **Add Pattern**
3. Patterns appear as red badges
4. Click a badge to remove it

**Common exclude patterns:**

| Pattern | Purpose |
|---------|---------|
| `/admin/**` | Skip admin pages |
| `/auth/**` | Skip authentication pages |
| `*.pdf` | Skip PDF downloads |
| `/changelog/**` | Skip changelog pages |
| `**/search**` | Skip search result pages |
| `/*/edit` | Skip edit pages |

### Configuration Best Practices

**Do:**
- Start with conservative settings (lower pages/depth)
- Use include patterns to focus on relevant content
- Exclude admin, auth, and utility pages
- Preview before finalizing

**Don't:**
- Set max_pages to 1000 without include patterns
- Set max_depth above 5 without good reason
- Leave patterns empty for large sites
- Skip the preview step

---

## Previewing Content

The preview system lets you see exactly what content will be extracted before adding it to your Knowledge Base.

### Starting a Preview

1. Enter and validate your URL(s)
2. Configure crawl settings
3. Click **Preview Content**
4. Wait for crawling to complete

### Preview Loading States

During preview, you'll see:

```
┌────────────────────────────────────────────────────┐
│ ⟳ Crawling website...                              │
│   Starting crawl operation...                      │
│                                      [Cancel Preview]│
└────────────────────────────────────────────────────┘
```

The preview process:
1. Creates a temporary draft
2. Crawls pages based on your settings
3. Extracts and parses content
4. Displays results for review

### Preview Interface

When preview completes, a modal displays:

```
┌──────────────────────────────────────────────────────────────────┐
│  Full Content Preview                                        [X] │
│  Preview of extracted content from https://docs.example.com      │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Total Pages │  │ Total Words │  │ Source Title            │   │
│  │     12      │  │   45,230    │  │ Example Documentation   │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
│                                                                  │
│  [▸ Configuration Details                              2 rules]  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [☐] Select All    12 of 12 pages selected                 │  │
│  │                              [Copy Selected] [Export ▾]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Page List:                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [☑] 1  Getting Started               3,450 words  [✎][📋] │  │
│  │     https://docs.example.com/getting-started              │  │
│  │     [▸ Preview content]                                   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ [☑] 2  API Reference                 12,800 words [✎][📋] │  │
│  │     https://docs.example.com/api                          │  │
│  │     [▸ Preview content]                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Reject & Discard]         12 of 12 selected    [Approve & Add] │
└──────────────────────────────────────────────────────────────────┘
```

### Preview Statistics

The preview header shows:

| Stat | Description |
|------|-------------|
| Total Pages | Number of pages extracted |
| Total Words | Combined word count across all pages |
| Source Title | Title of the main page or aggregated title |

### Configuration Details

Expand to see:
- Crawl method used
- Max pages setting
- Max depth setting
- Include/exclude patterns applied

---

## Content Approval Workflow

The approval workflow ensures you control exactly what content enters your Knowledge Base.

### Page Selection

**Select All / Deselect All:**
- Click **Select All** to include all pages
- Click **Deselect All** to clear selection
- By default, all pages are selected

**Individual selection:**
- Click the checkbox next to any page to toggle selection
- Selected pages show a blue border
- Unselected pages are excluded from the KB

### Page Actions

Each page has action buttons:

| Icon | Action | Description |
|------|--------|-------------|
| ✎ | Edit | Open the content editor |
| 📋 | Copy | Copy page content to clipboard |

### Editing Page Content

Click the edit (✎) button to modify extracted content:

1. Content editor opens inline
2. Make your changes (fix formatting, remove noise, etc.)
3. Click **Save** to keep changes
4. Click **Cancel** to discard changes
5. Use **Revert** to restore original content

**Edited pages show an "Edited" badge.**

### Copying Content

**Copy single page:**
- Click the copy (📋) button next to any page

**Copy all selected:**
- Click **Copy Selected** in the header
- All selected pages are copied with titles as separators

### Exporting Content

Click the **Export** dropdown to download selected pages:

| Format | File Extension | Best For |
|--------|----------------|----------|
| Markdown | `.md` | Documentation, editing |
| Text | `.txt` | Plain text processing |
| HTML | `.html` | Web viewing, sharing |

### Making Your Decision

**Approve & Add:**
- Adds selected pages (with any edits) to your draft
- Cleans up the preview draft
- Returns to the source list

**Reject & Discard:**
- Discards all preview data
- Cleans up the preview draft
- Returns to the URL input form

### Why Approval Matters

The approval step lets you:
- Remove irrelevant pages (navigation, headers-only pages)
- Fix extraction issues before they enter the KB
- Control content quality
- Verify the crawl captured what you expected

---

## Bulk URL Operations

Bulk URL mode enables adding content from multiple URLs in one operation.

### Entering Multiple URLs

Format URLs one per line:

```
https://docs.example.com/getting-started
https://docs.example.com/tutorials
https://blog.example.com/best-practices
https://help.example.com/faq
```

### Bulk Validation

Click **Validate X URLs** to check all URLs at once:

```
┌─────────────────────────────────────────────────────┐
│  Validation Results (4/4 valid):                    │
│                                                     │
│  ✓ https://docs.example.com/getting-started        │
│  ✓ https://docs.example.com/tutorials              │
│  ✓ https://blog.example.com/best-practices         │
│  ✓ https://help.example.com/faq                    │
└─────────────────────────────────────────────────────┘
```

Invalid URLs show errors:

```
│  ✗ example.com/no-protocol                         │
│    Invalid URL format                              │
```

### Per-URL Configuration

After validation, you can customize settings for individual URLs:

```
┌─────────────────────────────────────────────────────┐
│  Per-URL Configuration (Optional)                   │
│  4 URLs ready • 2 customized                        │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │ 1  docs.example.com                           │  │
│  │    https://docs.example.com/getting-started   │  │
│  │    ● Custom configuration applied             │  │
│  │                                [Edit Config ▼]│  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 2  docs.example.com                           │  │
│  │    https://docs.example.com/tutorials         │  │
│  │                                [Configure ▼]  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Customizable per-URL settings:**
- Max Pages (overrides global setting)
- Max Depth (overrides global setting)
- Include Patterns (URL-specific)
- Exclude Patterns (URL-specific)

### Smart Pattern Suggestions

When configuring per-URL settings, the system suggests patterns based on the URL:

```
URL: https://docs.example.com/api/v2/reference

Quick suggestions:
  [+ /api/v2/reference/**]  [+ /api/v2/**]  [+ /**/api/**]
```

Click a suggestion to add it as an include pattern.

### Bulk Preview

When you click **Preview Content** in bulk mode:
1. All validated URLs are processed together
2. Each URL is crawled according to its configuration
3. Results are aggregated in the preview modal
4. You can select/deselect pages from any URL

### Global vs Per-URL Settings

| Setting Source | Priority | Use Case |
|----------------|----------|----------|
| Per-URL config | Highest | URL-specific requirements |
| Global config | Default | Shared settings across URLs |

If no per-URL config is set, global settings apply.

---

## Best Practices

### Choosing the Right Crawl Settings

| Content Type | Method | Max Pages | Max Depth | Patterns |
|--------------|--------|-----------|-----------|----------|
| Single article | Single Page | N/A | N/A | N/A |
| Small docs site | Crawl | 20-50 | 2-3 | Include `/docs/**` |
| Large docs site | Crawl | 100-300 | 3-4 | Include + Exclude |
| Blog section | Crawl | 50-100 | 2 | Include `/blog/**` |
| Help center | Crawl | 50-200 | 3 | Exclude `/admin/**` |

### Content Quality Over Quantity

**Do:**
- Start with fewer pages and expand if needed
- Exclude navigation-heavy pages
- Edit out boilerplate content
- Focus on unique, valuable content

**Don't:**
- Crawl entire sites without filtering
- Include duplicate content
- Add pages with minimal text
- Skip the preview review

### URL Patterns for Common Sites

**Documentation sites:**
```
Include: /docs/**, /api/**, /guide/**
Exclude: /search/**, /admin/**, *.pdf
```

**Blog sites:**
```
Include: /blog/**, /articles/**, /posts/**
Exclude: /author/**, /tag/**, /category/**
```

**Help centers:**
```
Include: /help/**, /support/**, /faq/**
Exclude: /ticket/**, /contact/**, /login/**
```

### Handling Dynamic Websites

Some websites load content with JavaScript:

**Signs of JS-rendered content:**
- Preview shows no content or just navigation
- Page content loads after delay in browser
- Single-page applications (SPAs)

**Solutions:**
1. Try Single Page mode for specific URLs
2. Look for static/server-rendered versions
3. Check if the site has an API or RSS feed
4. Contact support for advanced crawling options

---

## Common Use Cases

### Use Case 1: Documentation Site

**Goal:** Add entire product documentation to KB

**Configuration:**
```
URL:             https://docs.myproduct.com/
Method:          Crawl Website
Max Pages:       200
Max Depth:       4
Include:         /docs/**, /api/**
Exclude:         /changelog/**, /search/**
```

### Use Case 2: Blog Posts

**Goal:** Add recent blog posts about specific topic

**Configuration:**
```
URLs (Bulk):     https://blog.company.com/ai-features
                 https://blog.company.com/machine-learning
                 https://blog.company.com/automation-guide
Method:          Single Page (per URL)
```

### Use Case 3: Product Pages

**Goal:** Add product catalog information

**Configuration:**
```
URL:             https://store.example.com/products/
Method:          Crawl Website
Max Pages:       50
Max Depth:       2
Include:         /products/**
Exclude:         /cart/**, /checkout/**, /account/**
```

### Use Case 4: FAQ Pages

**Goal:** Add help center FAQ content

**Configuration:**
```
URL:             https://help.company.com/faq/
Method:          Crawl Website
Max Pages:       30
Max Depth:       2
Include:         /faq/**, /help/**
Exclude:         /contact/**, /ticket/**
```

### Use Case 5: Multi-Site Knowledge Base

**Goal:** Combine content from documentation, blog, and help center

**Configuration (Bulk Mode):**
```
URL 1:  https://docs.company.com/         → Crawl, /docs/**, 100 pages
URL 2:  https://blog.company.com/guides/  → Crawl, /guides/**, 30 pages
URL 3:  https://help.company.com/faq/     → Crawl, /faq/**, 50 pages
```

---

## Troubleshooting

### "No content extracted"

**Symptoms:**
- Preview shows 0 pages
- Word count is 0

**Causes and solutions:**

| Cause | Solution |
|-------|----------|
| JavaScript-rendered site | Try Single Page mode; check for static version |
| Include patterns too restrictive | Remove or broaden include patterns |
| Site blocks automated access | Check robots.txt; contact site owner |
| URL redirects to different domain | Use the final destination URL |

### "Website blocks automated access"

**Symptoms:**
- Preview fails with error
- 403 or 429 error codes

**Solutions:**
1. Check if site has a robots.txt blocking crawlers
2. Try reducing crawl speed (contact support)
3. Use Single Page mode for specific URLs
4. Check for publicly available content alternatives

### "Slow preview"

**Symptoms:**
- Preview takes more than 2-3 minutes
- Progress indicator stalls

**Causes:**
- Large site with many pages
- Slow website response times
- Deep crawl depth setting

**Solutions:**
1. Reduce max_pages setting
2. Reduce max_depth setting
3. Add include patterns to narrow scope
4. Try Single Page mode first to test

### "Missing pages"

**Symptoms:**
- Expected pages not in preview
- Fewer pages than expected

**Causes and solutions:**

| Cause | Solution |
|-------|----------|
| Pages not linked from start URL | Add missing URLs in Bulk Mode |
| Max pages limit reached | Increase max_pages |
| Max depth too shallow | Increase max_depth |
| Excluded by patterns | Review exclude patterns |
| Dynamic navigation | Links may be JS-rendered |

### "Content formatting issues"

**Symptoms:**
- Strange characters in content
- Missing formatting
- Repeated navigation text

**Solutions:**
1. Use the Edit function in preview to fix content
2. Remove boilerplate text manually
3. Try different source pages
4. Consider text input source for problematic content

### "Preview fails after long wait"

**Symptoms:**
- Loading indicator for several minutes
- Then error message appears

**Causes:**
- Website timeout
- Network issues
- Very large page content

**Solutions:**
1. Click Cancel Preview and try again
2. Reduce crawl scope
3. Try Single Page mode
4. Check your internet connection

---

## Quick Reference

### Crawl Method Comparison

| Feature | Single Page | Crawl Website |
|---------|-------------|---------------|
| Pages extracted | 1 | 1 to max_pages |
| Follows links | No | Yes |
| Speed | Fast | Slower |
| Control | Precise | Pattern-based |
| Use case | Specific pages | Entire sections |

### Configuration Defaults

| Setting | Default | Range |
|---------|---------|-------|
| Crawl Method | Crawl Website | Single Page / Crawl Website |
| Max Pages | 50 | 1-1000 |
| Max Depth | 3 | 1-10 |
| Include Patterns | Empty (all) | Glob patterns |
| Exclude Patterns | Empty (none) | Glob patterns |

### URL Pattern Cheat Sheet

| Pattern | Matches |
|---------|---------|
| `/docs/**` | Anything under /docs/ |
| `**/api/**` | Any path containing /api/ |
| `/blog/*` | Direct children of /blog/ only |
| `*.pdf` | Any PDF file |
| `/v[0-9]/**` | Version paths like /v1/, /v2/ |
| `/**/getting-started` | Any getting-started page |

### Validation States

| State | Indicator | Action |
|-------|-----------|--------|
| Not checked | Default border | Click Validate |
| Valid | Green border | Proceed to preview |
| Invalid | Red border | Fix URL format |

### Preview Actions

| Action | Icon | Shortcut |
|--------|------|----------|
| Select page | Checkbox | Click checkbox |
| Edit content | ✎ | Click edit icon |
| Copy content | 📋 | Click copy icon |
| Select all | Button | Click Select All |
| Export | Button | Choose format |

### Approval Workflow

```
Preview Complete
      │
      ├─── Review pages
      │
      ├─── Select/deselect pages
      │
      ├─── Edit content (optional)
      │
      └─── Decision
            │
            ├── [Approve & Add] → Content added to draft
            │
            └── [Reject & Discard] → Content discarded
```

---

## Summary

Creating Knowledge Bases from web URLs is a powerful way to populate your chatbot with relevant content. Remember these key principles:

1. **Start simple** - Use Single Page mode to test before crawling entire sites
2. **Use patterns** - Include and exclude patterns help focus on relevant content
3. **Preview first** - Always review extracted content before approving
4. **Quality matters** - Better to have less, high-quality content than more noise
5. **Iterate** - You can always add more sources later

With web URLs as a source, your Knowledge Base stays connected to your authoritative content, ensuring your chatbot provides accurate, up-to-date information to your users.
