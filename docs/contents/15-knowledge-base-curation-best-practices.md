# Knowledge Base Curation: Content That Actually Works

## Introduction

Your chatbot is only as good as its knowledge base. Feed it garbage, it produces garbage. Feed it well-organized, accurate content, and it becomes genuinely helpful.

This guide covers the art and science of knowledge base curation—what content to include, how to structure it, and how to keep it working well over time.

---

## The Core Principle

### Quality Over Quantity

More content isn't better. Better content is better.

```
Common Mistake:
"Let's upload EVERYTHING!"
├── 500 documents
├── Redundant information everywhere
├── Outdated content mixed with current
├── Chatbot gives conflicting answers
└── Users confused, trust lost

Better Approach:
"Let's upload what matters."
├── 50 carefully curated documents
├── Each piece serves a purpose
├── Current and accurate
├── Chatbot gives consistent answers
└── Users trust the responses
```

### The Curation Mindset

Think like a librarian, not a hoarder:

```
Hoarder: "Someone might need this someday"
         Result: Cluttered, conflicting, confusing

Librarian: "Does this serve our users' needs?"
           Result: Organized, relevant, useful
```

---

## Part 1: What to Include

### The Content Audit Framework

Before adding anything, ask these questions:

```
Content Evaluation Checklist:

□ Is this information users actually ask about?
□ Is this the authoritative source for this info?
□ Is this current and accurate?
□ Does this add new information (not already covered)?
□ Is this self-contained enough to be useful as a chunk?

If any answer is NO, reconsider including it.
```

### High-Value Content Types

Content that works great in knowledge bases:

```
Excellent KB Content:

FAQs
├── Direct question-answer format
├── Already shaped for chatbot use
├── Covers real user queries
└── Example: "What's your return policy?" → Answer

Product/Service Documentation
├── Specifications, features, pricing
├── How things work
├── What's included
└── Example: Product sheets, feature lists

Policies and Procedures
├── Returns, shipping, terms
├── Step-by-step processes
├── Official guidelines
└── Example: Return policy document

How-To Guides
├── Step-by-step instructions
├── Troubleshooting steps
├── Setup procedures
└── Example: "How to reset your password"

Reference Information
├── Facts and figures
├── Technical specifications
├── Contact information
└── Example: Store hours, phone numbers
```

### Content to Avoid

Some content hurts more than it helps:

```
Poor KB Content:

Marketing Fluff
├── "We're the best in the industry!"
├── Vague superlatives with no substance
├── Users don't ask "How great are you?"
└── Solution: Include only factual claims

Internal Documents
├── Meeting notes, internal memos
├── Exposes internal processes
├── Not meant for customer consumption
└── Solution: Create customer-facing versions

Outdated Information
├── Last year's pricing
├── Discontinued products
├── Old policies
└── Solution: Remove or update

Duplicate Content
├── Same info in multiple docs
├── Causes conflicting answers
├── Wastes vector space
└── Solution: Consolidate into single source

Dense Legal Text
├── Full terms of service (50 pages)
├── Unstructured contract language
├── Hard to extract useful chunks
└── Solution: Create plain-language summaries
```

### The "Would a Customer Ask?" Test

Simple filter for content decisions:

```
Test: Could this content answer a customer question?

Product specs        → "What's the battery life?"      ✓ Include
Meeting notes        → No customer question            ✗ Exclude
Return policy        → "Can I return this?"            ✓ Include
Internal sales goals → No customer question            ✗ Exclude
Troubleshooting FAQ  → "Why won't it turn on?"        ✓ Include
HR handbook          → Not customer-relevant           ✗ Exclude
```

---

## Part 2: Structuring Content for Retrieval

### How Chunking Affects Answers

Your content gets split into searchable pieces. Structure matters:

```
Document Flow:

Original Document
      │
      ▼
 ┌─────────────────┐
 │   CHUNKING      │
 │                 │
 │ Split into      │
 │ searchable      │
 │ pieces          │
 └─────────────────┘
      │
      ▼
Individual Chunks
(what the AI actually sees)
```

### Writing for Chunks

Each chunk should be self-contained:

