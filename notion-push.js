#!/usr/bin/env node
// Notion markdown push - converts markdown to Notion blocks and replaces page content

const fs = require('fs');
const https = require('https');

const CREDS = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/.notion-credentials.json'));
const TOKEN = CREDS.token;
const PAGE_ID = process.argv[2] || '2fb36963a0ca80949b4ed39b8f672bd8';
const MD_FILE = process.env.HOME + '/.openclaw/workspace/padel/business-plan.md';

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path: '/v1' + path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function mdToBlocks(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  
  for (let line of lines) {
    line = line.trimEnd();
    if (!line) continue;
    
    if (line === '[TOC]') {
      blocks.push({ type: 'table_of_contents', table_of_contents: { color: 'default' } });
    } else if (line === '---') {
      blocks.push({ type: 'divider', divider: {} });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } });
    } else if (line.startsWith('- [x] ')) {
      blocks.push({ type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: line.slice(6) } }], checked: true } });
    } else if (line.startsWith('- [ ] ')) {
      blocks.push({ type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: line.slice(6) } }], checked: false } });
    } else if (line.startsWith('- ')) {
      blocks.push({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (line.match(/^\d+\. /)) {
      blocks.push({ type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\. /, '') } }] } });
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', quote: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else {
      blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } });
    }
  }
  return blocks;
}

async function clearPage(pageId) {
  const children = await notionRequest('GET', `/blocks/${pageId}/children?page_size=100`);
  for (const block of children.results || []) {
    await notionRequest('DELETE', `/blocks/${block.id}`);
  }
}

async function pushBlocks(pageId, blocks) {
  // Notion API limits to 100 blocks per request
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    await notionRequest('PATCH', `/blocks/${pageId}/children`, { children: chunk });
  }
}

async function main() {
  console.log('Reading markdown...');
  const md = fs.readFileSync(MD_FILE, 'utf8');
  
  console.log('Converting to blocks...');
  const blocks = mdToBlocks(md);
  console.log(`Generated ${blocks.length} blocks`);
  
  console.log('Clearing existing page content...');
  await clearPage(PAGE_ID);
  
  console.log('Pushing new content...');
  await pushBlocks(PAGE_ID, blocks);
  
  console.log('Done!');
}

main().catch(console.error);
