const list = document.querySelector('#project-list');
const image = document.querySelector('#project-image');
const empty = document.querySelector('#empty-state');
const tabs = document.querySelector('#asset-tabs');
const fitButton = document.querySelector('#fit-button');
const focusButton = document.querySelector('#focus-button');

let projects = [];
let activeProject = null;

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function renderSpecs(specs = {}) {
  const root = document.querySelector('#project-specs');
  root.innerHTML = Object.entries(specs).map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`
  ).join('');
}

function selectAsset(asset, button) {
  tabs.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
  if (!asset) {
    image.hidden = true;
    empty.hidden = false;
    setText('#asset-caption', 'No assets yet');
    return;
  }
  empty.hidden = true;
  image.hidden = false;
  image.src = asset.src;
  image.alt = asset.alt || `${activeProject.title} preview`;
  image.classList.remove('actual');
  fitButton.textContent = 'Actual size';
  setText('#asset-caption', asset.caption || asset.label);
}

function selectProject(project) {
  activeProject = project;
  history.replaceState(null, '', `?project=${encodeURIComponent(project.slug)}`);
  document.querySelectorAll('.project-link').forEach((button) =>
    button.classList.toggle('active', button.dataset.slug === project.slug)
  );
  setText('#project-number', `Project ${project.number}`);
  setText('#project-status', project.status);
  setText('#project-title', project.title);
  setText('#project-description', project.description);
  renderSpecs(project.specs);

  tabs.innerHTML = '';
  (project.assets || []).forEach((asset, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = asset.label;
    button.addEventListener('click', () => selectAsset(asset, button));
    tabs.appendChild(button);
    if (index === 0) selectAsset(asset, button);
  });
  if (!project.assets?.length) selectAsset(null, null);
}

async function init() {
  const response = await fetch('projects.json');
  projects = await response.json();
  projects.forEach((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-link';
    button.dataset.slug = project.slug;
    button.innerHTML = `<span>${project.number}</span><span><strong>${project.title}</strong><small>${project.status}</small></span>`;
    button.addEventListener('click', () => selectProject(project));
    list.appendChild(button);
  });
  const requested = new URLSearchParams(location.search).get('project');
  selectProject(projects.find((project) => project.slug === requested) || projects[0]);
}

fitButton.addEventListener('click', () => {
  const actual = image.classList.toggle('actual');
  fitButton.textContent = actual ? 'Fit image' : 'Actual size';
});

function setFocusMode(enabled) {
  document.body.classList.toggle('focus-mode', enabled);
  focusButton.textContent = enabled ? 'Exit focus' : 'Focus view';
}

focusButton.addEventListener('click', () => {
  setFocusMode(!document.body.classList.contains('focus-mode'));
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'f') setFocusMode(!document.body.classList.contains('focus-mode'));
  if (event.key === 'Escape') setFocusMode(false);
});

init().catch((error) => {
  console.error(error);
  empty.hidden = false;
  empty.textContent = 'Could not load the project list.';
});
