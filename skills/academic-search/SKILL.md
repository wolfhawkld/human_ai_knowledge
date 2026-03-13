---
name: academic-search
description: "Search academic papers using OpenAlex API. Use when: user needs to search for research papers, check citations, find related work, or query by DOI. Supports: paper search, citation tracking, author lookup, DOI resolution."
homepage: https://openalex.org
metadata: { "openclaw": { "emoji": "📚" } }
---

# Academic Search Skill

Search and track academic papers using OpenAlex.

## When to Use

✅ **USE this skill when:**

- Search for research papers by title/keyword
- Check paper citations
- Find related work
- Query by DOI
- Author lookup
- Track citation changes

## Setup

### OpenAlex (Free, no API key needed)
Already works! Just start using.

## Commands

### Paper Search

```bash
# Basic search
curl -s "https://api.openalex.org/works?search=knowledge+graph+RAG&per_page=10" | jq '.results[] | {title, doi, cited_by_count, publication_year}'

# Search with filters
curl -s "https://api.openalex.org/works?search=machine+learning&filter=publication_year:2024,is_oa:true&per_page=5" | jq '.results[] | {title, doi, cited_by_count}'

# Search by author
curl -s "https://api.openalex.org/works?filter=author.display_name.search:Geoffrey+Hinton&per_page=5" | jq '.results[] | {title, year: .publication_year, citations: .cited_by_count}'
```

### DOI Lookup (CrossRef)

```bash
# Get paper info by DOI
curl -s "https://api.crossref.org/works/10.1088/3050-287X/ae4a3e" | jq '.message | {title: .title[0], authors: [.author[].family], published: .published.date_parts[0], citations: .is-referenced-by-count}'
```

### Citation Tracking

```bash
# Get papers citing a work
curl -s "https://api.openalex.org/works?filter=cites:https://doi.org/10.1088/3050-287X/ae4a3e" | jq '.results[] | {title, doi, year: .publication_year}'
```

### Author Lookup

```bash
# Find author
curl -s "https://api.openalex.org/authors?search=Da+Long" | jq '.results[] | {name: .display_name, works_count, cited_by_count, orcid}'
```

## Output Fields

### OpenAlex Common Fields
- `title` - Paper title
- `doi` - DOI URL
- `cited_by_count` - Citation count
- `publication_year` - Year
- `authors` - Author list
- `primary_location.source.display_name` - Journal/venue

## Quick Functions

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Paper search
paper-search() {
  local query="$1"
  curl -s "https://api.openalex.org/works?search=$(echo $query | sed 's/ /+/g')&per_page=10" | \
    jq '.results[] | "\(.title) (\(.publication_year)) - \(.cited_by_count) citations\nDOI: \(.doi)\n"'
}

# DOI lookup
doi-lookup() {
  local doi="$1"
  curl -s "https://api.crossref.org/works/$doi" | \
    jq '.message | "Title: \(.title[0])\nAuthors: \(.author | map(.family) | join(\", \"))\nPublished: \(.published.date_parts[0] | join(\"-\"))\nCitations: \(.["is-referenced-by-count"])"'
}

# Citation check
cite-check() {
  local doi="$1"
  echo "Checking citations for: $doi"
  curl -s "https://api.openalex.org/works/https://doi.org/$doi" | \
    jq '"Title: \(.title)\nCitations: \(.cited_by_count)\nYear: \(.publication_year)"'
}
```

Usage:
```bash
paper-search "knowledge graph RAG"
doi-lookup "10.1088/3050-287X/ae4a3e"
cite-check "10.1088/3050-287X/ae4a3e"
```

## API Limits

| API | Limit | Notes |
|-----|-------|-------|
| OpenAlex | ~100k/day | No key needed |
| CrossRef | Polite pool | Add mailto header for faster |

## Tips

1. **OpenAlex for breadth** - Covers more papers, no rate limit issues
2. **CrossRef for DOI** - Authoritative source, good for citations
3. **Use `fields` parameter** - Reduce response size, faster queries

## Example: Track Your Paper

```bash
# Set your DOI
MY_PAPER="10.1088/3050-287X/ae4a3e"

# Check citations
curl -s "https://api.openalex.org/works/https://doi.org/$MY_PAPER" | jq '{title, citations: .cited_by_count, year: .publication_year}'

# Find papers citing you
curl -s "https://api.openalex.org/works?filter=cites:https://doi.org/$MY_PAPER&per_page=5" | jq '.results[] | {title, year: .publication_year}'
```
