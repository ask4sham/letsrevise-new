import React from "react";

export default function TransmissionActivity({ data }) {
  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold text-blue-900">
        {data.title}
      </h2>

      <p className="mt-2 text-sm text-gray-700">
        Match each transmission route to how the pathogen spreads.
      </p>

      <div className="mt-4 grid gap-3">
        {data.dragMatch.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 bg-blue-50 p-3"
          >
            <p className="font-bold text-blue-900">{item.route}</p>
            <p className="text-sm text-gray-700">{item.match}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              Example: {item.example}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}