// src/LoginPage.test.js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginPage from "./LoginPage";

// Preserve original window.location
const originalWindowLocation = window.location;

beforeAll(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload: jest.fn() },
  });

  // Robust localStorage mock
  const store = {};
  Object.defineProperty(window, "localStorage", {
    value: {
      setItem: jest.fn((key, value) => {
        store[key] = value;
      }),
      getItem: jest.fn((key) => store[key]),
      removeItem: jest.fn((key) => delete store[key]),
      clear: jest.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
    },
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalWindowLocation,
  });
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  window.fetch = jest.fn();
});

describe("LoginPage Component", () => {
  test("renders login form by default", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  test('switches to signup form when "Sign Up" is clicked', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/sign up/i));
    expect(screen.getByRole("heading", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
  });

  test("displays email validation error for invalid email", () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText(/email/i);
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.blur(emailInput);
    expect(
      screen.getByText("Please enter a valid email address.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    expect(
      screen.getByText("Please enter a valid email address.")
    ).toBeInTheDocument();
  });

  test("successfully signs up a new user", async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Signup successful!",
        userId: "testUserId123",
      }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByText(/sign up/i));

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/signup successful/i)).toBeInTheDocument();
    expect(localStorage.getItem("userId")).toBe("testUserId123");
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  test("displays error message on signup failure", async () => {
    window.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "User with this email already exists.",
      }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByText(/sign up/i));

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText("User with this email already exists.")
    ).toBeInTheDocument();
    expect(localStorage.getItem("userId")).toBeUndefined();
  });

  test("successfully logs in an existing user", async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Login successful!",
        userId: "existingUserId456",
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/login successful/i)).toBeInTheDocument();
    expect(localStorage.getItem("userId")).toBe("existingUserId456");
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  test("displays error message on login failure", async () => {
    window.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Incorrect password." }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText("Incorrect password.")).toBeInTheDocument();
    expect(localStorage.getItem("userId")).toBeUndefined();
  });
});
