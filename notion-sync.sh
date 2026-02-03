#!/bin/bash
# Notion page sync helper
# Usage: ./notion-sync.sh [pull|push] [page_id]

set -e

CREDS_FILE="$HOME/.openclaw/workspace/.notion-credentials.json"
TOKEN=$(jq -r '.token' "$CREDS_FILE")
PAGE_ID="${2:-2fb36963a0ca80949b4ed39b8f672bd8}"
MD_FILE="$HOME/.openclaw/workspace/padel/business-plan.md"

notion_api() {
  curl -s -X "$1" "https://api.notion.com/v1$2" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    ${3:+-d "$3"}
}

pull_page() {
  echo "# Padel Business Plan" > "$MD_FILE"
  echo "" >> "$MD_FILE"
  
  # Get all blocks
  notion_api GET "/blocks/$PAGE_ID/children?page_size=100" | jq -r '
    .results[] | 
    if .type == "heading_1" then "# " + (.heading_1.rich_text | map(.plain_text) | join(""))
    elif .type == "heading_2" then "## " + (.heading_2.rich_text | map(.plain_text) | join(""))
    elif .type == "heading_3" then "### " + (.heading_3.rich_text | map(.plain_text) | join(""))
    elif .type == "paragraph" then (.paragraph.rich_text | map(.plain_text) | join("")) + "\n"
    elif .type == "bulleted_list_item" then "- " + (.bulleted_list_item.rich_text | map(.plain_text) | join(""))
    elif .type == "numbered_list_item" then "1. " + (.numbered_list_item.rich_text | map(.plain_text) | join(""))
    elif .type == "to_do" then (if .to_do.checked then "- [x] " else "- [ ] " end) + (.to_do.rich_text | map(.plain_text) | join(""))
    elif .type == "table_of_contents" then "[TOC]\n"
    elif .type == "divider" then "---\n"
    elif .type == "quote" then "> " + (.quote.rich_text | map(.plain_text) | join(""))
    elif .type == "callout" then "> **" + (.callout.icon.emoji // "ℹ️") + "** " + (.callout.rich_text | map(.plain_text) | join(""))
    elif .type == "code" then "```\n" + (.code.rich_text | map(.plain_text) | join("")) + "\n```"
    else ""
    end
  ' >> "$MD_FILE"
  
  echo "Pulled to: $MD_FILE"
}

case "$1" in
  pull) pull_page ;;
  *) echo "Usage: $0 [pull|push] [page_id]" ;;
esac
