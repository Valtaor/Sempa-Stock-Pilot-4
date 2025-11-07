const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFakeDOM,
  createElement,
  FakeEvent,
  FakeElement
} = require('./helpers/fake-dom');

test('clicking inside the print button triggers printMovements', () => {
  const { document, window } = createFakeDOM();
  global.document = document;
  global.window = window;
  global.Element = FakeElement;
  global.alert = () => {};

  // Export button to satisfy initGlobalHandlers
  createElement(document, 'a', {
    dataset: { trigger: 'export' }
  });

  const printButton = createElement(document, 'button', {
    id: 'stocks-print-movements'
  });
  const icon = createElement(document, 'svg', { parent: printButton });
  createElement(document, 'path', { parent: icon });

  window.SempaStocksData = {
    exportUrl: 'https://example.com/export',
    ajaxUrl: 'https://example.com/ajax',
    nonce: 'abc'
  };

  delete require.cache[require.resolve('../assets/js/app.js')];
  const StockPilotApp = require('../assets/js/app.js');
  const app = new StockPilotApp();
  app.printMovements = () => {
    app.printCalled = true;
  };

  app.initGlobalHandlers();

  const pathElement = icon.children[0];
  const clickEvent = new FakeEvent('click', { bubbles: true });
  pathElement.dispatchEvent(clickEvent);

  assert.equal(app.printCalled, true, 'printMovements should be invoked');
});