```
❌ Bad: Requires context from elsewhere

Document paragraph:
"As mentioned above, these rules apply to all products
purchased after the date specified in section 2.1."

When chunked, this is useless—"above" and "section 2.1" are gone.


✅ Good: Self-contained chunks

Document paragraph:
"Products purchased after January 1, 2024 can be returned
within 30 days for a full refund. Items must be in original
packaging with receipt."

This chunk works alone—all information is present.
```

### Structuring Documents

Use clear hierarchy:

```
Document Structure Best Practices:

# Main Topic (H1)
Clear, descriptive title

## Subtopic (H2)
Logical grouping

### Specific Item (H3)
Detailed information

Each section should:
├── Have a descriptive heading
├── Cover one topic completely
├── Be useful even if read alone
└── Not rely on other sections for context
```

**Example: Well-Structured Return Policy**

```markdown
# Return Policy

## Standard Returns

Items can be returned within 30 days of purchase for a full refund.

Requirements for standard returns:
- Original receipt or proof of purchase
- Item in original packaging
- Item unused and undamaged

## Extended Holiday Returns

Items purchased between November 15 and December 31 can be
returned until January 31 of the following year.

The same requirements as standard returns apply.

## Final Sale Items

Items marked as "Final Sale" cannot be returned or exchanged.
Final sale items are clearly marked at the time of purchase.

## How to Return an Item

1. Go to your account at example.com/returns
2. Select the order containing the item
3. Choose "Return Item"
4. Print the prepaid shipping label
5. Pack the item securely and attach the label
6. Drop off at any shipping location

Refunds are processed within 5-7 business days of receiving
the returned item.
```

### Q&A Format for FAQs

FAQ content works great when formatted properly:

```
❌ Bad: Run-on FAQ format

"Our shipping times vary. Standard is 5-7 days. Express is
2-3 days. International can take 2-3 weeks depending on
customs. Free shipping on orders over $50. We ship to most
countries but not everywhere."

Hard to chunk, mixes multiple topics.


✅ Good: Separated Q&A pairs

## How long does standard shipping take?

Standard shipping takes 5-7 business days within the
continental United States.

## How long does express shipping take?

Express shipping takes 2-3 business days within the
continental United States.

## Do you offer free shipping?

We offer free standard shipping on orders over $50 within
the continental United States.

## Do you ship internationally?

Yes, we ship to over 50 countries. International shipping
typically takes 2-3 weeks depending on destination and
customs processing.
```

---

## Part 3: Source Selection Strategies

### Multi-Source Considerations

When pulling from multiple sources, plan carefully:

```
Multi-Source Strategy:

Source Types:
├── Files (PDF, Word, etc.)
├── Websites (scraped content)
├── Direct text input
├── Connected services (Notion, Google Docs)

Key Consideration:
Different sources may have the SAME information
with DIFFERENT wording → conflicts!
```

### The Single Source of Truth Principle

For each topic, designate ONE authoritative source:

```
Single Source of Truth:

Topic                   → Authoritative Source
─────────────────────────────────────────────────
Return policy           → ReturnPolicy.pdf
Product specs          → ProductCatalog.xlsx
Shipping rates         → ShippingInfo.md
Store hours            → StoreLocations.json
Troubleshooting        → SupportDocs folder

What to AVOID:
├── Return policy in 3 different documents
├── Product specs on website AND in PDF
├── Shipping info scattered across 5 pages
└── Same FAQ in multiple places
```

### Website Scraping Best Practices

When scraping websites:

```
Scraping Strategy:

DO scrape:
├── Public knowledge base pages
├── FAQ sections
├── Product documentation
├── Help articles
└── Policy pages

DON'T scrape:
├── Marketing landing pages (fluff, no substance)
├── Blog posts (may be outdated, opinion)
├── News/press releases (time-sensitive)
├── User-generated content (unverified)
└── Login-required content (incomplete capture)

Crawl Depth:
├── Single page: Specific articles you know you want
├── Shallow (1-2 levels): Section of a site
├── Deep (3+ levels): Use carefully, review results

Always review scraped content before finalizing KB.
```

---

## Part 4: Keeping Content Fresh

### The Staleness Problem

Content ages. Some faster than others:

