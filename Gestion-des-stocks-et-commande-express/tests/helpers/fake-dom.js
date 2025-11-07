class FakeClassList {
  constructor(element) {
    this.element = element;
    this._set = new Set();
  }

  add(...classes) {
    classes.forEach(cls => {
      if (cls) {
        this._set.add(cls);
      }
    });
  }

  remove(...classes) {
    classes.forEach(cls => this._set.delete(cls));
  }

  contains(cls) {
    return this._set.has(cls);
  }

  toString() {
    return Array.from(this._set).join(' ');
  }
}

function matchesSelector(element, selector) {
  if (!selector || !element) {
    return false;
  }

  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }

  if (selector.startsWith('.')) {
    return element.classList.contains(selector.slice(1));
  }

  const dataAttrMatch = selector.match(/^\[data-([^=]+)="?([^"]+)"?\]$/);
  if (dataAttrMatch) {
    const [, attr, value] = dataAttrMatch;
    return element.dataset && element.dataset[attr] === value;
  }

  if (selector.toLowerCase() === 'button') {
    return element.tagName === 'BUTTON';
  }

  if (selector.toLowerCase() === 'a') {
    return element.tagName === 'A';
  }

  return false;
}

class FakeElement {
  constructor(document, tagName = 'div', options = {}) {
    this.document = document;
    this.tagName = tagName.toUpperCase();
    this.id = options.id || '';
    this.dataset = options.dataset || {};
    this.children = [];
    this.parentElement = null;
    this.listeners = {};
    this.hidden = options.hidden ?? false;
    this.style = options.style || {};
    this.classList = new FakeClassList(this);
    this.innerHTML = options.innerHTML || '';
    this.textContent = options.textContent || '';

    if (Array.isArray(options.classes)) {
      this.classList.add(...options.classes);
    }

    this.document._registerElement(this);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners[type]) {
      return;
    }
    this.listeners[type] = this.listeners[type].filter(fn => fn !== handler);
  }

  dispatchEvent(event) {
    if (!event.target) {
      event.target = this;
    }
    event.currentTarget = this;
    if (typeof event.preventDefault !== 'function') {
      event.preventDefault = function() {
        this.defaultPrevented = true;
      };
    }
    if (typeof event.stopPropagation !== 'function') {
      event.stopPropagation = function() {
        this.cancelBubble = true;
      };
    }

    const handlers = this.listeners[event.type] || [];
    handlers.slice().forEach(handler => {
      handler.call(this, event);
    });

    if (event.bubbles && !event.cancelBubble) {
      if (this.parentElement) {
        this.parentElement.dispatchEvent(event);
      } else {
        this.document._handleEvent(event);
      }
    }

    return !event.defaultPrevented;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];

    const visit = (node) => {
      node.children.forEach(child => {
        selectors.forEach(sel => {
          if (matchesSelector(child, sel)) {
            if (!results.includes(child)) {
              results.push(child);
            }
          }
        });
        visit(child);
      });
    };

    visit(this);
    return results;
  }
}

class FakeDocument {
  constructor() {
    this.elements = [];
    this.mapById = new Map();
    this.listeners = {};
    this.readyState = 'loading';
    this.body = new FakeElement(this, 'body');
  }

  _registerElement(element) {
    if (!this.elements.includes(element)) {
      this.elements.push(element);
      if (element.id) {
        this.mapById.set(element.id, element);
      }
    }
  }

  _handleEvent(event) {
    const handlers = this.listeners[event.type] || [];
    handlers.slice().forEach(handler => handler.call(this, event));
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  getElementById(id) {
    return this.mapById.get(id) || null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];
    this.elements.forEach(element => {
      selectors.forEach(sel => {
        if (matchesSelector(element, sel)) {
          if (!results.includes(element)) {
            results.push(element);
          }
        }
      });
    });
    return results;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners[type]) {
      return;
    }
    this.listeners[type] = this.listeners[type].filter(fn => fn !== handler);
  }
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
    this.defaultPrevented = false;
    this.cancelBubble = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.cancelBubble = true;
  }
}

function createElement(document, tagName, options = {}) {
  const element = new FakeElement(document, tagName, options);
  if (options.parent) {
    options.parent.appendChild(element);
  } else {
    document.body.appendChild(element);
  }
  return element;
}

function createFakeDOM() {
  const document = new FakeDocument();
  const window = {
    document,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: '' }
  };

  document.defaultView = window;

  return { document, window };
}

module.exports = {
  FakeClassList,
  FakeDocument,
  FakeElement,
  FakeEvent,
  createElement,
  createFakeDOM,
  matchesSelector
};
