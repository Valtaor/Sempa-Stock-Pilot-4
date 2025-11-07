const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFakeDOM,
  createElement,
  FakeEvent,
  FakeElement
} = require('./helpers/fake-dom');

test('clicking the import CSV trigger opens the panel', () => {
  const { document, window } = createFakeDOM();
  global.document = document;
  global.window = window;
  global.Element = FakeElement;
  global.alert = () => {};

  // Build minimal DOM structure required by the module
  const reportsCard = createElement(document, 'article');
  const importButton = createElement(document, 'button', {
    id: 'stocks-import-csv',
    parent: reportsCard
  });
  createElement(document, 'svg', { parent: importButton });

  const panel = createElement(document, 'section', {
    id: 'stocks-import-panel',
    hidden: true
  });
  const dropZone = createElement(document, 'div', {
    id: 'csv-drop-zone',
    parent: panel
  });
  const fileInput = createElement(document, 'input', {
    id: 'csv-file-input',
    parent: dropZone
  });
  fileInput.click = () => {};

  createElement(document, 'div', { id: 'csv-preview', parent: panel, hidden: true });
  createElement(document, 'div', { id: 'csv-results', parent: panel, hidden: true });
  createElement(document, 'div', { id: 'csv-preview-content', parent: panel });
  createElement(document, 'div', { id: 'csv-results-content', parent: panel });
  createElement(document, 'div', { classes: ['csv-format-info'], parent: panel });
  createElement(document, 'button', { id: 'stocks-cancel-import', parent: panel });
  createElement(document, 'button', { id: 'csv-confirm-import', parent: panel });
  createElement(document, 'button', { id: 'csv-cancel-preview', parent: panel });
  createElement(document, 'button', { id: 'csv-close-results', parent: panel });

  // Load module after globals are ready
  delete require.cache[require.resolve('../assets/js/modules/import-csv.js')];
  const ImportCSVModule = require('../assets/js/modules/import-csv.js');
  const moduleInstance = window.importCSVModule || new ImportCSVModule();
  moduleInstance.init();

  const icon = importButton.children[0];
  const clickEvent = new FakeEvent('click', { bubbles: true });
  icon.dispatchEvent(clickEvent);

  assert.equal(moduleInstance.panel.hidden, false, 'panel should be visible after clicking trigger');
});