```
Content Shelf Life:

Type                    Typical Validity    Review Frequency
────────────────────────────────────────────────────────────
Contact info            Until changed       Monthly
Product specs           Until update        Per release
Pricing                 Until changed       Weekly check
Policies                Until changed       Quarterly
How-to guides           Until UI/process    Per product update
                        changes
Seasonal content        Time-limited        Before/after season
Compliance info         Until regulation    Per regulation
                        changes             update
```

### Content Review Schedule

Build regular reviews into your workflow:

```
Review Schedule Template:

WEEKLY:
□ Check for pricing/availability changes
□ Review any flagged incorrect answers
□ Update time-sensitive information

MONTHLY:
□ Audit contact information
□ Review seasonal relevance
□ Check for product updates
□ Analyze "I don't know" patterns

QUARTERLY:
□ Full content accuracy review
□ Policy update check
□ Remove obsolete content
□ Consolidate duplicates

ANNUALLY:
□ Complete KB restructure review
□ Evaluate source relevance
□ Major content refresh
□ Align with business changes
```

### Triggers for Immediate Updates

Some changes can't wait for scheduled reviews:

```
Immediate Update Triggers:

□ Price changes
□ Product discontinuation
□ Policy changes
□ Contact information changes
□ Security/compliance issues
□ Reported incorrect answers
□ New product launches
□ Major feature updates
```

### Version Awareness

Track what's current:

```
Version Tracking:

Simple approach:
├── Include "Last updated: [date]" in documents
├── Review documents with dates > 6 months old
└── Flag time-sensitive content clearly

Better approach:
├── Content management system with version history
├── Automated staleness alerts
├── Review workflow with approval process
└── Change log for audit trail
```

---

## Part 5: Common Mistakes and Fixes

### Mistake 1: Dumping Everything In

**Problem:**
```
"We have 2,000 documents. Let's upload them all!"

Result:
├── Irrelevant content pollutes results
├── Outdated info mixed with current
├── Conflicting answers from different docs
└── Chunking overwhelmed, poor retrieval
```

**Fix:**
```
1. Audit existing content
2. Select only customer-relevant docs
3. Remove duplicates
4. Update outdated content
5. Consolidate related docs
6. Add incrementally, validate results
```

### Mistake 2: No Structure in Documents

**Problem:**
```
Unformatted wall of text:

"Our return policy allows returns within 30 days
you need a receipt and the item must be unused
some items are final sale those can't be returned
for exchanges you have 60 days instead of 30
international returns work differently..."

Result: Chunks have incomplete, unclear information
```

**Fix:**
```
Use clear headings and separation:

# Return Policy

## Standard Returns
- 30 days with receipt
- Item must be unused

## Exchanges
- 60 days for exchanges
- Same condition requirements

## International Returns
- Contact support for international returns
- Additional fees may apply

## Final Sale Items
- Marked at time of purchase
- Cannot be returned or exchanged
```

### Mistake 3: Redundant Information

**Problem:**
```
Same FAQ in three places:
├── FAQ.pdf
├── Website scrape
└── Manual text entry

Result: Slight differences cause conflicting answers
```

**Fix:**
```
1. Identify all sources covering same topics
2. Choose ONE authoritative source
3. Remove or archive duplicates
4. Document source decisions
```

### Mistake 4: Outdated Content

**Problem:**
```
2022 pricing document still in KB

User: "How much does shipping cost?"
Bot: "Shipping is $4.99 for standard."
Reality: It's now $6.99

Result: Wrong information, user trust damaged
```

**Fix:**
```
1. Date-stamp all content
2. Regular freshness audits
3. Immediate updates for pricing/policy
4. Archive, don't just leave outdated content
```

### Mistake 5: Missing Context

**Problem:**
```
Document says:
"See the table above for pricing."
"Refer to section 3 for details."
"As mentioned previously..."

When chunked: Context is lost, answers incomplete
```

**Fix:**
```
Make each section self-contained:

Instead of:              Write:
"See above"              Restate the key info
"Section 3"              Include relevant details inline
"As mentioned"           Repeat essential context
```

---

## Part 6: Content Templates

### FAQ Template

```markdown
# [Topic] FAQ

## [Question 1]?

[Complete answer that stands alone]

## [Question 2]?

[Complete answer that stands alone]

## [Question 3]?

[Complete answer that stands alone]
```

