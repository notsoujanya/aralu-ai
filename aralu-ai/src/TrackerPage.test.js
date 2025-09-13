import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TrackerPage from "../pages/TrackerPage";

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();

  window.fetch = jest.fn();
  window.localStorage.setItem = jest.fn();
  window.localStorage.getItem = jest.fn(() => "mockUserId123");

  Object.defineProperty(window, "location", {
    value: { reload: jest.fn() },
    writable: true,
  });
});

describe("TrackerPage", () => {
  test("renders TrackerPage correctly", () => {
    render(<TrackerPage />);
    expect(screen.getByText(/tracker/i)).toBeInTheDocument();
  });

  test("submits period event and calls API", async () => {
    render(<TrackerPage />);
    fireEvent.click(screen.getByRole("button", { name: /period/i }));

    await waitFor(() =>
      expect(window.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/tracker/event",
        expect.any(Object)
      )
    );

    expect(window.fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByTitle("Period start")).toBeInTheDocument();
  });

  test("submits mood event and calls API", async () => {
    render(<TrackerPage />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));

    await waitFor(() =>
      expect(window.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/tracker/mood",
        expect.any(Object)
      )
    );

    expect(window.fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByTitle("Mood: good")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /good/i })).toHaveClass("active");
  });

  test("submits symptom event and calls API", async () => {
    render(<TrackerPage />);
    fireEvent.click(screen.getByRole("button", { name: /cramps/i }));

    await waitFor(() =>
      expect(window.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/tracker/symptom",
        expect.any(Object)
      )
    );

    expect(window.fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByTitle("Symptom: cramps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cramps/i })).toHaveClass("active");
  });

  test("fetches existing events on load", async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { type: "period", date: new Date().toISOString() },
        { type: "mood", mood: "good", date: new Date().toISOString() },
        { type: "symptom", symptom: "cramps", date: new Date().toISOString() },
      ],
    });

    render(<TrackerPage />);

    await waitFor(() =>
      expect(window.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/tracker/events/mockUserId123"
      )
    );

    expect(await screen.findByTitle("Period start")).toBeInTheDocument();
    expect(await screen.findByTitle("Mood: good")).toBeInTheDocument();
    expect(await screen.findByTitle("Symptom: cramps")).toBeInTheDocument();
  });
});





