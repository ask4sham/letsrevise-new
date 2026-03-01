import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
      },
    })),
  },
  AxiosError: class AxiosError extends Error {},
  AxiosHeaders: function AxiosHeaders() {},
  AxiosInstance: function AxiosInstance() {},
  AxiosRequestConfig: {},
  InternalAxiosRequestConfig: {},
}));
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));

test('renders app with branding', () => {
  render(<App />);
  expect(screen.getAllByText(/LetsRevise/i).length).toBeGreaterThanOrEqual(1);
});
