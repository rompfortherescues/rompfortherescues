(() => {
  const byId = (id) => document.getElementById(id);
  const state = {
    xml: null,
    etag: null,
    dirty: false,
    eventEditing: null,
    eventIsNew: false,
    dutyEditing: null,
    dutyIsNew: false
  };

  const status = (message, kind = 'info') => {
    const element = byId('status-message');
    element.textContent = message;
    element.dataset.state = kind;
  };

  const markDirty = () => {
    state.dirty = true;
    byId('save-data').disabled = false;
    status('You have unsaved changes.', 'dirty');
  };

  const createButton = (label, className, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${className}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };

  const setEmptyState = (container, message) => {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = message;
    container.append(empty);
  };

  const eventNodes = () => Array.from(state.xml.querySelectorAll('Events > Event'));
  const dutyNodes = () => Array.from(state.xml.querySelectorAll('Duties > Duty'));

  async function loadData(discardChanges = false) {
    if (state.dirty && !discardChanges && !window.confirm('Discard your unsaved changes and reload data.xml?')) return;

    byId('reload-data').disabled = true;
    byId('save-data').disabled = true;
    status('Loading data.xml...');
    try {
      const response = await fetch('/xml-data/data.xml', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Could not load data.xml (${response.status}).`);

      const source = await response.text();
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror') || !xml.documentElement || xml.documentElement.nodeName !== 'Record') {
        throw new Error('data.xml is not valid XML with a Record root element.');
      }

      state.xml = xml;
      state.etag = response.headers.get('ETag');
      state.dirty = false;
      renderLists();
      status(`Loaded ${eventNodes().length} events and ${dutyNodes().length} duties.`);
    } catch (error) {
      status(error.message || 'Could not load data.xml.', 'error');
    } finally {
      byId('reload-data').disabled = false;
      byId('save-data').disabled = !state.dirty;
    }
  }

  function renderLists() {
    renderEvents();
    renderDuties();
  }

  function renderEvents() {
    const list = byId('events-list');
    list.replaceChildren();
    const events = eventNodes();
    if (!events.length) {
      setEmptyState(list, 'No events in data.xml yet. Add an event to get started.');
      return;
    }

    events.forEach((eventNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';

      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = eventNode.getAttribute('name') || 'Untitled event';
      const date = document.createElement('p');
      date.textContent = eventNode.getAttribute('date') || 'No date set';
      copy.append(title, date);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openEventEditor(eventNode)),
        createButton('Delete', 'btn-danger', () => deleteEvent(eventNode))
      );
      row.append(copy, actions);
      list.append(row);
    });
  }

  function renderDuties() {
    const list = byId('duties-list');
    list.replaceChildren();
    const duties = dutyNodes();
    if (!duties.length) {
      setEmptyState(list, 'No duties in data.xml yet. Add a duty to get started.');
      return;
    }

    duties.forEach((dutyNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = dutyNode.textContent.trim() || 'Unnamed duty';
      copy.append(title);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openDutyEditor(dutyNode)),
        createButton('Delete', 'btn-danger', () => deleteDuty(dutyNode))
      );
      row.append(copy, actions);
      list.append(row);
    });
  }

  function addAttributeRow(name = '', value = '') {
    const row = document.createElement('div');
    row.className = 'attribute-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'attribute-name';
    nameInput.value = name;
    nameInput.placeholder = 'Attribute name';
    nameInput.setAttribute('aria-label', 'Attribute name');
    nameInput.readOnly = Boolean(name);
    nameInput.required = !name;

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'attribute-value';
    valueInput.value = value;
    valueInput.placeholder = 'Value';
    valueInput.setAttribute('aria-label', `${name || 'New'} attribute value`);
    if (name === 'name' || name === 'date') valueInput.required = true;

    row.append(nameInput, valueInput);
    if (name !== 'name' && name !== 'date') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-field';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${name || 'new'} attribute`);
      remove.addEventListener('click', () => row.remove());
      row.append(remove);
    }
    byId('event-attributes').append(row);
  }

  function addElementRow(name = '', value = '') {
    const row = document.createElement('div');
    row.className = 'element-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.placeholder = 'XML tag';
    nameInput.setAttribute('aria-label', 'Detail tag name');
    nameInput.required = true;

    const valueInput = document.createElement('textarea');
    valueInput.value = value;
    valueInput.placeholder = 'Detail text';
    valueInput.setAttribute('aria-label', `${name || 'New'} detail text`);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-field';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${name || 'new'} detail`);
    remove.addEventListener('click', () => row.remove());
    row.append(nameInput, valueInput, remove);
    byId('event-elements').append(row);
  }

  function openEventEditor(eventNode, isNew = false) {
    state.eventEditing = eventNode;
    state.eventIsNew = isNew;
    byId('event-editor-title').textContent = isNew ? 'Add event' : `Edit ${eventNode.getAttribute('name') || 'event'}`;
    byId('event-attributes').replaceChildren();
    byId('event-elements').replaceChildren();

    Array.from(eventNode.attributes).forEach((attribute) => addAttributeRow(attribute.name, attribute.value));
    Array.from(eventNode.children).forEach((child) => addElementRow(child.tagName, child.textContent));
    byId('event-editor').showModal();
  }

  function getContainer(name) {
    let container = state.xml.querySelector(`Record > ${name}`);
    if (!container) {
      container = state.xml.createElement(name);
      state.xml.documentElement.append(container);
    }
    return container;
  }

  function deleteEvent(eventNode) {
    const label = eventNode.getAttribute('name') || 'this event';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    eventNode.remove();
    markDirty();
    renderEvents();
  }

  function openDutyEditor(dutyNode, isNew = false) {
    state.dutyEditing = dutyNode;
    state.dutyIsNew = isNew;
    byId('duty-editor-title').textContent = isNew ? 'Add duty' : 'Edit duty';
    byId('duty-name').value = isNew ? '' : dutyNode.textContent.trim();
    byId('duty-editor').showModal();
    byId('duty-name').focus();
  }

  function deleteDuty(dutyNode) {
    const label = dutyNode.textContent.trim() || 'this duty';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    dutyNode.remove();
    markDirty();
    renderDuties();
  }

  async function saveData() {
    if (!state.dirty || !state.etag) return;
    const button = byId('save-data');
    button.disabled = true;
    status('Saving data.xml...');
    try {
      const xmlText = new XMLSerializer().serializeToString(state.xml);
      const response = await fetch('/api/admin/data', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'If-Match': state.etag
        },
        body: xmlText
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error('data.xml changed since you loaded it. Reload before saving to avoid overwriting someone else\'s edits.');
      }
      if (!response.ok) throw new Error(result.error || `Save failed (${response.status}).`);

      state.etag = response.headers.get('ETag') || result.etag || state.etag;
      state.dirty = false;
      status('Changes saved to data.xml.');
    } catch (error) {
      status(error.message || 'Could not save data.xml.', 'error');
    } finally {
      button.disabled = !state.dirty;
    }
  }

  byId('reload-data').addEventListener('click', () => loadData());
  byId('save-data').addEventListener('click', saveData);
  byId('add-event').addEventListener('click', () => {
    const eventNode = state.xml.createElement('Event');
    eventNode.setAttribute('name', '');
    eventNode.setAttribute('date', '');
    openEventEditor(eventNode, true);
  });
  byId('add-duty').addEventListener('click', () => {
    const dutyNode = state.xml.createElement('Duty');
    openDutyEditor(dutyNode, true);
  });
  byId('add-event-attribute').addEventListener('click', () => addAttributeRow());
  byId('add-event-field').addEventListener('click', () => addElementRow());

  byId('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const attributes = Array.from(byId('event-attributes').querySelectorAll('.attribute-row'));
    const updatedAttributes = new Map();
    for (const row of attributes) {
      const name = row.querySelector('.attribute-name').value.trim();
      const value = row.querySelector('.attribute-value').value.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
        status(`Invalid XML attribute name: ${name || '(empty)'}.`, 'error');
        return;
      }
      if (updatedAttributes.has(name)) {
        status(`Duplicate XML attribute: ${name}.`, 'error');
        return;
      }
      updatedAttributes.set(name, value);
    }
    if (!updatedAttributes.get('name') || !updatedAttributes.get('date')) {
      status('Event name and date are required.', 'error');
      return;
    }

    const details = Array.from(byId('event-elements').querySelectorAll('.element-row')).map((row) => ({
      name: row.querySelector('input').value.trim(),
      value: row.querySelector('textarea').value
    }));
    if (details.some((detail) => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(detail.name))) {
      status('Each event detail needs a valid XML tag name.', 'error');
      return;
    }

    const node = state.eventEditing;
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
    updatedAttributes.forEach((value, name) => node.setAttribute(name, value));
    node.replaceChildren(...details.map((detail) => {
      const child = state.xml.createElement(detail.name);
      child.textContent = detail.value;
      return child;
    }));

    if (state.eventIsNew) getContainer('Events').append(node);
    byId('event-editor').close();
    state.eventEditing = null;
    state.eventIsNew = false;
    markDirty();
    renderEvents();
  });

  byId('duty-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = byId('duty-name').value.trim();
    if (!value) return;
    if (state.dutyIsNew) {
      state.dutyEditing.textContent = value;
      getContainer('Duties').append(state.dutyEditing);
    } else {
      state.dutyEditing.textContent = value;
    }
    byId('duty-editor').close();
    state.dutyEditing = null;
    state.dutyIsNew = false;
    markDirty();
    renderDuties();
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => byId(button.dataset.closeDialog).close());
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadData();
})();