### Product Information Template

```markdown
# [Product Name]

## Overview
[2-3 sentence description of what this product does]

## Key Features
- [Feature 1]: [Brief explanation]
- [Feature 2]: [Brief explanation]
- [Feature 3]: [Brief explanation]

## Specifications
| Specification | Value |
|---------------|-------|
| [Spec 1]      | [Value] |
| [Spec 2]      | [Value] |

## Pricing
[Current pricing information]

## Availability
[Where/how to get it]

Last updated: [Date]
```

### Policy Template

```markdown
# [Policy Name] Policy

## Summary
[1-2 sentence plain language summary]

## Who This Applies To
[Who is covered by this policy]

## The Policy

### [Section 1]
[Clear, specific policy details]

### [Section 2]
[Clear, specific policy details]

## Exceptions
[Any exceptions to the policy]

## How to [Action Related to Policy]
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Questions?
[How to get help with this policy]

Effective date: [Date]
Last updated: [Date]
```

### How-To Guide Template

```markdown
# How to [Task]

## Before You Begin
[What you need / prerequisites]

## Steps

### Step 1: [Action]
[Clear instructions]

### Step 2: [Action]
[Clear instructions]

### Step 3: [Action]
[Clear instructions]

## Troubleshooting

### [Common Issue 1]
[Solution]

### [Common Issue 2]
[Solution]

## Need More Help?
[Where to get additional support]
```

---

## Part 7: Measurement and Iteration

### Content Effectiveness Metrics

Track how well your content performs:

```
Content Metrics:

COVERAGE
├── Questions answered successfully: X%
├── "I don't know" rate: Y%
└── Gap: Topics users ask about not in KB

ACCURACY
├── Correct answers: X%
├── Incorrect answers flagged: Y
└── Conflicts identified: Z

FRESHNESS
├── Content updated in last 30 days: X%
├── Content older than 6 months: Y%
└── Flagged as outdated: Z items

EFFICIENCY
├── Chunks used in answers: X avg
├── Retrieval confidence: Y avg
└── Sources cited per answer: Z avg
```

### Gap Analysis Process

Identify what's missing:

```
Gap Analysis Steps:

1. COLLECT
   ├── Review "I don't know" responses
   ├── Analyze escalated conversations
   └── Survey support team for common questions

2. CATEGORIZE
   ├── Topic not covered at all
   ├── Topic covered but not found (retrieval issue)
   └── Topic covered but answer unsatisfactory

3. PRIORITIZE
   ├── Frequency: How often is this asked?
   ├── Impact: How important to users?
   └── Effort: How hard to add/fix?

4. ACT
   ├── Add missing content
   ├── Restructure for better retrieval
   └── Improve existing content quality
```

### Continuous Improvement Cycle

```
KB Improvement Loop:

    ┌──────────────────────────────────────┐
    │                                      │
    ▼                                      │
ANALYZE ──► IDENTIFY ──► IMPROVE ──► VALIDATE
    │          │           │            │
    │          │           │            │
    └──────────┴───────────┴────────────┘

Analyze: Review metrics and user feedback
Identify: Find gaps and issues
Improve: Add, update, remove content
Validate: Test changes improve results
```

---

## Summary

Effective knowledge base curation comes down to discipline:

### The Golden Rules

```
1. Include only what users actually need
2. Make every chunk self-contained
3. Maintain single sources of truth
4. Keep content fresh with regular reviews
5. Measure and iterate continuously
```

### Quick Checklist

```
Before Adding Content:
□ Is this user-relevant?
□ Is this the authoritative source?
□ Is this current and accurate?
□ Is this well-structured?
□ Does this add new information?

Content Structure:
□ Clear headings and hierarchy
□ Self-contained sections
□ No references to "above" or other sections
□ Q&A format for FAQs

Maintenance:
□ Weekly: Time-sensitive updates
□ Monthly: Freshness audit
□ Quarterly: Full review
□ Immediate: Price/policy changes
```

### The Curation Mindset

```
Ask not: "What CAN we put in the KB?"
Ask: "What SHOULD be in the KB?"

The best knowledge bases aren't the biggest.
They're the most useful.
```

Your chatbot reflects your content. Curate with intention.
