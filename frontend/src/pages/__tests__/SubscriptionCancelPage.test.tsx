import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionCancelPage from "../SubscriptionCancelPage";

describe("SubscriptionCancelPage (B4)", () => {
  test("shows cancelled checkout message and navigation links", () => {
    render(
      <MemoryRouter>
        <SubscriptionCancelPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Checkout cancelled/i })).toBeInTheDocument();
    expect(screen.getByText(/No payment was taken/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Try again/i })).toHaveAttribute("href", "/subscription");
    expect(screen.getByRole("link", { name: /Back to dashboard/i })).toHaveAttribute(
      "href",
      "/student-dashboard"
    );
  });
});
