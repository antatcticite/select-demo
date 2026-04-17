import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import App from './App';

test('renders fine design select demo', () => {
  const container = document.createElement('div');

  act(() => {
    ReactDOM.render(<App />, container);
  });

  expect(container.textContent).toMatch(/FineDesign Select 原型/);
  expect(container.textContent).toMatch(/单选 Select/);
  expect(container.textContent).toMatch(/多选 Select/);
});
