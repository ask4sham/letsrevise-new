/**
 * Profile Manage classes entry for students.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserProfilePage from "../UserProfilePage";

jest.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: {
      firstName: "Sam",
      lastName: "Student",
      email: "sam@school.org",
      userType: "student",
    },
  }),
}));

test("student profile shows Manage classes link without Student ID", () => {
  render(
    <MemoryRouter>
      <UserProfilePage />
    </MemoryRouter>
  );

  expect(screen.getByText(/Classes and teachers/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Manage classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByText(/Student ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Accept|Decline|Leave class/i)).not.toBeInTheDocument();
});
