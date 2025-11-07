const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const enqueuePath = resolve('includes/enqueue-assets.php');
const fileContent = readFileSync(enqueuePath, 'utf8');

test('import CSV module script is enqueued', () => {
  assert.match(
    fileContent,
    /wp_enqueue_script\(\s*'sp-import-csv'/,
    'Expected sp-import-csv script to be enqueued'
  );
});

test('application depends on import CSV module', () => {
  const appEnqueueMatch = fileContent.match(/wp_enqueue_script\(\s*'sp-app',[^;]+\);/);
  assert.ok(appEnqueueMatch, 'sp-app enqueue call should exist');
  assert.match(
    appEnqueueMatch[0],
    /'sp-import-csv'/,
    'sp-app should declare sp-import-csv as a dependency'
  );
});
