import _ from 'lodash';

function getPersistedValue() {
  return _.get(global, 'localStorage.hideIntro', false);
}

function setPersistedValue(value) {
  if(!global.localStorage) return;

  if(!value) {
    delete global.localStorage.hideIntro;
  }
  else {
    global.localStorage.hideIntro = value;
  }
}

export function shouldShowIntro() {
  return !getPersistedValue();
}

export function setIntroVisibility(visible) {
  setPersistedValue(!visible);
}