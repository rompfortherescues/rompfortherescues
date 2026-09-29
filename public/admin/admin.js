(() => {
  const byId = (id) => document.getElementById(id);
  const state = {
    xml: null,
    pictures: [],
    dirty: false,
    recordEditing: null,
    recordKind: null,
    eventEditing: null,
    eventDraft: null,
    eventIsNew: false,
    eventKind: 'event',
    eventField: null,
    eventExtraAttributes: new Set(),
    eventExtraElements: new Set(),
    pendingEventPicture: null,
    pendingPictureDeletions: new Set(),
    pictureUploading: false,
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
      const response = await fetch(`/xml-data/data.xml?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Could not load data.xml (${response.status}).`);

      const source = await response.text();
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror') || !xml.documentElement || xml.documentElement.nodeName !== 'Record') {
        throw new Error('data.xml is not valid XML with a Record root element.');
      }

      state.xml = xml;
      state.dirty = false;
      renderLists();
      const pictureError = await loadPictures();
      status(pictureError || `Loaded ${eventNodes().length} events, ${state.xml.querySelectorAll('Charities > Charity').length} charities, and ${dutyNodes().length} duties.`,
        pictureError ? 'error' : 'info');
      return true;
    } catch (error) {
      status(error.message || 'Could not load data.xml.', 'error');
      return false;
    } finally {
      byId('reload-data').disabled = false;
      byId('save-data').disabled = !state.dirty;
    }
  }

  function renderLists() {
    renderRecordTexts('Description');
    renderRecordTexts('Mission');
    renderEvents();
    renderCharities();
    renderDuties();
  }

  function recordTextNodes(name) {
    return Array.from(state.xml.documentElement.children).filter((child) => child.tagName === name);
  }

  function renderRecordTexts(name) {
    const list = byId(name === 'Description' ? 'descriptions-list' : 'missions-list');
    list.replaceChildren();
    const nodes = recordTextNodes(name);
    if (!nodes.length) {
      setEmptyState(list, `No ${name.toLowerCase()}s yet.`);
      return;
    }

    nodes.forEach((node) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const preview = document.createElement('p');
      preview.className = 'row-copy';
      preview.textContent = node.textContent.trim().replace(/\s+/g, ' ') || '(empty)';
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('View', 'btn-turquoise', () => showItem(name, elementEditorValue(node))),
        createButton('Edit', 'btn-turquoise', () => openRecordTextEditor(name, node)),
        createButton('Delete', 'btn-danger', () => deleteRecordText(name, node))
      );
      row.append(preview, actions);
      list.append(row);
    });
  }

  function showItem(title, content) {
    byId('item-view-title').textContent = title;
    byId('item-view-image').hidden = true;
    byId('item-view-content').textContent = content;
    byId('item-view').showModal();
  }

  function showPicture(value) {
    showItem('Picture', pictureKeyFromValue(value));
    const image = byId('item-view-image');
    image.src = value;
    image.hidden = false;
  }

  function openRecordTextEditor(name, node = null) {
    state.recordKind = name;
    state.recordEditing = node;
    byId('record-text-title').textContent = `${node ? 'Edit' : 'Add'} ${name.toLowerCase()}`;
    byId('record-text-input').value = elementEditorValue(node);
    byId('record-text-editor').showModal();
    byId('record-text-input').focus();
  }

  function deleteRecordText(name, node) {
    if (!window.confirm(`Delete this ${name.toLowerCase()}? This will be included when you save changes.`)) return;
    node.remove();
    markDirty();
    renderRecordTexts(name);
  }

  function elementEditorValue(element) {
    if (!element) return '';
    if (element.tagName !== 'Description' && element.tagName !== 'Mission') return element.textContent;
    const serializer = new XMLSerializer();
    return Array.from(element.childNodes).map((node) => {
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) return node.nodeValue;
      return serializer.serializeToString(node);
    }).join('');
  }

  function setElementEditorValue(element, value) {
    element.replaceChildren();
    if ((element.tagName === 'Description' || element.tagName === 'Mission') && /<\/?[A-Za-z][^>]*>/.test(value)) {
      const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
      const wrapper = parsed.body.firstElementChild;
      Array.from(wrapper.childNodes).forEach((node) => element.append(state.xml.importNode(node, true)));
      return;
    }
    element.textContent = value;
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
      title.textContent = `${eventNode.getAttribute('name') || 'Untitled event'} - ${eventNode.getAttribute('date') || 'No date set'}`;
      copy.append(title);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('View', 'btn-turquoise', () => showItem(
          eventNode.getAttribute('name') || 'Event',
          [...Array.from(eventNode.attributes).map((attribute) => `${attribute.name}: ${attribute.value}`),
            ...Array.from(eventNode.children).map((child) => `${child.tagName}: ${elementEditorValue(child)}`)].join('\n\n')
        )),
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
      title.textContent = dutyNode.textContent.trim().replace(/\s+/g, ' ') || 'Unnamed duty';
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

  function renderCharities() {
    const list = byId('charities-list');
    list.replaceChildren();
    const charities = Array.from(state.xml.querySelectorAll('Charities > Charity'));
    if (!charities.length) {
      setEmptyState(list, 'No charities in data.xml yet. Add a charity to get started.');
      return;
    }

    charities.forEach((charityNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = charityNode.getAttribute('name') || 'Unnamed charity';
      copy.append(title);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openEventEditor(charityNode, false, 'charity')),
        createButton('Delete', 'btn-danger', () => deleteCharity(charityNode))
      );
      row.append(copy, actions);
      list.append(row);
    });
  }

  function pictureKeyFromValue(value) {
    const path = value.trim().split(/[?#]/, 1)[0];
    const basename = path.replace(/\\/g, '/').split('/').pop();
    try {
      return decodeURIComponent(basename);
    } catch {
      return basename;
    }
  }

  async function loadPictures() {
    try {
      const response = await fetch('/api/admin/pictures', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not load pictures (${response.status}).`);
      state.pictures = result.pictures || [];
      return null;
    } catch (error) {
      state.pictures = [];
      return error.message || 'Picture library unavailable.';
    }
  }

  async function convertToWebp(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('This browser could not convert the picture to WebP.')), 'image/webp', 0.9);
      });
      if (blob.type !== 'image/webp') throw new Error('This browser does not support WebP image conversion.');
      if (blob.size > 1024 * 1024) throw new Error('The converted WebP exceeds the 1 MB upload limit.');
      return blob;
    } finally {
      bitmap.close();
    }
  }

  function setEventPicture(eventNode, url) {
    const pictureElements = Array.from(eventNode.children).filter((child) => child.tagName === 'Picture');
    if (pictureElements.length) pictureElements.forEach((picture) => { picture.textContent = url; });
    else {
      const picture = state.xml.createElement('Picture');
      picture.textContent = url;
      eventNode.append(picture);
    }
  }

  async function uploadPicture(file) {
    if (!file) return;
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(file.name)) {
      byId('event-editor-message').textContent = 'Choose a JPG, JPEG, PNG, WebP, or GIF image.';
      return;
    }

    const targetDraft = state.eventDraft;
    const button = byId('event-picture-upload');
    button.disabled = true;
    byId('event-form').querySelector('[type="submit"]').disabled = true;
    state.pictureUploading = true;
    status(`Converting and uploading ${file.name}...`);
    try {
      const webp = await convertToWebp(file);
      const key = `event-${crypto.randomUUID()}.webp`;
      const form = new FormData();
      form.append('file', webp, key);
      const response = await fetch('/api/admin/pictures', {
        method: 'POST',
        credentials: 'same-origin',
        body: form
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      const newPictureKey = result.picture?.key || key;
      state.pictures.push(result.picture || { key: newPictureKey });
      if (state.eventDraft !== targetDraft || !byId('event-editor').open) {
        await deleteStoredPicture(newPictureKey);
        state.pictures = state.pictures.filter((picture) => picture.key !== newPictureKey);
        status('Canceled upload removed from eventpictures.');
        return;
      }
      const previousUpload = state.pendingEventPicture;
      state.pendingEventPicture = newPictureKey;
      setEventPicture(state.eventDraft, `/r2-images/${encodeURIComponent(newPictureKey)}`);
      renderEventFields();
      if (previousUpload) {
        await deleteStoredPicture(previousUpload);
        state.pictures = state.pictures.filter((picture) => picture.key !== previousUpload);
      }
      status(`${newPictureKey} is ready. Apply event changes, then Save changes to update data.xml.`, 'dirty');
    } catch (error) {
      status(error.message || 'Could not upload picture.', 'error');
      if (byId('event-editor').open) byId('event-editor-message').textContent = error.message || 'Could not upload picture.';
    } finally {
      state.pictureUploading = false;
      const currentButton = byId('event-picture-upload');
      if (currentButton) currentButton.disabled = false;
      if (state.eventDraft === targetDraft && byId('event-editor').open) {
        byId('event-form').querySelector('[type="submit"]').disabled = false;
      }
      byId('picture-file').value = '';
    }
  }

  async function deleteStoredPicture(key) {
    const response = await fetch(`/api/admin/pictures?name=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Could not delete ${key} (${response.status}).`);
      error.status = response.status;
      throw error;
    }
  }

  function eventFieldNames(kind) {
    const nodes = state.eventKind === 'event' ? eventNodes() : [state.eventDraft];
    const names = kind === 'attribute'
      ? new Set(state.eventKind === 'event' ? ['name', 'date', 'fee'] : ['name'])
      : new Set();
    const extras = kind === 'attribute' ? state.eventExtraAttributes : state.eventExtraElements;
    for (const node of [...nodes, state.eventDraft]) {
      const fields = kind === 'attribute' ? Array.from(node.attributes) : Array.from(node.children);
      fields.forEach((field) => names.add(kind === 'attribute' ? field.name : field.tagName));
    }
    extras.forEach((name) => names.add(name));
    if (kind === 'element' && state.eventKind === 'event') names.delete('Picture');
    return names;
  }

  function openEventFieldEditor(kind, name, element = null) {
    state.eventField = { kind, name, element };
    byId('event-field-title').textContent = `${element || (kind === 'attribute' && state.eventDraft.hasAttribute(name)) ? 'Edit' : 'Add'} ${name}`;
    byId('event-field-value').value = kind === 'attribute'
      ? state.eventDraft.getAttribute(name) || ''
      : element ? elementEditorValue(element) : '';
    byId('event-field-value').setCustomValidity('');
    byId('event-field-editor').showModal();
    byId('event-field-value').focus();
  }

  function renderFieldGroup(container, kind, name) {
    const group = document.createElement('section');
    group.className = 'event-field-group';
    const heading = document.createElement('div');
    heading.className = 'field-list-heading';
    const title = document.createElement('h3');
    title.textContent = name;
    heading.append(title);
    const elements = kind === 'element'
      ? Array.from(state.eventDraft.children).filter((child) => child.tagName === name)
      : state.eventDraft.hasAttribute(name) ? [null] : [];
    if (kind === 'element' || !elements.length) {
      heading.append(createButton(`Add ${name}`, 'btn-turquoise', () => openEventFieldEditor(kind, name)));
    }
    group.append(heading);

    elements.forEach((element) => {
      const value = kind === 'attribute' ? state.eventDraft.getAttribute(name) : elementEditorValue(element);
      const row = document.createElement('div');
      row.className = 'admin-row';
      const preview = document.createElement('p');
      preview.className = 'row-copy';
      preview.textContent = value.replace(/\s+/g, ' ').trim() || '(empty)';
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('View', 'btn-turquoise', () => showItem(name, value)),
        createButton('Edit', 'btn-turquoise', () => openEventFieldEditor(kind, name, element))
      );
      if (kind === 'element' || (name !== 'name' && name !== 'date')) {
        actions.append(createButton('Remove', 'btn-danger', () => {
          if (kind === 'attribute') state.eventDraft.removeAttribute(name);
          else element.remove();
          renderEventFields();
        }));
      }
      row.append(preview, actions);
      group.append(row);
    });
    container.append(group);
  }

  function addNamedEventField(kind) {
    const name = window.prompt(`Name of the new ${kind === 'attribute' ? 'attribute' : 'detail'}:`)?.trim();
    if (name === undefined || name === '') return;
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) || (kind === 'element' && name === 'Picture')) {
      status('Enter a valid XML name. Use the Picture controls for pictures.', 'error');
      return;
    }
    const extras = kind === 'attribute' ? state.eventExtraAttributes : state.eventExtraElements;
    extras.add(name);
    renderEventFields();
    openEventFieldEditor(kind, name);
  }

  function renderEventFields() {
    for (const kind of ['attribute', 'element']) {
      const container = byId(kind === 'attribute' ? 'event-attributes' : 'event-elements');
      container.replaceChildren();
      const heading = document.createElement('div');
      heading.className = 'field-list-heading';
      const title = document.createElement('h3');
      title.textContent = kind === 'attribute' ? 'Attributes' : 'Details';
      heading.append(title, createButton(kind === 'attribute' ? 'Add attribute' : 'Add detail', 'btn-turquoise', () => addNamedEventField(kind)));
      container.append(heading);
      eventFieldNames(kind).forEach((name) => renderFieldGroup(container, kind, name));
    }

    const pictureContainer = byId('event-picture');
    pictureContainer.replaceChildren();
    if (state.eventKind !== 'event') return;
    const heading = document.createElement('div');
    heading.className = 'field-list-heading';
    const title = document.createElement('h3');
    title.textContent = 'Picture';
    const upload = createButton('Upload picture', 'btn-turquoise', () => byId('picture-file').click());
    upload.id = 'event-picture-upload';
    upload.disabled = state.pictureUploading;
    heading.append(title, upload);
    pictureContainer.append(heading);
    const picture = state.eventDraft.querySelector('Picture');
    if (picture) {
      const row = document.createElement('div');
      row.className = 'admin-row';
      const name = document.createElement('p');
      name.className = 'row-copy';
      name.textContent = pictureKeyFromValue(picture.textContent);
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(createButton('View', 'btn-turquoise', () => showPicture(picture.textContent)));
      actions.append(createButton('Remove', 'btn-danger', async () => {
        if (state.pendingEventPicture) {
          try {
            await deleteStoredPicture(state.pendingEventPicture);
            state.pictures = state.pictures.filter((stored) => stored.key !== state.pendingEventPicture);
            state.pendingEventPicture = null;
          } catch (error) {
            status(error.message, 'error');
            return;
          }
        }
        Array.from(state.eventDraft.children).filter((child) => child.tagName === 'Picture').forEach((child) => child.remove());
        renderEventFields();
      }));
      row.append(name, actions);
      pictureContainer.append(row);
    }
  }

  function openEventEditor(eventNode, isNew = false, kind = 'event') {
    state.eventEditing = eventNode;
    state.eventDraft = eventNode.cloneNode(true);
    state.eventIsNew = isNew;
    state.eventKind = kind;
    state.eventExtraAttributes.clear();
    state.eventExtraElements.clear();
    state.pendingEventPicture = null;
    byId('event-editor-message').textContent = '';
    const label = kind === 'charity' ? 'charity' : 'event';
    byId('event-editor-title').textContent = isNew ? `Add ${label}` : `Edit ${eventNode.getAttribute('name') || label}`;
    const apply = byId('event-form').querySelector('[type="submit"]');
    apply.textContent = `Apply ${label} changes`;
    apply.disabled = state.pictureUploading;
    renderEventFields();
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

  function deleteCharity(charityNode) {
    const label = charityNode.getAttribute('name') || 'this charity';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    charityNode.remove();
    markDirty();
    renderCharities();
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
    if (!state.dirty && !state.pendingPictureDeletions.size) return;
    const button = byId('save-data');
    button.disabled = true;
    status('Saving data.xml...');
    try {
      if (state.dirty) {
        const xmlText = new XMLSerializer().serializeToString(state.xml);
        const response = await fetch('/api/admin/data', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          body: xmlText
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Save failed (${response.status}).`);
        state.dirty = false;
      }

      const failures = [];
      const shared = [];
      for (const key of state.pendingPictureDeletions) {
        try {
          await deleteStoredPicture(key);
          state.pendingPictureDeletions.delete(key);
        } catch (error) {
          if (error.status === 409 || error.status === 404) {
            state.pendingPictureDeletions.delete(key);
            if (error.status === 409) shared.push(key);
          } else failures.push(error.message);
        }
      }
      await loadPictures();
      status(failures.length ? `data.xml saved, but old picture cleanup failed: ${failures.join(' ')}`
        : shared.length ? `Changes saved. ${shared.join(', ')} remains stored because another event still uses it.` : 'Changes saved to data.xml.',
        failures.length ? 'error' : 'info');
    } catch (error) {
      status(error.message || 'Could not save data.xml.', 'error');
    } finally {
      button.disabled = !state.dirty && !state.pendingPictureDeletions.size;
    }
  }

  byId('reload-data').addEventListener('click', () => loadData());
  byId('save-data').addEventListener('click', saveData);
  byId('add-event').addEventListener('click', () => {
    const eventNode = state.xml.createElement('Event');
    openEventEditor(eventNode, true);
  });
  byId('add-charity').addEventListener('click', () => {
    const charityNode = state.xml.createElement('Charity');
    charityNode.setAttribute('name', '');
    openEventEditor(charityNode, true, 'charity');
  });
  byId('add-duty').addEventListener('click', () => {
    const dutyNode = state.xml.createElement('Duty');
    openDutyEditor(dutyNode, true);
  });
  byId('picture-file').addEventListener('change', (event) => uploadPicture(event.target.files[0]));

  byId('event-field-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const { kind, name, element } = state.eventField;
    const value = byId('event-field-value').value;
    if (kind === 'attribute') {
      if ((name === 'name' || name === 'date') && !value.trim()) {
        byId('event-field-value').setCustomValidity(`${name} is required.`);
        byId('event-field-value').reportValidity();
        return;
      }
      state.eventDraft.setAttribute(name, value);
    } else {
      const child = element || state.xml.createElement(name);
      setElementEditorValue(child, value);
      if (!element) state.eventDraft.append(child);
    }
    byId('event-field-editor').close();
    state.eventField = null;
    renderEventFields();
  });
  byId('event-field-value').addEventListener('input', () => byId('event-field-value').setCustomValidity(''));

  byId('event-editor').addEventListener('close', async () => {
    if (!state.pendingEventPicture) return;
    const key = state.pendingEventPicture;
    state.pendingEventPicture = null;
    try {
      await deleteStoredPicture(key);
      state.pictures = state.pictures.filter((picture) => picture.key !== key);
      status('Canceled upload removed from eventpictures.');
    } catch (error) {
      status(`The unused upload ${key} could not be removed: ${error.message}`, 'error');
    }
  });

  byId('add-description').addEventListener('click', () => openRecordTextEditor('Description'));
  byId('add-mission').addEventListener('click', () => openRecordTextEditor('Mission'));
  byId('record-text-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = state.recordKind;
    const value = byId('record-text-input').value;
    if (!value.trim()) return;
    const node = state.recordEditing || state.xml.createElement(name);
    setElementEditorValue(node, value);
    if (!state.recordEditing) {
      const lastOfKind = recordTextNodes(name).at(-1);
      if (lastOfKind) lastOfKind.after(node);
      else if (name === 'Mission' && recordTextNodes('Description').length) recordTextNodes('Description').at(-1).after(node);
      else state.xml.documentElement.prepend(node);
    }
    byId('record-text-editor').close();
    state.recordEditing = null;
    state.recordKind = null;
    markDirty();
    renderRecordTexts(name);
  });

  byId('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const node = state.eventDraft;
    if (!node.getAttribute('name')?.trim() || (state.eventKind === 'event' && !node.getAttribute('date')?.trim())) {
      byId('event-editor-message').textContent = state.eventKind === 'event' ? 'Event name and date are required.' : 'Charity name is required.';
      return;
    }
    const oldPicture = state.eventEditing.querySelector('Picture')?.textContent || '';
    const newPicture = node.querySelector('Picture')?.textContent || '';
    const oldKey = oldPicture ? pictureKeyFromValue(oldPicture) : '';
    if (state.eventKind === 'event' && oldPicture !== newPicture && state.pictures.some((picture) => picture.key === oldKey)) {
      state.pendingPictureDeletions.add(oldKey);
    }
    if (state.eventIsNew) getContainer(state.eventKind === 'charity' ? 'Charities' : 'Events').append(node);
    else state.eventEditing.replaceWith(node);
    state.pendingEventPicture = null;
    byId('event-editor').close();
    state.eventEditing = null;
    state.eventDraft = null;
    state.eventIsNew = false;
    markDirty();
    if (state.eventKind === 'charity') renderCharities();
    else renderEvents();
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
    if (!state.dirty && !state.pendingEventPicture) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadData();
})();
