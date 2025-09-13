// src/App.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

// Mock child components to isolate App component behavior
jest.mock("./LoginPage", () => () => (
  <div data-testid="login-page">Login Page Mock</div>
));
jest.mock("./TrackerPage", () => ({ userId }) => (
  <div data-testid="tracker-page">Tracker Page Mock - User: {userId}</div>
));

describe("App Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders LoginPage when no userId is in localStorage", () => {
    render(<App />);
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("tracker-page")).not.toBeInTheDocument();
  });

  test("renders TrackerPage when userId is present in localStorage", () => {
    localStorage.setItem("userId", "123");
    render(<App />);
    expect(screen.getByTestId("tracker-page")).toBeInTheDocument();
    expect(
      screen.getByText("Tracker Page Mock - User: 123")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });
});

